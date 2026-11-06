import 'server-only';

/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @file The server source for the home page's GitHub tile: contributions per week for the last
 * {@link ACTIVITY_WEEKS} weeks and the latest commit by {@link GITHUB_LOGIN}. There is no HTTP
 * route: only the server tile reads it (add one when a client needs it).
 *
 * One GraphQL query reads the contribution calendar and the newest commits on the default branch
 * of the {@link REPOSITORIES_READ} most recently pushed repositories: public, not forks, owned by
 * the user or by an organization the user belongs to. Only PUBLIC repositories are queried, so a private commit
 * headline can never reach the page. The REST Events API is not an option: GitHub dropped the
 * commit list from PushEvent payloads on 2025-10-07.
 *
 * Answers come from a stale-on-error cache, fresh for ten minutes; after a failed reload the last
 * good activity is served, marked stale. It lives in processGlobal, so a route added later shares
 * it with the page instead of asking GitHub again.
 */

import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';
import { ensureBaseError } from '@/classes/error';
import env from '@/env';
import { processGlobal, resetProcessGlobal } from '@/lib/cache/process-global';
import {
  type CachedValue,
  createStaleCache,
  type StaleCache,
  type StaleCacheResult,
} from '@/lib/cache/stale-cache';
import { FetcherError, post } from '@/lib/http-clients/effect-fetcher';

/** The GitHub account whose contributions and commits the tile shows. */
export const GITHUB_LOGIN = 'WomB0ComB0';

/** How many calendar weeks the tile covers, the current partial week included. */
export const ACTIVITY_WEEKS = 12;

/** How long a loaded answer is served before GitHub is asked again. */
export const ACTIVITY_TTL_MS = 600_000;

/** One calendar week (Sunday to Saturday, UTC) of contributions. */
export interface ContributionWeek {
  /** The week's first day, YYYY-MM-DD. */
  readonly start: string;
  readonly count: number;
}

/** The newest commit by {@link GITHUB_LOGIN} on a default branch the query reads. */
export interface LatestCommit {
  /** `owner/name`. */
  readonly repo: string;
  readonly repoUrl: string;
  /** The first line of the commit message. */
  readonly headline: string;
  readonly url: string;
  /** The abbreviated commit hash. */
  readonly sha: string;
  /** ISO 8601. */
  readonly committedAt: string;
}

export interface GitHubActivity {
  /** Oldest to newest, {@link ACTIVITY_WEEKS} long; the last is the current, partial week. */
  readonly weeks: ContributionWeek[];
  /** The sum of `weeks`. Zero is a real answer. */
  readonly total: number;
  /** Null when none of the commits read is by {@link GITHUB_LOGIN}. */
  readonly latestCommit: LatestCommit | null;
  /** When GitHub answered, ISO 8601. */
  readonly fetchedAt: string;
}

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
/** Commit and repository links must point here before the tile may link to them. */
const GITHUB_WEB_HOST = 'github.com';

/** Upstream time budget: one retry of a 3.5 s attempt fits in the deadline, as for GitHub stats. */
const ATTEMPT_TIMEOUT_MS = 3_500;
const RETRY_DELAY_MS = 500;
/** Caps the attempts together, retries and body reads included. */
const UPSTREAM_DEADLINE_MS = 8_000;

/**
 * Repositories read for the latest commit, most recently pushed first. A push to any branch by
 * anyone (a bot, a teammate in an org) moves a repository up, so reading ten rather than five
 * makes it less likely that their pushes crowd out the one holding the user's newest commit.
 * History is not filtered by author: that needs the user's node id hard-coded, and a history
 * with none of his commits would then be walked to its start, which can slow or fail the one
 * query the contribution calendar also rides on.
 */
const REPOSITORIES_READ = 10;
/** Commits read from the top of each default branch. */
const COMMITS_PER_REPOSITORY = 20;

const CACHE_NAME = 'github-activity.cache';
const CACHE_KEY = 'activity';
/** Tags every failure, so Sentry groups them. */
const ERROR_COMMAND = 'github:activity';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const MERGE_PREFIX = 'Merge ';
const OWN_LOGIN = GITHUB_LOGIN.toLowerCase();

