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
 * Route classes the API guard limits separately:
 * - `api`: /api/* (30 requests per 60 s)
 * - `apiv1`: /api/v1/* (60 requests per 60 s)
 * - `auth`: /api/admin/* (5 requests per 10 s)
 * - `slow`: any route, for IPs on the slow list (1 request per 30 s)
 */
export type LimiterKind = 'api' | 'apiv1' | 'auth' | 'slow';

/** The part of a rate-limit result the guard uses. `reset` is a Unix time in milliseconds. */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/** Anything that can count one request against an identifier (an Upstash Ratelimit, or a fake). */
export interface RateLimiter {
  limit(identifier: string): Promise<RateLimitResult>;
}

/** One limiter per route class. */
export type Limiters = Readonly<Record<LimiterKind, RateLimiter>>;
