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

import { Schema } from 'effect';
import { getAnalytics } from '@/lib';
import { withDeadline } from '@/lib/async/deadline';
import { processGlobal, resetProcessGlobal } from '@/lib/cache/process-global';
import type { CachedValue } from '@/lib/cache/stale-cache';
import { logger } from '@/utils';

export const GoogleAnalyticsSchema = Schema.Struct({
  total_pageviews: Schema.Union([Schema.Number, Schema.Literal(0)]),
});
export type GoogleAnalyticsData = Schema.Schema.Type<typeof GoogleAnalyticsSchema>;

const CACHE_DURATION = 60 * 60 * 1000;

/**
 * Upstream time budget, as in the other /stats handlers. Every caller shares one in-flight report,
 * and runReport's own default timeout is 60 s, so without this one stalled report would fail the
 * page-view stat for every visitor until it gave up. The /stats loaders (console-loaders.ts) stop
 * waiting sooner and let the report carry on, so this deadline is what ends it.
 */
const UPSTREAM_DEADLINE_MS = 8_000;

interface CachedAnalytics {
  readonly data: GoogleAnalyticsData;
  readonly timestamp: number;
}

/**
 * What getGoogleAnalytics keeps between calls. Next bundles this module once for the /stats page
 * (whose loaders in console-loaders.ts call getGoogleAnalytics directly) and once for the /api/v1
 * route, so module state would give each its own cache and spend the Analytics quota twice. Kept
 * in processGlobal instead, a /stats load that misses its deadline (and carries on in the
 * background) still fills the cache a request to /api/v1/google reads, or that request joins the
 * load still running.
 */
interface GoogleAnalyticsState {
  /** The last real report and when it arrived. A failed load caches nothing, a zero least of all. */
  cache: CachedAnalytics | null;
  /** The load running now; every caller that finds the cache expired joins it. */
  inFlight: Promise<GoogleAnalyticsData> | null;
}

const STATE_NAME = 'google.cache';

/** Looked up on every call, so a reset in a test takes effect without reloading this module. */
const sharedState = (): GoogleAnalyticsState =>
  processGlobal<GoogleAnalyticsState>(STATE_NAME, () => ({ cache: null, inFlight: null }));

/** Forgets the cached page views and any running load. Tests only. */
export function resetGoogleAnalyticsCache(): void {
  resetProcessGlobal(STATE_NAME);
}

/** Reads the last real report and when it arrived; a failed load leaves it as it was. */
export function peekGoogleAnalytics(): CachedValue<GoogleAnalyticsData> | undefined {
  const cached = sharedState().cache;
  return cached ? { data: cached.data, loadedAt: cached.timestamp } : undefined;
}

const isFresh = (cache: CachedAnalytics | null): cache is CachedAnalytics =>
  cache !== null && Date.now() - cache.timestamp < CACHE_DURATION;

/** What a failed load answers when no real count was ever cached. Never cached itself. */
const NO_COUNT: GoogleAnalyticsData = { total_pageviews: 0 };

/** A report that counts page views: zero or none is no count, as every reader takes it. */
const hasCount = (data: GoogleAnalyticsData | undefined): data is GoogleAnalyticsData =>
  data !== undefined && Number.isFinite(data.total_pageviews) && data.total_pageviews > 0;

/**
 * Asks Google Analytics again and caches a real count in `state`, the store that was current
 * when the load started (so one that outlives a test's reset never fills the next test's cache).
 * When Analytics fails, or its report counts no page views, nothing is cached: the count already
 * held is answered (it keeps its own date, so a reader can tell it is old), or 0 when there is
 * none, which readers take as no count.
 */
async function refreshGoogleAnalytics(state: GoogleAnalyticsState): Promise<GoogleAnalyticsData> {
  try {
    logger.info('[Google Handler] Fetching fresh analytics data...');
    const result = await withDeadline(getAnalytics(), UPSTREAM_DEADLINE_MS, 'google analytics');
    const analytics = result?.analytics;
    if (hasCount(analytics)) {
      logger.info('[Google Handler] Received analytics:', { analytics });
      state.cache = { data: analytics, timestamp: Date.now() };
      return analytics;
    }
    logger.warn('[Google Handler] The report counts no page views; nothing cached');
  } catch (analyticsError) {
    logger.error('[Google Handler] Error fetching analytics:', analyticsError);
  }
  return state.cache?.data ?? NO_COUNT;
}

export async function getGoogleAnalytics(): Promise<GoogleAnalyticsData> {
  const state = sharedState();
  if (isFresh(state.cache)) {
    logger.info('[Google Handler] Returning cached data:', { cache: state.cache.data });
    return state.cache.data;
  }

  // One load at a time: a /stats load and a request to the /api/v1 route share one report.
  state.inFlight ??= refreshGoogleAnalytics(state).finally(() => {
    state.inFlight = null;
  });
  return state.inFlight;
}
