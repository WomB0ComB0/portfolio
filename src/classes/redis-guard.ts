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
 * @file Upstash client for the API request guard (src/lib/security/api-guard.ts). It is separate
 * from the general client in ./redis.ts, which admin writes keep using, because the per-request
 * lookups need different settings:
 *
 * - `signal` is a FUNCTION, so every HTTP request gets a fresh AbortSignal and an abort rejects.
 *   With a single AbortSignal object, the SDK answers aborted requests with a synthetic
 *   `{ result: <reason> }` instead of throwing, and every later command on that signal would
 *   resolve too, which would read as "not banned".
 * - `retry: { retries: 0 }` makes exactly one attempt (the SDK's default retries with backoff).
 * - `readYourWrites: false`: the guard only reads ban entries and runs the limiter script.
 * - Telemetry headers are off.
 */

import { Redis, type RedisConfigNodejs } from '@upstash/redis';
import { env } from '@/env';

/** Time budget, in ms, for one guard lookup (the per-request HTTP timeout and the outer race). */
export const GUARD_BUDGET_MS = 300;

let client: Redis | null | undefined;

/**
 * Options for the guard client. Exported for tests; use {@link getGuardRedis} at runtime.
 *
 * @param {string} url - Upstash REST URL.
 * @param {string} token - Upstash REST token.
 * @returns {RedisConfigNodejs} The client configuration.
 */
export function guardRedisConfig(url: string, token: string): RedisConfigNodejs {
  return {
    url,
    token,
    signal: () => AbortSignal.timeout(GUARD_BUDGET_MS),
    retry: { retries: 0 },
    readYourWrites: false,
    enableTelemetry: false,
    keepAlive: true,
  };
}

/**
 * The guard's Redis client, created on first use. Returns null when the Upstash URL or token is
 * not configured (local runs and tests), in which case the guard allows every request.
 *
 * @returns {Redis | null} The shared guard client, or null.
 */
export function getGuardRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  client = url && token ? new Redis(guardRedisConfig(url, token)) : null;
  return client;
}
