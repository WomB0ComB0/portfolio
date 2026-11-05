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

/** LeetCode answers an unknown username with `matchedUser: null` (and a GraphQL error). */
const LeetCodeReplySchema = Schema.Struct({
  data: Schema.Struct({ matchedUser: Schema.NullOr(MatchedUserSchema) }),
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
let cache: { data: LeetCodeStats; timestamp: number } | null = null;

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

  const user = reply.data.matchedUser;
  if (!user) {
    throw new Error('LeetCode user not found');
  }
  return toStats(user);
}

export async function getLeetCodeStats(): Promise<LeetCodeStats> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  try {
    const data = await fetchFromGraphQL();
    cache = { data, timestamp: Date.now() };
    return data;
  } catch (error) {
    const failure = ensureBaseError(error, 'leetcode:fetch');
    // Serve the last good stats rather than a 500; they change slowly.
    if (cache) {
      reportApiFailure(failure, { context: REPORT_CONTEXT, level: 'warning' });
      return cache.data;
    }
    throw failure;
  }
}
