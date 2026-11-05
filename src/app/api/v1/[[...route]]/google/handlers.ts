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
import { processGlobal, resetProcessGlobal } from '@/lib/cache/process-global';
import { logger } from '@/utils';

export const GoogleAnalyticsSchema = Schema.Struct({
  total_pageviews: Schema.Union(Schema.Number, Schema.Literal(0)),
});
export type GoogleAnalyticsData = Schema.Schema.Type<typeof GoogleAnalyticsSchema>;

const CACHE_DURATION = 60 * 60 * 1000;

interface CachedAnalytics {
  readonly data: GoogleAnalyticsData;
  readonly timestamp: number;
}

/**
 * What getGoogleAnalytics keeps between calls. Next bundles this module once for the /stats page
 * (whose prefetch calls getGoogleAnalytics directly) and once for /api/v1, so module state would
 * give each its own cache and spend the Analytics quota twice. Kept in processGlobal instead, a
 * prefetch that misses its deadline still fills the cache the card's fallback request to
 * /api/v1/google reads, or that request joins the load still running.
 */
interface GoogleAnalyticsState {
  /** The last answer and when it arrived. A failed load's zero fallback is never cached. */
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

const isFresh = (cache: CachedAnalytics | null): cache is CachedAnalytics =>
  cache !== null && Date.now() - cache.timestamp < CACHE_DURATION;

/**
 * Asks Google Analytics again and caches the answer in `state`, the store that was current when
 * the load started (so one that outlives a test's reset never fills the next test's cache).
 */
async function refreshGoogleAnalytics(state: GoogleAnalyticsState): Promise<GoogleAnalyticsData> {
  const fallbackData = {
    total_pageviews: 0,
  };

  try {
    logger.info('[Google Handler] Fetching fresh analytics data...');
    const result = await getAnalytics();
    const analytics: GoogleAnalyticsData = result?.analytics || fallbackData;

    logger.info('[Google Handler] Received analytics:', { analytics });
    state.cache = { data: analytics, timestamp: Date.now() };
    return analytics;
  } catch (analyticsError) {
    logger.error('[Google Handler] Error fetching analytics:', analyticsError);
    logger.info('[Google Handler] Returning fallback data');
    return fallbackData;
  }
}

export async function getGoogleAnalytics(): Promise<GoogleAnalyticsData> {
  const state = sharedState();
  if (isFresh(state.cache)) {
    logger.info('[Google Handler] Returning cached data:', { cache: state.cache.data });
    return state.cache.data;
  }

  // One load at a time: a late prefetch and the card's own request share one Analytics report.
  state.inFlight ??= refreshGoogleAnalytics(state).finally(() => {
    state.inFlight = null;
  });
  return state.inFlight;
}
