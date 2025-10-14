import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';
import { get } from '@/lib/http-clients/effect-fetcher';
import { ensureBaseError } from '@/classes/error';
import { config } from '@/config';

interface DiscordUser {
  username: string;
  discriminator: string;
  avatar: string;
  id: string;
}

interface Activity {
  name: string;
  type: number;
  state?: string;
  details?: string;
}

interface LanyardData {
  discord_user: DiscordUser;
  activities: Activity[];
  discord_status: string;
}

// Schema for Lanyard API response
const DiscordUserSchema = Schema.Struct({
  username: Schema.String,
  discriminator: Schema.String,
  avatar: Schema.String,
  id: Schema.String,
});

const ActivitySchema = Schema.Struct({
  name: Schema.String,
  type: Schema.Number,
  state: Schema.optional(Schema.String),
  details: Schema.optional(Schema.String),
});

const LanyardDataSchema = Schema.Struct({
  discord_user: DiscordUserSchema,
  activities: Schema.Array(ActivitySchema),
  discord_status: Schema.String,
});

const LanyardResponseSchema = Schema.Struct({
  data: LanyardDataSchema,
});

const CACHE_DURATION = 60 * 1000;
let cache: { data: LanyardData; timestamp: number } | null = null;

export async function getLanyardData(): Promise<LanyardData> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  const effect = pipe(
    get(`https://api.lanyard.rest/v1/users/${config.discord.id}`, {
      schema: LanyardResponseSchema,
      retries: 2,
      timeout: 10_000,
    }),
    Effect.provide(FetchHttpClient.layer),
  );

  try {
    const response = await Effect.runPromise(effect);
    const lanyard = response.data as any as LanyardData;
    cache = { data: lanyard, timestamp: Date.now() };

    return lanyard;
  } catch (error) {
    throw ensureBaseError(error, 'lanyard:fetch', {
      discordId: config.discord.id,
      cacheExpired: !cache || Date.now() - cache.timestamp >= CACHE_DURATION,
    });
  }
}
