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
 * @file Per-request ban and rate-limit check for the Elysia API (/api and /api/v1).
 *
 * One parallel Redis round trip per request: a pipelined read of the client's IP on the ban list,
 * the client's IP on the slow list and the active CIDR bans, alongside the sliding-window counter
 * for the route class. The whole lookup is raced against a time budget. When Redis is slow or
 * failing, the guard allows the request and stops calling Redis for a cooldown period; the
 * in-process limiter in createElysiaApp still applies during that time.
 *
 * Not exported from the '@/lib' or '@/lib/security' barrels: the API imports it directly.
 */

import * as Sentry from '@sentry/nextjs';
import type { Redis } from '@upstash/redis';
import { GUARD_BUDGET_MS, getGuardRedis } from '@/classes/redis-guard';
import { Logger } from '@/utils';
import { BAN_KEYS, isActiveScore, MAX_ACTIVE_CIDRS } from './ban-keys';
import { getClientIP } from './get-ip';
import { findMatchingCidr, isLoopbackIp, normalizeIp, rateLimitKey } from './ip';
import { getLimiters } from './rate-limit';
import type { LimiterKind, Limiters, RateLimitResult } from './rate-limit.types';

const log = Logger.getLogger('ApiGuard');

/** How long the guard skips Redis once lookups keep failing or timing out. */
export const GUARD_COOLDOWN_MS = 30_000;

/**
 * Consecutive failed or timed-out lookups before the guard skips Redis for the cooldown. One slow
 * lookup, such as a new instance's first connection, lets that request through without turning
 * the checks off for everyone else on the instance.
 */
export const GUARD_FAILURE_THRESHOLD = 2;

/** Rate-limit identifier for requests whose client IP header is not a valid address. */
export const UNKNOWN_CLIENT_KEY = 'unknown';

/** The ban-list entries relevant to one client (see ./ban-keys.ts). */
export interface BanLookupResult {
  /** Score (expiry, ms) of the IP in `bans:ip`, or null. */
  ipScore: unknown;
  /** Score (expiry, ms) of the IP in `bans:slow`, or null. */
  slowScore: unknown;
  /** Members of `bans:cidr` that have not expired. */
  cidrs: readonly unknown[];
}

/** Read access to the ban sorted sets. */
export interface BanLookup {
  /**
   * Reads, in one request, the IP's ban and slow-list scores and up to `maxCidrs` active CIDR
   * bans (score greater than `now`).
   */
  lookup(ip: string, now: number, maxCidrs: number): Promise<BanLookupResult>;
}

/** What the guard talks to: the ban lists and one limiter per route class. */
export interface GuardBackend {
  bans: BanLookup;
  limiters: Limiters;
}

/** Outcome of a check. `reset` is a Unix time in milliseconds. */
export type GuardVerdict =
  | { kind: 'allow' }
  | { kind: 'ban' }
  | { kind: 'limit'; limit: number; reset: number };

/** How a route is guarded. */
export interface GuardPolicy {
  /** Whether the ban and slow lists apply. */
  checkBans: boolean;
  /** Which sliding-window limiter counts the request. */
  limiter: Exclude<LimiterKind, 'slow'>;
}

export interface ApiGuardOptions {
  /** The Redis-backed lists and limiters, or null when Redis is not configured (allow all). */
  getBackend: () => GuardBackend | null;
  /** Clock in milliseconds. */
  now?: () => number;
  /** Time budget for one lookup. */
  budgetMs?: number;
  /** How long to skip Redis once the failure threshold is reached. */
  cooldownMs?: number;
  /** Consecutive failed or timed-out lookups that start the cooldown. */
  failureThreshold?: number;
  /** Error reporter, called once each time the guard starts skipping Redis. */
  report?: (error: unknown) => void;
}

export interface ApiGuard {
  /** Never throws: on any internal failure the verdict is 'allow'. */
  check(request: Request): Promise<GuardVerdict>;
}

/** Raised when a lookup exceeds its time budget. */
export class GuardTimeoutError extends Error {
  constructor(budgetMs: number) {
    super(`API guard lookup exceeded ${budgetMs} ms`);
    this.name = 'GuardTimeoutError';
  }
}

