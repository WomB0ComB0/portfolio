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

import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';
import { ensureBaseError } from '@/classes/error';
import { processGlobal, resetProcessGlobal } from '@/lib/cache/process-global';
import type { CachedValue } from '@/lib/cache/stale-cache';
import { FetcherError, post } from '@/lib/http-clients/effect-fetcher';
import { reportApiFailure } from '@/lib/observability/report';

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';
const LEETCODE_USERNAME = 'WomB0ComB0';
/** The route's error-handler context, so stale-fallback warnings group with its errors. */
const REPORT_CONTEXT = 'fetch LeetCode stats';

const LEETCODE_QUERY = `
  query getUserProfile($username: String!) {
    matchedUser(username: $username) {
      submitStatsGlobal {
        acSubmissionNum { difficulty count submissions }
        totalSubmissionNum { difficulty count submissions }
      }
      profile { ranking }
    }
  }
`;

/**
 * One row per difficulty ('All', 'Easy', 'Medium', 'Hard'): `count` is problems, `submissions` is
 * submissions. In `acSubmissionNum` both count accepted ones only.
 */
const SubmissionCountSchema = Schema.Struct({
  difficulty: Schema.String,
  count: Schema.Number,
  submissions: Schema.Number,
});

const MatchedUserSchema = Schema.Struct({
  submitStatsGlobal: Schema.Struct({
    acSubmissionNum: Schema.Array(SubmissionCountSchema),
    totalSubmissionNum: Schema.Array(SubmissionCountSchema),
  }),
  profile: Schema.Struct({ ranking: Schema.NullOr(Schema.Number) }),
});

/**
 * LeetCode answers an unknown username with `matchedUser: null` (and a GraphQL error). A reply
 * with any `errors` may be partial (e.g. a null ranking), so it is treated as a failure.
 */
const LeetCodeReplySchema = Schema.Struct({
  data: Schema.Struct({ matchedUser: Schema.NullOr(MatchedUserSchema) }),
  errors: Schema.optional(Schema.Array(Schema.Struct({ message: Schema.String }))),
});

const LeetCodeStatsSchema = Schema.Struct({
  totalSolved: Schema.Number,
  easySolved: Schema.Number,
  mediumSolved: Schema.Number,
  hardSolved: Schema.Number,
  acceptanceRate: Schema.Number,
  ranking: Schema.Number,
});

type SubmissionCount = Schema.Schema.Type<typeof SubmissionCountSchema>;
type MatchedUser = Schema.Schema.Type<typeof MatchedUserSchema>;
export type LeetCodeStats = Schema.Schema.Type<typeof LeetCodeStatsSchema>;

const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

interface CachedStats {
  readonly data: LeetCodeStats;
  readonly timestamp: number;
}

/**
 * What getLeetCodeStats keeps between calls. Next bundles this module once for the /stats page
 * (whose prefetch calls getLeetCodeStats directly) and once for /api/v1, so module state would
 * give each its own cache. Kept in processGlobal instead, a prefetch that misses its deadline
 * still fills the cache the card's fallback request to /api/v1/leetcode reads, or that request
 * joins the load still running, rather than asking LeetCode a second time.
 */
interface LeetCodeState {
  /** The last good stats and when they were fetched. */
  cache: CachedStats | null;
  /** The refresh running now; every caller that finds the cache expired joins it. */
  inFlight: Promise<LeetCodeStats> | null;
}

const STATE_NAME = 'leetcode.cache';

/** Looked up on every call, so a reset in a test takes effect without reloading this module. */
const sharedState = (): LeetCodeState =>
  processGlobal<LeetCodeState>(STATE_NAME, () => ({ cache: null, inFlight: null }));

/** Forgets the cached stats and any running refresh. Tests only. */
export function resetLeetCodeCache(): void {
  resetProcessGlobal(STATE_NAME);
}

const isFresh = (cache: CachedStats | null): cache is CachedStats =>
  cache !== null && Date.now() - cache.timestamp < CACHE_DURATION;

/**
 * Upstream time budget. The LeetCode card's fetch gives up after 10 s, so the stale fallback (or
 * the 500) has to be ready well before that: one retry of a 3.5 s attempt fits in the deadline.
 */
