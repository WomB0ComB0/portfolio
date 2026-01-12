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
import { get } from '@/lib/http-clients/effect-fetcher';

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

export async function getWakaTimeData(): Promise<WakaTimeData> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  const effect = pipe(
    get('https://wakatime.com/api/v1/users/current/all_time_since_today', {
      headers: {
        Authorization: `Basic ${btoa(env.WAKA_TIME_API_KEY as string)}`,
      },
      schema: WakaTimeResponseSchema,
      retries: 2,
      timeout: 10_000,
    }),
    Effect.provide(FetchHttpClient.layer),
  );

  try {
    const response = await Effect.runPromise(effect);
    const data = response.data as any as WakaTimeData;
    cache = { data, timestamp: Date.now() };

    return data;
  } catch (error) {
    throw ensureBaseError(error, 'wakatime:fetch', {
      endpoint: 'all_time_since_today',
      cacheExpired: !cache || Date.now() - cache.timestamp >= CACHE_DURATION,
    });
  }
}
