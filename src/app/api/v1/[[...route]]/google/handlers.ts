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

import { getAnalytics } from '@/lib';
import { logger } from '@/utils';
import { Schema } from 'effect';

export const GoogleAnalyticsSchema = Schema.Struct({
  total_pageviews: Schema.Union(Schema.Number, Schema.Literal(0)),
});
export type GoogleAnalyticsData = Schema.Schema.Type<typeof GoogleAnalyticsSchema>;

const CACHE_DURATION = 60 * 60 * 1000;
let cache: { data: GoogleAnalyticsData; timestamp: number } | null = null;

export async function getGoogleAnalytics(): Promise<GoogleAnalyticsData> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    logger.info('[Google Handler] Returning cached data:', { cache: cache.data });
    return cache.data;
  }

  const fallbackData = {
    total_pageviews: 0,
  };

  try {
    logger.info('[Google Handler] Fetching fresh analytics data...');
    const result = await getAnalytics();
    const analytics: GoogleAnalyticsData = result?.analytics || fallbackData;

    logger.info('[Google Handler] Received analytics:', { analytics });
    cache = { data: analytics, timestamp: Date.now() };
    return analytics;
  } catch (analyticsError) {
    logger.error('[Google Handler] Error fetching analytics:', analyticsError);
    logger.info('[Google Handler] Returning fallback data');
    return fallbackData;
  }
}