const ALLOW: GuardVerdict = { kind: 'allow' };
const BAN: GuardVerdict = { kind: 'ban' };
const NOT_LISTED: BanLookupResult = { ipScore: null, slowScore: null, cidrs: [] };
const TIMED_OUT = Symbol('timed-out');

const isUnder = (pathname: string, prefix: string): boolean =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * Route policy for a request, or null when the request is not guarded at all.
 *
 * - CORS preflights (OPTIONS) and /api/health (and its sub-paths) are not guarded.
 * - /api/admin/* is not subject to the ban or slow lists, so an operator cannot lock themselves
 *   out of the ban API; it is still limited by the 'auth' limiter and requires its bearer token.
 * - /api/v1/* uses the 'apiv1' limiter; every other /api path uses 'api'.
 *
 * @param {string} method - HTTP method.
 * @param {string} pathname - URL path, e.g. '/api/v1/blog'.
 * @returns {GuardPolicy | null} The policy, or null for unguarded requests.
 */
export function classifyRequest(method: string, pathname: string): GuardPolicy | null {
  if (method.toUpperCase() === 'OPTIONS') return null;
  if (isUnder(pathname, '/api/health')) return null;
  if (isUnder(pathname, '/api/admin')) return { checkBans: false, limiter: 'auth' };
  if (isUnder(pathname, '/api/v1')) return { checkBans: true, limiter: 'apiv1' };
  return { checkBans: true, limiter: 'api' };
}

const toLimitVerdict = (result: RateLimitResult): GuardVerdict => ({
  kind: 'limit',
  limit: result.limit,
  reset: result.reset,
});

/** Starts a call right away, turning a synchronous throw into a rejected promise. */
function attempt<T>(call: () => Promise<T>): Promise<T> {
  try {
    return call();
  } catch (error) {
    return Promise.reject(error);
  }
}

/** A verdict, and whether any Redis call behind it failed. */
interface Evaluation {
  verdict: GuardVerdict;
  failed: boolean;
  error?: unknown;
}

async function evaluate(
  { bans, limiters }: GuardBackend,
  policy: GuardPolicy,
  ip: string | null,
  now: number,
): Promise<Evaluation> {
  const key = ip ? rateLimitKey(ip) : UNKNOWN_CLIENT_KEY;
  const banIp = policy.checkBans ? ip : null;

  // The ban-list read and the limiter run concurrently: one round trip of latency. Each result is
  // used even if the other call fails, so a limiter failure does not lift bans and vice versa.
  const [banRead, limitRead] = await Promise.allSettled([
    banIp ? attempt(() => bans.lookup(banIp, now, MAX_ACTIVE_CIDRS)) : Promise.resolve(NOT_LISTED),
    attempt(() => limiters[policy.limiter].limit(key)),
  ]);
  const rejected = [banRead, limitRead].find((r) => r.status === 'rejected');
  const failure = rejected ? { failed: true, error: rejected.reason } : { failed: false };
  const { ipScore, slowScore, cidrs } = banRead.status === 'fulfilled' ? banRead.value : NOT_LISTED;

  if (banIp) {
    const ipBanned = isActiveScore(ipScore, now);
    const cidr = ipBanned ? null : findMatchingCidr(banIp, cidrs);
    if (ipBanned || cidr) {
      log.info('Blocked banned client', { ip: banIp, ...(cidr ? { cidr } : {}) });
      return { verdict: BAN, ...failure };
    }
  }

  if (limitRead.status === 'fulfilled' && !limitRead.value.success) {
    return { verdict: toLimitVerdict(limitRead.value), ...failure };
  }

  if (banIp && isActiveScore(slowScore, now)) {
    try {
      const slowed = await limiters.slow.limit(key);
      if (!slowed.success) return { verdict: toLimitVerdict(slowed), ...failure };
    } catch (error) {
      return { verdict: ALLOW, ...(failure.failed ? failure : { failed: true, error }) };
    }
  }

  return { verdict: ALLOW, ...failure };
}

/**
 * Builds a guard. Production code uses the default {@link apiGuard}; tests pass fakes.
 *
 * @param {ApiGuardOptions} options - Backend, clock, budget, cooldown and reporter.
 * @returns {ApiGuard} The guard.
 */
