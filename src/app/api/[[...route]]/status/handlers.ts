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
import { processGlobal, resetProcessGlobal } from '@/lib/cache/process-global';
import { STALE_RETRY_BACKOFF_MS } from '@/lib/cache/stale-cache';
import { FetcherError, get } from '@/lib/http-clients/effect-fetcher';
import type { ServiceStatus } from './schema';

// Schema for Better Stack Monitor attributes
const BetterStackMonitorAttributesSchema = Schema.Struct({
  url: Schema.String,
  pronounceable_name: Schema.String,
  monitor_type: Schema.String,
  status: Schema.Union(
    Schema.Literal('up'),
    Schema.Literal('down'),
    Schema.Literal('paused'),
    Schema.Literal('validating'),
    Schema.Literal('maintenance'),
  ),
  paused: Schema.Boolean,
  last_checked_at: Schema.NullOr(Schema.String),
  created_at: Schema.String,
  updated_at: Schema.String,
});

// Schema for Better Stack Monitor
const BetterStackMonitorSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal('monitor'),
  attributes: BetterStackMonitorAttributesSchema,
});

// Schema for Better Stack Monitors API response
const BetterStackMonitorsResponseSchema = Schema.Struct({
  data: Schema.Array(BetterStackMonitorSchema),
});

export type BetterStackMonitor = Schema.Schema.Type<typeof BetterStackMonitorSchema>;
export type BetterStackMonitorsResponse = Schema.Schema.Type<
  typeof BetterStackMonitorsResponseSchema
>;

type ServiceState = ServiceStatus['state'];
type MonitorCounts = NonNullable<ServiceStatus['monitors']>;
type MonitorStatus = BetterStackMonitor['attributes']['status'];

const MONITORS_URL = 'https://uptime.betterstack.com/api/v2/monitors';
const CACHE_DURATION = 60 * 1_000; // 60 seconds
/** After a failure with nothing cached, the 'unknown' fallback is kept this long, then retried. */
const FALLBACK_TTL_MS = 10_000;
/**
 * After a failure with an answer cached, that answer is served (marked stale) this long without
 * asking Better Stack, like createStaleCache's backoff. A failing Better Stack then costs one
 * request per backoff, not one per page view.
 */
const RETRY_BACKOFF_MS = STALE_RETRY_BACKOFF_MS;
/** Upstream time budget, as for the /stats sources: one retry of a 3.5 s attempt. */
const ATTEMPT_TIMEOUT_MS = 3_500;
const RETRY_DELAY_MS = 500;
/** Caps the attempts together, retries and body reads included. */
const UPSTREAM_DEADLINE_MS = 8_000;
const STALE_MESSAGE = 'Using cached status data due to API error';
const FALLBACK_MESSAGE = 'Unable to fetch current status - please try again later';

interface CachedStatus {
  readonly data: ServiceStatus;
  readonly timestamp: number;
}

/** What a failed check left to serve, and until when it is served instead of asking again. */
interface FailedCheck {
  readonly answer: ServiceStatus;
  /** Epoch ms. */
  readonly retryAt: number;
}

/**
 * What handleStatusCheck keeps between calls. Next bundles this module once for the home page
 * (whose status tile calls handleStatusCheck directly) and once for /api/status, so module state
 * would give each its own cache. Kept in processGlobal instead, a check the page stopped waiting
 * for still fills the cache the footer's and the tile's requests to /api/status read, or those
 * requests join the check still running, rather than asking Better Stack a second time.
 */
interface StatusStore {
  /** Better Stack's last answer and when it came. Never the 'unknown' fallback. */
  cache: CachedStatus | null;
  /** The last check failed: what to answer until its retryAt. Cleared by a good answer. */
  failure: FailedCheck | null;
  /** The check running now; every caller that finds the cache expired joins it. */
  inFlight: Promise<ServiceStatus> | null;
}

const STORE_NAME = 'status.cache';

/** Looked up on every call, so a reset in a test takes effect without reloading this module. */
const sharedStore = (): StatusStore =>
  processGlobal<StatusStore>(STORE_NAME, () => ({ cache: null, failure: null, inFlight: null }));

/** Forgets the cached status, any failure's backoff and any running check. Tests only. */
export function resetStatusCache(): void {
  resetProcessGlobal(STORE_NAME);
}

const isFresh = (cache: CachedStatus | null): cache is CachedStatus =>
  cache !== null && Date.now() - cache.timestamp < CACHE_DURATION;

const countWithStatus = (monitors: readonly BetterStackMonitor[], status: MonitorStatus): number =>
  monitors.filter((monitor) => monitor.attributes.status === status).length;