const ACTIVITY_QUERY = `
  query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
      repositories(
        first: ${REPOSITORIES_READ}
        privacy: PUBLIC
        isFork: false
        ownerAffiliations: [OWNER, ORGANIZATION_MEMBER]
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        nodes {
          nameWithOwner
          url
          defaultBranchRef {
            target {
              ... on Commit {
                history(first: ${COMMITS_PER_REPOSITORY}) {
                  nodes {
                    messageHeadline
                    committedDate
                    url
                    abbreviatedOid
                    author {
                      user {
                        login
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * GraphQL's envelope. `data` is decoded only after `errors` is checked, so a failed query reports
 * GitHub's own message rather than a schema mismatch on the partial data that came with it.
 */
const GraphQLReplySchema = Schema.Struct({
  data: Schema.optional(Schema.Unknown),
  errors: Schema.optional(Schema.Array(Schema.Struct({ message: Schema.String }))),
});
type GraphQLReply = Schema.Schema.Type<typeof GraphQLReplySchema>;

/** A calendar date in another format would silently count as no contributions, so it fails. */
const ContributionDaySchema = Schema.Struct({
  date: Schema.String.pipe(Schema.pattern(/^\d{4}-\d{2}-\d{2}$/)),
  contributionCount: Schema.NonNegativeInt,
});

const CommitSchema = Schema.Struct({
  messageHeadline: Schema.String,
  committedDate: Schema.String,
  url: Schema.String,
  abbreviatedOid: Schema.String,
  // `user` is null when the commit's author email belongs to no GitHub account.
  author: Schema.NullishOr(
    Schema.Struct({ user: Schema.NullishOr(Schema.Struct({ login: Schema.String })) }),
  ),
});
type Commit = Schema.Schema.Type<typeof CommitSchema>;

/** `... on Commit` selects nothing on any other target (a tag), which then arrives as `{}`. */
const BranchTargetSchema = Schema.Struct({
  history: Schema.NullishOr(
    Schema.Struct({ nodes: Schema.NullishOr(Schema.Array(Schema.NullOr(CommitSchema))) }),
  ),
});

const RepositorySchema = Schema.Struct({
  nameWithOwner: Schema.String,
  url: Schema.String,
  // Null for an empty repository.
  defaultBranchRef: Schema.NullishOr(
    Schema.Struct({ target: Schema.NullishOr(BranchTargetSchema) }),
  ),
});
type Repository = Schema.Schema.Type<typeof RepositorySchema>;

const ActivityUserSchema = Schema.Struct({
  contributionsCollection: Schema.Struct({
    contributionCalendar: Schema.Struct({
      weeks: Schema.Array(Schema.Struct({ contributionDays: Schema.Array(ContributionDaySchema) })),
    }),
  }),
  repositories: Schema.Struct({
    nodes: Schema.NullishOr(Schema.Array(Schema.NullOr(RepositorySchema))),
  }),
});
type ActivityUser = Schema.Schema.Type<typeof ActivityUserSchema>;
type ContributionDay = Schema.Schema.Type<typeof ContributionDaySchema>;

const decodeActivityData = Schema.decodeUnknownSync(
  Schema.Struct({ user: Schema.NullOr(ActivityUserSchema) }),
);

/** The weeks the query covers: from Sunday 00:00 UTC, eleven weeks before this one, to now. */
interface ActivitySpan {
  readonly fromMs: number;
  readonly nowMs: number;
}

/** Looked up on every call, so a reset in a test takes effect without reloading this module. */
const activityCache = (): StaleCache<GitHubActivity> =>
  processGlobal(CACHE_NAME, () =>
    createStaleCache<GitHubActivity>({ ttlMs: ACTIVITY_TTL_MS, now: () => Date.now() }),
  );

const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

function activitySpan(nowMs: number): ActivitySpan {
  const now = new Date(nowMs);
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const weekStartMs = todayMs - now.getUTCDay() * DAY_MS;
  return { fromMs: weekStartMs - (ACTIVITY_WEEKS - 1) * WEEK_MS, nowMs };
}

function requestActivity(token: string, span: ActivitySpan) {
  const variables = {
    login: GITHUB_LOGIN,
    from: new Date(span.fromMs).toISOString(),
    to: new Date(span.nowMs).toISOString(),
  };
  return pipe(
    post(
      GITHUB_GRAPHQL_URL,
      { query: ACTIVITY_QUERY, variables },
      {
        schema: GraphQLReplySchema,
        headers: {
          Authorization: `bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Portfolio-Dashboard',
        },
        retries: 1,
        retryDelay: RETRY_DELAY_MS,
        timeout: ATTEMPT_TIMEOUT_MS,
      },
    ),
    Effect.timeoutFail({
      duration: UPSTREAM_DEADLINE_MS,
      onTimeout: () =>
        new FetcherError(
          `GitHub did not answer within ${UPSTREAM_DEADLINE_MS} ms`,
          GITHUB_GRAPHQL_URL,
        ),
    }),
    Effect.provide(FetchHttpClient.layer),
  );
}

/** The user in the reply. GraphQL errors, a reply that does not match, or no such user throw. */
function activityUser(reply: GraphQLReply): ActivityUser {
  if (reply.errors && reply.errors.length > 0) {
    const messages = reply.errors.map((error) => error.message).join('; ');
    throw new Error(`GitHub GraphQL errors: ${messages}`);
  }
  const { user } = decodeActivityData(reply.data);
  if (!user) throw new Error(`GitHub has no user ${GITHUB_LOGIN}`);
  return user;
}

