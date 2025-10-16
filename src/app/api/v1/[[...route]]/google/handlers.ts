import { getAnalytics } from '@/lib';
import { logger } from '@/utils';

interface GoogleAnalyticsData {
  total_pageviews?: number;
}

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
