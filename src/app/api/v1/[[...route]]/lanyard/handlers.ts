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
import { processGlobal, resetProcessGlobal } from '@/lib/cache/process-global';
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
export type LanyardData = Schema.Schema.Type<typeof LanyardDataSchema>;

const CACHE_DURATION = 60 * 1_000;
/**
 * How old a cached presence may be and still answer when Lanyard fails. Presence goes stale fast,
 * so past this the route errors rather than show an old status as live.
 */
const MAX_STALE_AGE = 5 * 60 * 1_000;

/**
 * Upstream time budget. The /stats loader (loadDiscord in console-loaders.ts) stops waiting after
 * its own short deadline, and the Discord tile asks the /api/v1/lanyard route again every 30 s,
 * so the stale fallback (or the 500) has to be ready before the next poll: three 4 s attempts
 * with 1 s and 2 s backoff take 15 s, inside the deadline.
 */
const ATTEMPT_TIMEOUT_MS = 4_000;
/** Caps the attempts together, retries and body reads included. */
const UPSTREAM_DEADLINE_MS = 16_000;

/** A presence and when it was read from Lanyard (epoch ms). */
export interface LanyardSnapshot {
  readonly data: LanyardData;
  readonly readAt: number;
}

interface CachedPresence {
  readonly data: LanyardData;
  /** When Lanyard answered `data` (epoch ms). */
  readonly timestamp: number;
}

/**
 * What getLanyardSnapshot keeps between calls. Next bundles this module once for the /stats page
 * (whose Discord snapshot calls getLanyardSnapshot directly) and once for /api/v1, so module state
 * gave each its own cache: the page's snapshot and the route's answers were separate reads,
 * seconds apart, and ten concurrent loads asked Lanyard up to ten times. Kept in processGlobal
 * instead, as the other /stats handlers' state is, the page and the route answer the same read,
 * and every caller that finds it expired joins the one read in flight.
 */
interface LanyardState {
  /** The last good presence and when it was read. */
  cache: CachedPresence | null;
  /** The read running now; every caller that finds the cache expired joins it. */
  inFlight: Promise<LanyardSnapshot> | null;
}

const STATE_NAME = 'lanyard.cache';

/** Looked up on every call, so a reset in a test takes effect without reloading this module. */
const sharedState = (): LanyardState =>
  processGlobal<LanyardState>(STATE_NAME, () => ({ cache: null, inFlight: null }));

/** Forgets the cached presence and any running read, in every copy of this module. Tests only. */
export function resetLanyardCache(): void {
  resetProcessGlobal(STATE_NAME);
}

const snapshotOf = ({ data, timestamp }: CachedPresence): LanyardSnapshot => ({
  data,
  readAt: timestamp,
});

/** One read from Lanyard: retried, and bounded by {@link UPSTREAM_DEADLINE_MS} in all. */
async function fetchPresence(): Promise<LanyardData> {
  const url = `https://api.lanyard.rest/v1/users/${config.discord.id}`;
  const { data } = await Effect.runPromise(
    pipe(
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
    ),
  );
  return data;
}

/**
 * Reads Lanyard again and caches the answer in `state`, the store that was current when the read
 * started (so one that outlives a test's reset never fills the next test's cache). When Lanyard
 * fails, a presence read up to five minutes ago answers instead, dated by its own read, and the
 * failure is reported once as a warning; with nothing that recent, the failure is thrown.
 */
async function refreshLanyardSnapshot(state: LanyardState): Promise<LanyardSnapshot> {
  try {
    const cache = { data: await fetchPresence(), timestamp: Date.now() };
    state.cache = cache;
    return snapshotOf(cache);
  } catch (error) {
    const { cache } = state;
    const failure = ensureBaseError(error, 'lanyard:fetch', {
      discordId: config.discord.id,
      cacheExpired: !cache || Date.now() - cache.timestamp >= CACHE_DURATION,
    });
    if (cache && Date.now() - cache.timestamp < MAX_STALE_AGE) {
      reportApiFailure(failure, { context: REPORT_CONTEXT, level: 'warning' });
      return snapshotOf(cache);
    }
    throw failure;
  }
}

/**
 * The presence and when it was read from Lanyard: the cached copy inside the minute, a fresh read
 * past it, or (when Lanyard fails) a copy up to five minutes old, always dated by its own read.
 * The /stats page and /api/v1/lanyard share the cache and the read in flight (LanyardState).
 */
export async function getLanyardSnapshot(): Promise<LanyardSnapshot> {
  const state = sharedState();
  if (state.cache && Date.now() - state.cache.timestamp < CACHE_DURATION) {
    return snapshotOf(state.cache);
  }
  state.inFlight ??= refreshLanyardSnapshot(state).finally(() => {
    state.inFlight = null;
  });
  return state.inFlight;
}
