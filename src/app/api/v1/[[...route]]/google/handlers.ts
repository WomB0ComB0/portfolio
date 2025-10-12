import { getAnalytics } from '@/lib';

interface GoogleAnalyticsData {
  total_pageviews?: number;
}

const CACHE_DURATION = 60 * 60 * 1000;
let cache: { data: GoogleAnalyticsData; timestamp: number } | null = null;

export async function getGoogleAnalytics(): Promise<GoogleAnalyticsData> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  const fallbackData = {
    total_pageviews: 0,
  };

  try {
    const result = await getAnalytics();
    const analytics: GoogleAnalyticsData = result?.analytics || fallbackData;

    cache = { data: analytics, timestamp: Date.now() };
    return analytics;
  } catch (analyticsError) {
    console.error('Error fetching analytics:', analyticsError);
    return fallbackData;
  }
}
