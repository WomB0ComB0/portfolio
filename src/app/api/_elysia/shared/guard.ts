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

import { apiGuard } from '@/lib/security/api-guard';

/** The parts of Elysia's pre-routing context the hook uses. */
interface GuardHookContext {
  request: Request;
  set: {
    status?: number;
    headers: Record<string, string | number>;
  };
}

/** Body of a 403 from the guard. */
export const FORBIDDEN_BODY = { error: 'Forbidden' } as const;
/** Body of a 429 from the guard (the same text as the in-process limiter's response). */
export const TOO_MANY_REQUESTS_BODY = { error: 'Too many requests' } as const;

/**
 * Seconds until `reset` (a Unix time in ms), rounded up and at least 1, for Retry-After.
 *
 * @param {number} reset - When the window resets, in ms.
 * @param {number} now - Current time in ms.
 * @returns {number} Whole seconds to wait.
 */
export function secondsUntil(reset: number, now: number): number {
  const seconds = Math.ceil((reset - now) / 1000);
  return Number.isFinite(seconds) && seconds > 1 ? seconds : 1;
}

/**
 * Elysia `onRequest` hook for createElysiaApp: runs the API guard before routing and body
 * parsing, and answers 403 (banned) or 429 (rate limited) itself. Returning undefined lets the
 * request continue.
 *
 * Both responses carry `Cache-Control: no-store`, because public API responses are otherwise
 * cacheable at the CDN and a cached 403/429 would be served to other clients.
 *
 * @param {GuardHookContext} context - Elysia's request context.
 * @returns {Promise<object | undefined>} The error body, or undefined to continue.
 */
export async function apiGuardHook({ request, set }: GuardHookContext) {
  const verdict = await apiGuard.check(request);

  if (verdict.kind === 'ban') {
    set.status = 403;
    set.headers['cache-control'] = 'no-store';
    return FORBIDDEN_BODY;
  }

  if (verdict.kind === 'limit') {
    const retryAfter = secondsUntil(verdict.reset, Date.now());
    set.status = 429;
    set.headers['cache-control'] = 'no-store';
    set.headers['retry-after'] = String(retryAfter);
    set.headers['ratelimit-limit'] = String(verdict.limit);
    set.headers['ratelimit-remaining'] = '0';
    set.headers['ratelimit-reset'] = String(retryAfter);
    return TOO_MANY_REQUESTS_BODY;
  }

  return undefined;
}
