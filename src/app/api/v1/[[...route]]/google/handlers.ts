import { getAnalytics } from '@/lib';

interface GoogleAnalyticsData {
  total_pageviews?: number;
}

const CACHE_DURATION = 60 * 60 * 1000;
let cache: { data: GoogleAnalyticsData; timestamp: number } | null = null;

export async function getGoogleAnalytics(): Promise<GoogleAnalyticsData> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    console.log('[Google Handler] Returning cached data:', cache.data);
    return cache.data;
  }

  const fallbackData = {
    total_pageviews: 0,
  };

  try {
    console.log('[Google Handler] Fetching fresh analytics data...');
    const result = await getAnalytics();
    const analytics: GoogleAnalyticsData = result?.analytics || fallbackData;

    console.log('[Google Handler] Received analytics:', analytics);
    cache = { data: analytics, timestamp: Date.now() };
    return analytics;
  } catch (analyticsError) {
    console.error('[Google Handler] Error fetching analytics:', analyticsError);
    console.error('[Google Handler] Returning fallback data');
    return fallbackData;
  }
}
