import { Effect, pipe, Schema } from 'effect';
import { FetchHttpClient } from '@effect/platform';
import { get } from '@/lib/http-clients/effect-fetcher';

interface WakaTimeData {
  text: string;
  digital: string;
  decimal: string;
  total_seconds: number;
}

// Schema for WakaTime API response
const WakaTimeDataSchema = Schema.Struct({
  text: Schema.String,
  digital: Schema.String,
  decimal: Schema.String,
  total_seconds: Schema.Number,
});

const WakaTimeResponseSchema = Schema.Struct({
  data: WakaTimeDataSchema,
});

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
let cache: { data: WakaTimeData; timestamp: number } | null = null;

export async function getWakaTimeData(): Promise<WakaTimeData> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  const effect = pipe(
    get('https://wakatime.com/api/v1/users/current/all_time_since_today', {
      headers: {
        Authorization: `Basic ${btoa(process.env.WAKA_TIME_API_KEY as string)}`,
      },
      schema: WakaTimeResponseSchema,
      retries: 2,
      timeout: 10_000,
    }),
    Effect.provide(FetchHttpClient.layer),
  );

  try {
    const response = await Effect.runPromise(effect);
    const data = response.data as any as WakaTimeData;
    cache = { data, timestamp: Date.now() };

    return data;
  } catch (error) {
    console.error('Error fetching WakaTime data:', error);
    throw error;
  }
}
