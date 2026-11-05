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

import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';
import { ensureBaseError } from '@/classes/error';
import { config } from '@/config';
import { FetcherError, get } from '@/lib/http-clients/effect-fetcher';
import { reportApiFailure } from '@/lib/observability/report';

/** The route's error-handler context, so stale-fallback warnings group with its errors. */
const REPORT_CONTEXT = 'fetching Lanyard data';

const DiscordUserSchema = Schema.Struct({
  username: Schema.String,
  discriminator: Schema.String,
  avatar: Schema.String,
  id: Schema.String,
});

/** A field Lanyard may leave out or send as null; null decodes as missing. */
const OptionalString = Schema.optionalWith(Schema.String, { nullable: true });

const ActivityAssetsSchema = Schema.Struct({
  large_image: OptionalString,
  large_text: OptionalString,
});

const ActivitySchema = Schema.Struct({
  name: Schema.String,
  type: Schema.Number,
  // Discord documents both as `?string`: optional and nullable.
  state: OptionalString,
  details: OptionalString,
  assets: Schema.optionalWith(ActivityAssetsSchema, { nullable: true }),
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
/**
 * How old a cached presence may be and still answer when Lanyard fails. Presence goes stale fast,
 * so past this the route errors rather than show an old status as live.
 */
const MAX_STALE_AGE = 5 * 60 * 1_000;
let cache: { data: LanyardData; timestamp: number } | null = null;

/**
 * Upstream time budget. The Discord card's DataLoader gives up after 30 s, so the stale fallback
 * (or the 500) has to be ready well before that: three 4 s attempts with 1 s and 2 s backoff take
 * 15 s, inside the deadline.
 */
const ATTEMPT_TIMEOUT_MS = 4_000;
/** Caps the attempts together, retries and body reads included. */
const UPSTREAM_DEADLINE_MS = 16_000;

export async function getLanyardData(): Promise<LanyardData> {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  const url = `https://api.lanyard.rest/v1/users/${config.discord.id}`;
  const effect = pipe(
    get(url, {
      schema: LanyardResponseSchema,
      retries: 2,
      timeout: ATTEMPT_TIMEOUT_MS,
    }),
    Effect.timeoutFail({
      duration: UPSTREAM_DEADLINE_MS,
      onTimeout: () =>
        new FetcherError(`Lanyard did not answer within ${UPSTREAM_DEADLINE_MS} ms`, url),
    }),
    Effect.provide(FetchHttpClient.layer),
  );

  try {
    const { data: lanyard } = await Effect.runPromise(effect);
    cache = { data: lanyard, timestamp: Date.now() };

    return lanyard;
  } catch (error) {
    const failure = ensureBaseError(error, 'lanyard:fetch', {
      discordId: config.discord.id,
      cacheExpired: !cache || Date.now() - cache.timestamp >= CACHE_DURATION,
    });
    if (cache && Date.now() - cache.timestamp < MAX_STALE_AGE) {
      reportApiFailure(failure, { context: REPORT_CONTEXT, level: 'warning' });
      return cache.data;
    }
    throw failure;
  }
}