const ATTEMPT_TIMEOUT_MS = 3_500;
const RETRY_DELAY_MS = 500;
/** Caps the attempts together, retries and body reads included. */
const UPSTREAM_DEADLINE_MS = 8_000;

const rowFor = (rows: readonly SubmissionCount[], difficulty: string) =>
  rows.find((row) => row.difficulty === difficulty);

/** Accepted over total submissions as a percentage, to 2 decimals; 0 with no submissions. */
const toAcceptanceRate = (accepted: number, total: number): number =>
  total > 0 ? Math.round((accepted / total) * 100 * 100) / 100 : 0;

function toStats(user: MatchedUser): LeetCodeStats {
  const { acSubmissionNum, totalSubmissionNum } = user.submitStatsGlobal;
  const solved = (difficulty: string) => rowFor(acSubmissionNum, difficulty)?.count ?? 0;

  return {
    totalSolved: solved('All'),
    easySolved: solved('Easy'),
    mediumSolved: solved('Medium'),
    hardSolved: solved('Hard'),
    acceptanceRate: toAcceptanceRate(
      rowFor(acSubmissionNum, 'All')?.submissions ?? 0,
      rowFor(totalSubmissionNum, 'All')?.submissions ?? 0,
    ),
    ranking: user.profile.ranking ?? 0,
  };
}

/**
 * Fetches LeetCode stats via the official GraphQL API. A reply that doesn't match the schema
 * fails, so it never reaches the cache.
 */
async function fetchFromGraphQL(): Promise<LeetCodeStats> {
  const reply = await Effect.runPromise(
    pipe(
      post(
        LEETCODE_GRAPHQL_URL,
        { query: LEETCODE_QUERY, variables: { username: LEETCODE_USERNAME } },
        {
          schema: LeetCodeReplySchema,
          retries: 1,
          retryDelay: RETRY_DELAY_MS,
          timeout: ATTEMPT_TIMEOUT_MS,
          headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com' },
        },
      ),
      Effect.timeoutFail({
        duration: UPSTREAM_DEADLINE_MS,
        onTimeout: () =>
          new FetcherError(
            `LeetCode did not answer within ${UPSTREAM_DEADLINE_MS} ms`,
            LEETCODE_GRAPHQL_URL,
          ),
      }),
      Effect.provide(FetchHttpClient.layer),
    ),
  );

  const firstError = reply.errors?.[0];
  if (firstError) {
    throw new Error(`LeetCode GraphQL error: ${firstError.message}`);
  }
  const user = reply.data.matchedUser;
  if (!user) {
    throw new Error('LeetCode user not found');
  }
  return toStats(user);
}

/**
 * Asks LeetCode again and caches the answer in `state`, the store that was current when the
 * refresh started (so one that outlives a test's reset never fills the next test's cache).
 */
async function refreshLeetCodeStats(state: LeetCodeState): Promise<LeetCodeStats> {
  try {
    const data = await fetchFromGraphQL();
    state.cache = { data, timestamp: Date.now() };
    return data;
  } catch (error) {
    const failure = ensureBaseError(error, 'leetcode:fetch');
    const { cache } = state;
    // Serve the last good stats rather than a 500; they change slowly.
    if (cache) {
      reportApiFailure(failure, { context: REPORT_CONTEXT, level: 'warning' });
      return cache.data;
    }
    throw failure;
  }
}

/**
 * The last stats LeetCode answered and when they were fetched (epoch ms), however old, or
 * undefined when it never answered in this process. Never asks LeetCode and never waits on a
 * running refresh: for a caller whose deadline ran out while {@link getLeetCodeStats} was still
 * refreshing (the home tile). That refresh keeps running and still fills the cache.
 */
export function peekLeetCodeStats(): CachedValue<LeetCodeStats> | undefined {
  const { cache } = sharedState();
  return cache ? { data: cache.data, loadedAt: cache.timestamp } : undefined;
}

export async function getLeetCodeStats(): Promise<LeetCodeStats> {
  const state = sharedState();
  if (isFresh(state.cache)) {
    return state.cache.data;
  }

  // One refresh at a time: a late prefetch and the card's own request share LeetCode's answer.
  state.inFlight ??= refreshLeetCodeStats(state).finally(() => {
    state.inFlight = null;
  });
  return state.inFlight;
}
