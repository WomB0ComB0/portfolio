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
 * @file The server sources for two home tiles. There is no HTTP route: only the server tiles read
 * them (add one when a client needs it).
 *
 * - The GitHub tile: contributions per week for the last {@link ACTIVITY_WEEKS} weeks and the
 *   latest commit by {@link GITHUB_LOGIN}. One GraphQL query reads the contribution calendar and
 *   the newest commits on the default branch of the {@link REPOSITORIES_READ} most recently pushed
 *   repositories: public, not forks, owned by the user or by an organization the user belongs to.
 *   Only PUBLIC repositories are queried, so a private commit headline can never reach the page.
 *   The REST Events API is not an option: GitHub dropped the commit list from PushEvent payloads
 *   on 2025-10-07.
 * - The project tile: the public repositories the user's own commits went to in the last
 *   {@link RECENT_COMMITS_DAYS} days, each with the day of his newest one
 *   ({@link readRecentCommits}). A separate, smaller query, so it never slows the GitHub tile's.
 *
 * Answers come from stale-on-error caches, fresh for ten minutes; after a failed reload the last
 * good answer is served, marked stale. They live in processGlobal, so a route added later shares
 * them with the page instead of asking GitHub again.
 */

import { FetchHttpClient } from '@effect/platform';
import { Effect, Either, Option, pipe, Schema } from 'effect';
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

/**
 * How far back the project tile looks for the user's commits, in days. The tile's selector
 * applies the same window again, as a cached answer ages.
 */
export const RECENT_COMMITS_DAYS = 30;

/** A public repository GitHub counts the user's own commits to, and the day of his newest. */
export interface CommittedRepo {
  /** `owner/name`. */
  readonly nameWithOwner: string;
  /** On github.com. */
  readonly url: string;
  /**
   * The day of his newest commit there, YYYY-MM-DD, as GitHub's contribution calendar dates it.
   * A day, not a moment: GitHub counts commit contributions per day.
   */
  readonly lastCommitDay: string;
  /** How many of his commits GitHub counts there on that day. */
  readonly commitsThatDay: number;
}

/**
 * The user's recent own commits, by repository. GitHub counts a commit as his when its author
 * email is on his account and it reached the default branch of a repository that is not a fork:
 * a bot's or a teammate's push, a push to another branch, or a commit only in a fork is not one.
 * Repositories he owns, belongs to through an organization, or collaborates on all count.
 */
