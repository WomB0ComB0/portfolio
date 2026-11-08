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

import { Ratelimit } from '@upstash/ratelimit';
import type { Redis } from '@upstash/redis';
import type { LimiterKind, Limiters } from './rate-limit.types';

/** Sliding-window size and Redis key prefix for each route class. */
export const RATE_LIMITS = {
  api: { tokens: 30, window: '60 s', prefix: 'ratelimit:api' },
  apiv1: { tokens: 60, window: '60 s', prefix: 'ratelimit:apiv1' },
  auth: { tokens: 5, window: '10 s', prefix: 'ratelimit:auth' },
  // Each post adds a public row to /guestbook, so a client gets a few per ten minutes.
  guestbook: { tokens: 5, window: '600 s', prefix: 'ratelimit:guestbook' },
  slow: { tokens: 1, window: '30 s', prefix: 'ratelimit:slowmode' },
} as const satisfies Record<
  LimiterKind,
  { tokens: number; window: `${number} s`; prefix: `ratelimit:${string}` }
>;

const cache = new WeakMap<Redis, Limiters>();

function createLimiter(redis: Redis, kind: LimiterKind): Ratelimit {
  const { tokens, window, prefix } = RATE_LIMITS[kind];
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix,
    // No analytics writes: they would add Redis commands to every request.
    analytics: false,
    // The guard races the whole lookup against its own budget, so the limiter's internal
    // timeout (which resolves success:true after 5 s by default) is disabled.
    timeout: 0,
  });
}

/**
 * Sliding-window limiters for the API guard, built once per Redis client. Each keeps the
 * library's default in-memory cache of identifiers that are currently blocked, so repeated
 * requests from a blocked identifier are answered without a Redis call until the window resets.
 *
 * @param {Redis} redis - The client the limiters run their scripts on.
 * @returns {Limiters} One limiter per route class.
 */
export function getLimiters(redis: Redis): Limiters {
  const existing = cache.get(redis);
  if (existing) return existing;

  const limiters: Limiters = {
    api: createLimiter(redis, 'api'),
    apiv1: createLimiter(redis, 'apiv1'),
    auth: createLimiter(redis, 'auth'),
    guestbook: createLimiter(redis, 'guestbook'),
    slow: createLimiter(redis, 'slow'),
  };
  cache.set(redis, limiters);
  return limiters;
}
