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

import { ensureBaseError } from '@/classes/error';
import { config } from '@/config';
import { get } from '@/lib/http-clients/effect-fetcher';
import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';

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

export type Activity = Schema.Schema.Type<typeof ActivitySchema>;
export type DiscordUser = Schema.Schema.Type<typeof DiscordUserSchema>;
export type LanyardData = Schema.Schema.Type<typeof LanyardDataSchema>;

const CACHE_DURATION = 60 * 1_000;
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
