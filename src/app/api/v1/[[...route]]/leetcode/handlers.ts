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

import { ensureBaseError } from '@/classes/error';
import { get } from '@/lib/http-clients/effect-fetcher';
import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';

// NOTE: This uses a popular unofficial LeetCode API.
const LEETCODE_API_URL = 'https://leetcode-stats-api.herokuapp.com/WomB0ComB0';

const LeetCodeStatsSchema = Schema.Struct({
  totalSolved: Schema.Number,
  easySolved: Schema.Number,
  mediumSolved: Schema.Number,
  hardSolved: Schema.Number,
  acceptanceRate: Schema.Number,
  ranking: Schema.Number,
});

export type LeetCodeStats = Schema.Schema.Type<typeof LeetCodeStatsSchema>;

const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours
let cache: { data: LeetCodeStats; timestamp: number } | null = null;

export async function getLeetCodeStats(): Promise<LeetCodeStats> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  const effect = pipe(
    get(LEETCODE_API_URL, {
      schema: LeetCodeStatsSchema,
      retries: 2,
      timeout: 10_000,
    }),
    Effect.provide(FetchHttpClient.layer),
  );

  try {
    const data = await Effect.runPromise(effect);
    cache = { data, timestamp: Date.now() };
    return data;
  } catch (error) {
    throw ensureBaseError(error, 'leetcode:fetch');
  }
}