export interface RecentCommits {
  /** Public repositories only, his newest commit day first; on one day, more commits first. */
  readonly repos: readonly CommittedRepo[];
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

/**
 * Repositories GitHub lists the user's commits for: its maximum. Private ones are listed too
 * (when the token can see them) and dropped here, so they must not crowd out the public ones.
 */
const COMMITTED_REPOSITORIES_READ = 100;
const RECENT_COMMITS_CACHE_NAME = 'github-recent-commits.cache';
const RECENT_COMMITS_CACHE_KEY = 'recent-commits';
/** Tags every failure of the recent commits, apart from the activity's. */
const RECENT_COMMITS_COMMAND = 'github:recent-commits';

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
 * The repositories the user's commits went to between `from` and `to`, each with its newest
 * contribution day. Unlike `repositories`, this field takes no privacy filter: `isPrivate` comes
 * first so the decoder can drop a private repository before reading anything else of it.
 */
const RECENT_COMMITS_QUERY = `
  query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        commitContributionsByRepository(maxRepositories: ${COMMITTED_REPOSITORIES_READ}) {
          repository {
            isPrivate
            nameWithOwner
            url
          }
          contributions(first: 1, orderBy: { field: OCCURRED_AT, direction: DESC }) {
            nodes {
              occurredAt
              commitCount
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

/**
 * The reply's outline only: each repository's entry stays unknown until it is known to be
 * public ({@link isPublicEntry}), so nothing of a private one is read, kept or put in an error.
 */
const RecentCommitsDataSchema = Schema.Struct({
  user: Schema.NullOr(
    Schema.Struct({
      contributionsCollection: Schema.Struct({
        commitContributionsByRepository: Schema.Array(Schema.Unknown),
      }),
    }),
  ),
});

/** One public repository's entry. */
const CommitContributionsSchema = Schema.Struct({
  repository: Schema.Struct({
    isPrivate: Schema.Literal(false),
    nameWithOwner: Schema.String,
    url: Schema.String,
  }),
  contributions: Schema.Struct({
    nodes: Schema.NullishOr(
      Schema.Array(
        Schema.NullOr(
          Schema.Struct({ occurredAt: Schema.String, commitCount: Schema.NonNegativeInt }),
        ),
      ),
    ),
  }),
});
type CommitContributions = Schema.Schema.Type<typeof CommitContributionsSchema>;

const decodeRecentCommitsData = Schema.decodeUnknownEither(RecentCommitsDataSchema);
const decodeCommitContributions = Schema.decodeUnknownOption(CommitContributionsSchema);

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

/** The recent commits' own cache, so neither source's failure or slowness holds the other. */
const recentCommitsCache = (): StaleCache<RecentCommits> =>
  processGlobal(RECENT_COMMITS_CACHE_NAME, () =>
    createStaleCache<RecentCommits>({ ttlMs: ACTIVITY_TTL_MS, now: () => Date.now() }),
  );

const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

function activitySpan(nowMs: number): ActivitySpan {
  const now = new Date(nowMs);
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const weekStartMs = todayMs - now.getUTCDay() * DAY_MS;
  return { fromMs: weekStartMs - (ACTIVITY_WEEKS - 1) * WEEK_MS, nowMs };
}

/** The user's contributions between `fromMs` and `nowMs`, as the queries' variables. */
const spanVariables = (fromMs: number, nowMs: number) => ({
  login: GITHUB_LOGIN,
  from: new Date(fromMs).toISOString(),
  to: new Date(nowMs).toISOString(),
});

/** POSTs one query, retried once, within {@link UPSTREAM_DEADLINE_MS}. */
function requestGraphQL(token: string, query: string, variables: Record<string, string>) {
  return pipe(
    post(
      GITHUB_GRAPHQL_URL,
      { query, variables },
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

/** The reply's data. GraphQL errors throw, with GitHub's messages. */
function replyData(reply: GraphQLReply): unknown {
  if (reply.errors && reply.errors.length > 0) {
    const messages = reply.errors.map((error) => error.message).join('; ');
    throw new Error(`GitHub GraphQL errors: ${messages}`);
  }
  return reply.data;
}

/** The user in the reply. GraphQL errors, a reply that does not match, or no such user throw. */
function activityUser(reply: GraphQLReply): ActivityUser {
  const { user } = decodeActivityData(replyData(reply));
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
    const variables = spanVariables(span.fromMs, span.nowMs);
    const reply = await Effect.runPromise(requestGraphQL(token, ACTIVITY_QUERY, variables));
    return toActivity(activityUser(reply), span);
  } catch (error) {
    throw ensureBaseError(error, ERROR_COMMAND, { login: GITHUB_LOGIN });
  }
}

/**
 * True only for an entry GitHub marks public in so many words (`isPrivate: false`): a private
 * one, or one whose privacy is missing or unreadable, is dropped unread.
 */
function isPublicEntry(entry: unknown): boolean {
  if (typeof entry !== 'object' || entry === null) return false;
  const { repository } = entry as { repository?: unknown };
  return (
    typeof repository === 'object' &&
    repository !== null &&
    (repository as { isPrivate?: unknown }).isPrivate === false
  );
}

/**
 * The calendar day a contribution's `occurredAt` names. GitHub dates a day's contributions by
 * that day's start in its calendar's time zone, Pacific time (07:00Z or 08:00Z): for any zone at
 * or west of UTC, that start falls on the same day in UTC. Null for a value that is not a date.
 */
function contributionDay(occurredAt: string): string | null {
  const ms = Date.parse(occurredAt);
  return Number.isNaN(ms) ? null : isoDay(ms);
}

type ContributionNode = NonNullable<
  NonNullable<CommitContributions['contributions']['nodes']>[number]
>;

/** The node with the newest day, whatever order GitHub sent them in. */
const newestContribution = (nodes: readonly (ContributionNode | null)[]): ContributionNode | null =>
  nodes.reduce<ContributionNode | null>(
    (newest, node) =>
      node && (newest === null || Date.parse(node.occurredAt) > Date.parse(newest.occurredAt))
        ? node
        : newest,
    null,
  );

/**
 * `entry` as a CommittedRepo, or null when it is private (or not plainly public), does not link to
 * github.com, or has no day GitHub can date.
 */
function toCommittedRepo(entry: unknown): CommittedRepo | null {
  if (!isPublicEntry(entry)) return null;
  const decoded = decodeCommitContributions(entry);
  if (Option.isNone(decoded)) return null;
  const { repository, contributions } = decoded.value;
  const newest = newestContribution(contributions.nodes ?? []);
  const day = newest ? contributionDay(newest.occurredAt) : null;
  if (!newest || !day || !isGitHubLink(repository.url)) return null;
  return {
    nameWithOwner: repository.nameWithOwner,
    url: repository.url,
    lastCommitDay: day,
    commitsThatDay: newest.commitCount,
  };
}

/** Newest day first; on one day, more commits first; otherwise in GitHub's order. */
const byNewestCommit = (a: CommittedRepo, b: CommittedRepo): number =>
  b.lastCommitDay.localeCompare(a.lastCommitDay) || b.commitsThatDay - a.commitsThatDay;

/**
 * The public repositories in the reply. GraphQL errors or no such user throw. A reply in another
 * shape throws a fixed message: a schema error would print the values it met, and the reply may
 * hold private repositories' names.
 */
function toRecentCommits(reply: GraphQLReply): RecentCommits {
  const decoded = decodeRecentCommitsData(replyData(reply));
  if (Either.isLeft(decoded)) {
    throw new Error("GitHub's commit contributions did not have the expected shape");
  }
  const { user } = decoded.right;
  if (!user) throw new Error(`GitHub has no user ${GITHUB_LOGIN}`);
  const entries = user.contributionsCollection.commitContributionsByRepository;
  return {
    repos: entries.flatMap((entry) => toCommittedRepo(entry) ?? []).sort(byNewestCommit),
    fetchedAt: new Date(Date.now()).toISOString(),
  };
}

/** Asks GitHub. Every failure is a BaseError tagged {@link RECENT_COMMITS_COMMAND}. */
async function loadRecentCommits(): Promise<RecentCommits> {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    throw ensureBaseError(new Error('GITHUB_TOKEN is not set'), RECENT_COMMITS_COMMAND);
  }
  const nowMs = Date.now();
  try {
    // One day more than the window. The selector accepts every day up to 30 back from New York's
    // today, and GitHub starts a day at midnight Pacific time; 30 days before now can be hours into
    // that oldest day (a day later in UTC on a New York evening), leaving its earlier commits out.
    // 31 days before now is always before that day starts. The selector drops the extra day.
    const variables = spanVariables(nowMs - (RECENT_COMMITS_DAYS + 1) * DAY_MS, nowMs);
    const reply = await Effect.runPromise(requestGraphQL(token, RECENT_COMMITS_QUERY, variables));
    return toRecentCommits(reply);
  } catch (error) {
    throw ensureBaseError(error, RECENT_COMMITS_COMMAND, { login: GITHUB_LOGIN });
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

/**
 * The user's recent own commits by public repository, fresh or stale (the last good answer, after
 * a failed reload). Reports nothing. Rejects only when nothing is cached. Its failures are its
 * own errors, never the activity's, so each tile reports its own.
 */
export function readRecentCommits(): Promise<StaleCacheResult<RecentCommits>> {
  return recentCommitsCache().get(RECENT_COMMITS_CACHE_KEY, loadRecentCommits);
}

/**
 * The recent commits GitHub last answered and when they were cached (epoch ms), however old, or
 * undefined when it never answered in this process. Never asks GitHub and never waits.
 */
export function peekRecentCommits(): CachedValue<RecentCommits> | undefined {
  return recentCommitsCache().peek(RECENT_COMMITS_CACHE_KEY);
}

/** Forgets the cached activity and recent commits, in every copy of this module. Tests only. */
export function resetGitHubActivityCache(): void {
  resetProcessGlobal(CACHE_NAME);
  resetProcessGlobal(RECENT_COMMITS_CACHE_NAME);
}