/**
 * The overall state of the active monitors: any down is down, any in maintenance (or a mix with
 * validating ones) is degraded, all up (or none active) is operational.
 */
function overallState(active: readonly BetterStackMonitor[], up: number): ServiceState {
  if (active.length === 0) return 'operational';
  if (countWithStatus(active, 'down') > 0) return 'down';
  if (countWithStatus(active, 'maintenance') > 0) return 'degraded';
  return up === active.length ? 'operational' : 'degraded';
}

/** The state and up count of the monitors that are not paused. */
function summarizeMonitors(monitors: readonly BetterStackMonitor[]): {
  state: ServiceState;
  monitors: MonitorCounts;
} {
  const active = monitors.filter((monitor) => !monitor.attributes.paused);
  const up = countWithStatus(active, 'up');
  return { state: overallState(active, up), monitors: { up, total: active.length } };
}

const fetchMonitors = () =>
  pipe(
    get(MONITORS_URL, {
      schema: BetterStackMonitorsResponseSchema,
      retries: 1,
      retryDelay: RETRY_DELAY_MS,
      timeout: ATTEMPT_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${env.BETTERSTACK_API_KEY}`,
      },
    }),
    Effect.timeoutFail({
      duration: UPSTREAM_DEADLINE_MS,
      onTimeout: () =>
        new FetcherError(
          `Better Stack did not answer within ${UPSTREAM_DEADLINE_MS} ms`,
          MONITORS_URL,
        ),
    }),
    Effect.provide(FetchHttpClient.layer),
  );

/** The cached answer as served after a failed check: flagged stale, with the reason. */
const staleAnswer = (data: ServiceStatus): ServiceStatus => ({
  ...data,
  message: STALE_MESSAGE,
  stale: true,
});

/**
 * Asks Better Stack and caches the answer in `store`, the one that was current when the check
 * started (so one that outlives a test's reset never fills the next test's cache). On failure the
 * cached answer is returned marked stale and served for the backoff without asking again; with
 * nothing cached, the 'unknown' fallback is served briefly and the error is thrown.
 */
async function refreshStatus(store: StatusStore): Promise<ServiceStatus> {
  try {
    const response = await Effect.runPromise(fetchMonitors());
    const summary = summarizeMonitors(response.data);
    const result: ServiceStatus = {
      state: summary.state,
      lastUpdated: new Date().toISOString(),
      monitors: summary.monitors,
    };
    store.cache = { data: result, timestamp: Date.now() };
    store.failure = null;
    return result;
  } catch (error) {
    // The last answer, even expired, beats failing completely.
    if (store.cache) {
      const answer = staleAnswer(store.cache.data);
      store.failure = { answer, retryAt: Date.now() + RETRY_BACKOFF_MS };
      return answer;
    }

    const fallback: ServiceStatus = {
      state: 'unknown',
      message: FALLBACK_MESSAGE,
      lastUpdated: new Date().toISOString(),
    };
    // Sooner than the backoff: with nothing to show, the next check is worth more.
    store.failure = { answer: fallback, retryAt: Date.now() + FALLBACK_TTL_MS };

    throw ensureBaseError(error, 'status:fetch', {
      apiEndpoint: 'monitors',
      fallbackProvided: true,
    });
  }
}

/**
 * Better Stack's last answer, however old, or undefined when it never answered in this process.
 * One older than the minute's cache is flagged `stale` (its `lastUpdated` says when). Never asks
 * Better Stack and never waits on a running check: for the home page's server snapshot, whose
 * deadline is shorter than one check may take. That check keeps running and fills the cache.
 */
export function peekServiceStatus(): ServiceStatus | undefined {
  const { cache } = sharedStore();
  if (!cache) return undefined;
  // Read before isFresh, whose false branch narrows `cache` to never.
  const { data } = cache;
  return isFresh(cache) ? data : { ...data, stale: true };
}

/**
 * The service status from the Better Stack monitors, with how many active monitors are up.
 * Cached for a minute and shared by every copy of this module in the process.
 *
 * - After a failed check, the last answer is served with `stale: true` (and the 'unknown'
 *   fallback when there is none) until the failure's backoff ends; only then is Better Stack
 *   asked again. One check takes at most UPSTREAM_DEADLINE_MS.
 *
 * @throws {BaseError} When Better Stack fails and nothing is cached yet.
 */
export async function handleStatusCheck(): Promise<ServiceStatus> {
  const store = sharedStore();
  if (isFresh(store.cache)) return store.cache.data;
  if (store.failure && Date.now() < store.failure.retryAt) return store.failure.answer;

  // One check at a time: the home page and /api/status share Better Stack's answer.
  store.inFlight ??= refreshStatus(store).finally(() => {
    store.inFlight = null;
  });
  return store.inFlight;
}
