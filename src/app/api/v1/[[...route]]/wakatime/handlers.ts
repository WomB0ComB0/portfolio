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
import { env } from '@/env';
import { FetcherError, get } from '@/lib/http-clients/effect-fetcher';
import { reportApiFailure } from '@/lib/observability/report';
import { wakaTimeAuthorization } from './auth';

/** The route's error-handler context, so stale-fallback warnings group with its errors. */
const REPORT_CONTEXT = 'fetching WakaTime data';

// Schema for WakaTime API response
const WakaTimeDataSchema = Schema.Struct({
  text: Schema.String,
  digital: Schema.String,
  decimal: Schema.String,
  total_seconds: Schema.Number,
});

const WakaTimeResponseSchema = Schema.Struct({
  data: WakaTimeDataSchema,
});

export type WakaTimeData = Schema.Schema.Type<typeof WakaTimeDataSchema>;

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
let cache: { data: WakaTimeData; timestamp: number } | null = null;

const WAKATIME_URL = 'https://wakatime.com/api/v1/users/current/all_time_since_today';
/**
 * Upstream time budget. The dev-stats card's fetch gives up after 10 s, so the stale fallback (or
 * the 500) has to be ready well before that: one retry of a 3.5 s attempt fits in the deadline.
 */
const ATTEMPT_TIMEOUT_MS = 3_500;
const RETRY_DELAY_MS = 500;
/** Caps the attempts together, retries and body reads included. */
const UPSTREAM_DEADLINE_MS = 8_000;

export async function getWakaTimeData(): Promise<WakaTimeData> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  const authorization = wakaTimeAuthorization(env.WAKA_TIME_API_KEY);

  const effect = pipe(
    get(WAKATIME_URL, {
      headers: {
        Authorization: authorization,
      },
      schema: WakaTimeResponseSchema,
      retries: 1,
      retryDelay: RETRY_DELAY_MS,
      timeout: ATTEMPT_TIMEOUT_MS,
    }),
    Effect.timeoutFail({
      duration: UPSTREAM_DEADLINE_MS,
      onTimeout: () =>
        new FetcherError(`WakaTime did not answer within ${UPSTREAM_DEADLINE_MS} ms`, WAKATIME_URL),
    }),
    Effect.provide(FetchHttpClient.layer),
  );

  try {
    const { data } = await Effect.runPromise(effect);
    cache = { data, timestamp: Date.now() };

    return data;
  } catch (error) {
    const failure = ensureBaseError(error, 'wakatime:fetch', {
      endpoint: 'all_time_since_today',
      cacheExpired: !cache || Date.now() - cache.timestamp >= CACHE_DURATION,
    });
    // All-time totals only grow: the last good value beats a 500.
    if (cache) {
      reportApiFailure(failure, { context: REPORT_CONTEXT, level: 'warning' });
      return cache.data;
    }
    throw failure;
  }
}
