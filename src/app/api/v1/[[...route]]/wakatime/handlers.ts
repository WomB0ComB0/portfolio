import axios from 'axios';

interface WakaTimeData {
  text: string;
  digital: string;
  decimal: string;
  total_seconds: number;
}

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
let cache: { data: WakaTimeData; timestamp: number } | null = null;

export async function getWakaTimeData(): Promise<WakaTimeData> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  const resp = await axios.get('https://wakatime.com/api/v1/users/current/all_time_since_today', {
    headers: {
      Authorization: `Basic ${btoa(process.env.WAKA_TIME_API_KEY as string)}`,
    },
  });

  if (resp.status !== 200) {
    throw new Error(`WakaTime API responded with status ${resp.status}`);
  }

  const response = resp.data;
  const data: WakaTimeData = response.data;
  cache = { data, timestamp: Date.now() };

  return data;
}