export function createApiGuard({
  getBackend,
  now = () => Date.now(),
  budgetMs = GUARD_BUDGET_MS,
  cooldownMs = GUARD_COOLDOWN_MS,
  failureThreshold = GUARD_FAILURE_THRESHOLD,
  report = (error) => {
    Sentry.captureException(error);
  },
}: ApiGuardOptions): ApiGuard {
  /** Until this time (ms), the guard allows without calling Redis. */
  let skipUntil = 0;
  /** Failed or timed-out lookups since the last one that succeeded. */
  let consecutiveFailures = 0;

  const trip = (error: unknown, at: number): void => {
    consecutiveFailures += 1;
    if (consecutiveFailures < failureThreshold) {
      log.warn('API guard lookup failed; allowing this request', {
        consecutiveFailures,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    const alreadyOpen = now() < skipUntil;
    skipUntil = Math.max(skipUntil, at + cooldownMs);
    if (alreadyOpen) return;
    log.warn('API guard lookup failed; allowing requests without Redis checks', {
      cooldownMs,
      error: error instanceof Error ? error.message : String(error),
    });
    try {
      report(error);
    } catch {
      // Reporting must never affect the request.
    }
  };

  const check = async (request: Request): Promise<GuardVerdict> => {
    let policy: GuardPolicy | null;
    let ip: string | null;
    let backend: GuardBackend | null;
    const startedAt = now();
    try {
      policy = classifyRequest(request.method, new URL(request.url).pathname);
      if (!policy) return ALLOW;
      ip = normalizeIp(getClientIP(request));
      if (ip && isLoopbackIp(ip)) return ALLOW;
      if (startedAt < skipUntil) return ALLOW;
      backend = getBackend();
      if (!backend) return ALLOW;
    } catch (error) {
      log.error('API guard could not inspect the request', error);
      return ALLOW;
    }

    const lookup = evaluate(backend, policy, ip, startedAt);
    // After a timeout nothing awaits `lookup`; this keeps its late rejection handled.
    lookup.catch(() => undefined);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<typeof TIMED_OUT>((resolve) => {
      timer = setTimeout(() => resolve(TIMED_OUT), budgetMs);
    });

    try {
      const outcome = await Promise.race([lookup, deadline]);
      if (outcome === TIMED_OUT) {
        trip(new GuardTimeoutError(budgetMs), startedAt);
        return ALLOW;
      }
      if (outcome.failed) trip(outcome.error, startedAt);
      else consecutiveFailures = 0;
      return outcome.verdict;
    } catch (error) {
      trip(error, startedAt);
      return ALLOW;
    } finally {
      clearTimeout(timer);
    }
  };

  return { check };
}

/**
 * Adapts the Upstash client to {@link BanLookup}. The three reads go out as one explicit
 * pipeline, so they cost a single HTTP request.
 *
 * @param {Redis} redis - The guard client (see '@/classes/redis-guard').
 * @returns {BanLookup} Sorted-set reads used by the guard.
 */
export function redisBanLookup(redis: Redis): BanLookup {
  return {
    lookup: async (ip, now, maxCidrs) => {
      const [ipScore, slowScore, cidrs] = await redis
        .pipeline()
        .zscore(BAN_KEYS.ip, ip)
        .zscore(BAN_KEYS.slow, ip)
        .zrange(BAN_KEYS.cidr, `(${now}` as `(${number}`, '+inf', {
          byScore: true,
          offset: 0,
          count: maxCidrs,
        })
        .exec<[unknown, unknown, unknown[]]>();
      return { ipScore, slowScore, cidrs: Array.isArray(cidrs) ? cidrs : [] };
    },
  };
}

let defaultBackend: GuardBackend | null | undefined;

function getDefaultBackend(): GuardBackend | null {
  if (defaultBackend !== undefined) return defaultBackend;
  const redis = getGuardRedis();
  defaultBackend = redis ? { bans: redisBanLookup(redis), limiters: getLimiters(redis) } : null;
  return defaultBackend;
}

/** The guard used by createElysiaApp, backed by the dedicated guard Redis client. */
export const apiGuard: ApiGuard = createApiGuard({ getBackend: getDefaultBackend });