/** Which of the covered weeks `day` falls in (0 is the oldest); outside them, < 0 or >= 12. */
const weekIndexOf = (day: ContributionDay, fromMs: number): number =>
  Math.floor((Date.parse(`${day.date}T00:00:00Z`) - fromMs) / WEEK_MS);

/** Every covered week, even one GitHub left out (it counts 0); days outside them are dropped. */
function toWeeks(days: readonly ContributionDay[], fromMs: number): ContributionWeek[] {
  return Array.from({ length: ACTIVITY_WEEKS }, (_, index) => ({
    start: isoDay(fromMs + index * WEEK_MS),
    count: days
      .filter((day) => weekIndexOf(day, fromMs) === index)
      .reduce((sum, day) => sum + day.contributionCount, 0),
  }));
}

/** Whether `value` is an https link on github.com, so the tile only ever links to GitHub. */
function isGitHubLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === GITHUB_WEB_HOST;
  } catch {
    return false;
  }
}

const isOwnCommit = (commit: Commit): boolean =>
  commit.author?.user?.login.toLowerCase() === OWN_LOGIN;

/** `commit` as a LatestCommit, or null when it is someone else's or cannot be linked or dated. */
function toLatestCommit(repository: Repository, commit: Commit | null): LatestCommit | null {
  if (!commit || !isOwnCommit(commit) || !isGitHubLink(commit.url)) return null;
  const committedMs = Date.parse(commit.committedDate);
  if (Number.isNaN(committedMs)) return null;
  return {
    repo: repository.nameWithOwner,
    repoUrl: repository.url,
    headline: commit.messageHeadline,
    url: commit.url,
    sha: commit.abbreviatedOid,
    committedAt: new Date(committedMs).toISOString(),
  };
}

/** The user's commits across the repositories read; repositories without commits add none. */
function ownCommits(repositories: readonly (Repository | null)[]): LatestCommit[] {
  return repositories.flatMap((repository) => {
    if (!repository || !isGitHubLink(repository.url)) return [];
    const commits = repository.defaultBranchRef?.target?.history?.nodes ?? [];
    return commits.flatMap((commit) => toLatestCommit(repository, commit) ?? []);
  });
}

const isNewer = (commit: LatestCommit, than: LatestCommit): boolean =>
  Date.parse(commit.committedAt) > Date.parse(than.committedAt);

/** The newest commit, a merge only when nothing else is there. */
function pickLatestCommit(commits: readonly LatestCommit[]): LatestCommit | null {
  const authored = commits.filter((commit) => !commit.headline.startsWith(MERGE_PREFIX));
  const pool = authored.length > 0 ? authored : commits;
  return pool.reduce<LatestCommit | null>(
    (latest, commit) => (latest === null || isNewer(commit, latest) ? commit : latest),
    null,
  );
}

function toActivity(user: ActivityUser, span: ActivitySpan): GitHubActivity {
  const days = user.contributionsCollection.contributionCalendar.weeks.flatMap(
    (week) => week.contributionDays,
  );
  const weeks = toWeeks(days, span.fromMs);
  return {
    weeks,
    total: weeks.reduce((sum, week) => sum + week.count, 0),
    latestCommit: pickLatestCommit(ownCommits(user.repositories.nodes ?? [])),
    fetchedAt: new Date(Date.now()).toISOString(),
  };
}

/** Asks GitHub. Every failure is a BaseError tagged {@link ERROR_COMMAND}. */
async function loadActivity(): Promise<GitHubActivity> {
  const token = env.GITHUB_TOKEN;
  if (!token) throw ensureBaseError(new Error('GITHUB_TOKEN is not set'), ERROR_COMMAND);

  const span = activitySpan(Date.now());
  try {
    const reply = await Effect.runPromise(requestActivity(token, span));
    return toActivity(activityUser(reply), span);
  } catch (error) {
    throw ensureBaseError(error, ERROR_COMMAND, { login: GITHUB_LOGIN });
  }
}

/**
 * The activity, fresh or stale (the last good answer, after a failed reload). Reports nothing, so
 * the caller decides how to surface staleness. Rejects only when nothing is cached.
 */
export function readGitHubActivity(): Promise<StaleCacheResult<GitHubActivity>> {
  return activityCache().get(CACHE_KEY, loadActivity);
}

/**
 * The last activity GitHub answered and when it was cached (epoch ms), however old, or undefined
 * when it never answered in this process. Never asks GitHub and never waits: for a caller whose
 * deadline ran out while {@link readGitHubActivity} was still reloading.
 */
export function peekGitHubActivity(): CachedValue<GitHubActivity> | undefined {
  return activityCache().peek(CACHE_KEY);
}

/** Forgets the cached activity, in every copy of this module. Tests only. */
export function resetGitHubActivityCache(): void {
  resetProcessGlobal(CACHE_NAME);
}
