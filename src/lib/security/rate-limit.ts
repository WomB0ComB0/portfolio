import type { RateLimitHelper } from './rate-limit.types';

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
import { redis } from '@/classes/redis';
import { Logger } from '@/utils';
import { isIdentifierBanned, isIdentifierSlowed } from './banlist';

/**
 * Map of rate limiters for various strategies, configured for different purposes (e.g., auth, API, AI).
 *
 * @readonly
 * @private
 * @type {Record<string, Ratelimit>}
 * @author Mike Odnis (@WomB0ComB0)
 */
const limiter = {
  default: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '10 s'),
    analytics: true,
    prefix: 'ratelimit:default',
  }),
  forcedSlowMode: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1, '30 s'),
    analytics: true,
    prefix: 'ratelimit:slowmode',
  }),
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '10 s'),
    analytics: true,
    prefix: 'ratelimit:auth',
  }),
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '60 s'),
    analytics: true,
    prefix: 'ratelimit:api',
  }),
  apiv1: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '60 s'),
    analytics: true,
    prefix: 'ratelimit.apiv1',
  }),
  ai: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '24 h'),
    analytics: true,
    prefix: 'ratelimit:ai',
  }),
} as const satisfies Record<string, Ratelimit>;

/**
 * Returns a rate limiting function for a given type, allowing enforcement of
 * different limiting policies based on the identifier and configuration.
 *
 * The returned function handles internal checks for permanent bans or slow-modes,
 * and logs actions taken. If an identifier is banned, it returns a response with
 * zero remaining credits. If slowed, applies more aggressive limits.
 *
 * @function
 * @public
 * @web
 * @author Mike Odnis (@WomB0ComB0)
 * @version 1.1.0
 * @param {'default'|'forcedSlowMode'|'auth'|'api'|'apiv1'|'ai'} [rateLimitingType='default'] - Indicates the type of rate limiting to use. Defaults to 'default'.
 * @returns {(params: RateLimitHelper) => Promise<any>} An async rate limiting function tailored to the type selected.
 * @throws {Error} Throws if underlying Upstash or banlist operations throw.
 * @example
 * // Basic usage for the default limiter:
 * const limiter = rateLimiter();
 * const res = await limiter({ identifier: 'user-ip-or-id' });
 * if (!res.success) { throw new Error('Rate limited!'); }
 * @see {@link https://github.com/upstash/ratelimit}
 * @see RateLimitHelper
 * @async
 */
export const rateLimiter = (rateLimitingType: RateLimitHelper['rateLimitingType'] = 'default') => {
  const log = Logger.getLogger(`RateLimit:${rateLimitingType}`);

  /**
   * Checks the rate limit status for a given identifier and applies ban or slow rules.
   *
   * @param {RateLimitHelper} params - The parameters containing the identifier and (optional) rate limiting type.
   * @returns {Promise<any>} The Upstash Ratelimit response object or a custom rejected response for banned users.
   * @throws {Error} On internal limiter or database errors.
   * @async
   * @protected
   */
  return async function rateLimit({ identifier }: RateLimitHelper) {
    // Check if identifier is permanently banned (returns 403-equivalent)
    if (await isIdentifierBanned(identifier)) {
      log.info('Hard-banned identifier blocked', { identifier });
      // Return a rate limit response that will be rejected
      return {
        success: false,
        remaining: 0,
        limit: 0,
        reset: Math.floor(Date.now() / 1_000),
        pending: Promise.resolve(),
      };
    }

    // Check if identifier should be rate-limited more aggressively
    if (await isIdentifierSlowed(identifier)) {
      log.info('Slow-mode identifier detected', { identifier });
      return limiter.forcedSlowMode.limit(identifier);
    }

    log.info('Rate limiting', { identifier });
    return limiter[rateLimitingType].limit(identifier);
  };
};

/**
 * Utility to convert a rate limit reset timestamp (in seconds) to a formatted locale string for display.
 *
 * @function
 * @public
 * @web
 * @author Mike Odnis (@WomB0ComB0)
 * @version 1.0.0
 * @param {number} result - The reset value in seconds since UNIX epoch.
 * @returns {string} The formatted date/time string.
 * @example
 * getRateLimitReset(1717991018); // → "6/10/2024, 10:43:38 AM"
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleString}
 */
export const getRateLimitReset = (result: number) => new Date(result * 1000).toLocaleString();
