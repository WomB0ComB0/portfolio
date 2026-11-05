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
import { Effect, Either, pipe, Schema } from 'effect';
import { env } from '@/env';
import { FetcherError, get, post } from '@/lib/http-clients/effect-fetcher';
import { logger } from '@/utils';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_CURRENTLY_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';
const SPOTIFY_REQUEST_TIMEOUT_MS = 10_000;
const TOKEN_REQUEST_RETRIES = 2;
/** One retry for a 5xx or a dropped connection; 4xx answers are final (see the fetcher). */
const CURRENTLY_PLAYING_RETRIES = 1;
const CURRENTLY_PLAYING_RETRY_DELAY_MS = 500;
/** A token is refreshed this long before Spotify's `expires_in`, so it never lapses mid-request. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
const MS_PER_SECOND = 1_000;
const HTTP_UNAUTHORIZED = 401;
const HTTP_SERVER_ERROR_MIN = 500;
const SPOTIFY_TOP_ITEMS_URL = 'https://api.spotify.com/v1/me/top';
const TOP_ITEMS_LIMIT = 20;
const TOP_ARTISTS_RETRIES = 2;

interface CachedAccessToken {
  readonly accessToken: string;
  /** Epoch milliseconds from which the token counts as expired. */
  readonly refreshAt: number;
}

/** The access token every Spotify call on this instance shares, until `refreshAt`. */
let cachedToken: CachedAccessToken | undefined;
/** A refresh already on its way, so concurrent callers wait for it instead of starting another. */
let pendingToken: Promise<CachedAccessToken> | undefined;

/**
 * Runs `effect` and rejects with the error it failed with (a FetcherError keeps its status)
 * rather than the FiberFailure wrapper `Effect.runPromise` rejects with.
 */
const runOrThrow = async <A, E>(effect: Effect.Effect<A, E>): Promise<A> => {
  const result = await Effect.runPromise(Effect.either(effect));
  if (Either.isLeft(result)) throw result.left;
  return result.right;
};

/** Basic credentials and the refresh token; throws when the environment lacks any of them. */
const spotifyCredentials = (): { basic: string; refreshToken: string } => {
  const clientId = env.SPOTIFY_CLIENT_ID;
  const clientSecret = env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = env.SPOTIFY_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Spotify is not configured: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REFRESH_TOKEN are required',
    );
  }
  return { basic: Buffer.from(`${clientId}:${clientSecret}`).toString('base64'), refreshToken };
};

// Schema for access token response
const AccessTokenSchema = Schema.Struct({
  access_token: Schema.String,
  token_type: Schema.String,
  expires_in: Schema.Number,
  scope: Schema.optional(Schema.String),
});

// Schema for Spotify track item
const SpotifyTrackSchema = Schema.Struct({
  items: Schema.Array(Schema.Unknown),
});

// Schema for Spotify artist item
const SpotifyArtistSchema = Schema.Struct({
  items: Schema.Array(Schema.Unknown),
});

/** Local files have no Spotify page, so their `external_urls` is `{}`. */
const ExternalUrlsSchema = Schema.Struct({ spotify: Schema.optional(Schema.String) });

const PlayingArtistSchema = Schema.Struct({
  name: Schema.String,
  external_urls: Schema.optional(ExternalUrlsSchema),
});

const PlayingTrackSchema = Schema.Struct({
  name: Schema.String,
  artists: Schema.Array(PlayingArtistSchema),
  album: Schema.optional(
    Schema.Struct({ images: Schema.Array(Schema.Struct({ url: Schema.String })) }),
  ),
  external_urls: Schema.optional(ExternalUrlsSchema),
});

/**
 * GET /me/player/currently-playing. `item` is null while an episode or an ad plays (only tracks
 * are requested), and Spotify answers 204 No Content, which the fetcher reads as `null`, when
 * nothing is playing at all.
 *
 * @see https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track
 */
const CurrentlyPlayingSchema = Schema.Struct({
  is_playing: Schema.Boolean,
  item: Schema.optional(Schema.NullOr(PlayingTrackSchema)),
});

export type CurrentlyPlaying = Schema.Schema.Type<typeof CurrentlyPlayingSchema>;
export type CurrentlyPlayingTrack = Schema.Schema.Type<typeof PlayingTrackSchema>;

/** Exchanges the refresh token for a new access token and works out when to refresh it again. */
const requestAccessToken = async (): Promise<CachedAccessToken> => {
  const { basic, refreshToken } = spotifyCredentials();
  const formData = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }).toString();
  // Counted from before the request, so a slow answer only makes the token refresh sooner.
  const requestedAt = Date.now();

  const effect = pipe(
    post(SPOTIFY_TOKEN_URL, formData, {
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      schema: AccessTokenSchema,
      retries: TOKEN_REQUEST_RETRIES,
      timeout: SPOTIFY_REQUEST_TIMEOUT_MS,
      bodyType: 'text', // Send as form-encoded text, not JSON
    }),
    Effect.provide(FetchHttpClient.layer),
  );

  try {
    const token = await runOrThrow(effect);
    return {
      accessToken: token.access_token,
      refreshAt: requestedAt + token.expires_in * MS_PER_SECOND - TOKEN_EXPIRY_MARGIN_MS,
    };
  } catch (error) {
    logger.error('Error getting Spotify access token:', error);
    throw error;
  }
};

/** The cached token while it is fresh; otherwise one shared refresh, cached once it succeeds. */
const currentAccessToken = async (): Promise<CachedAccessToken> => {
  if (cachedToken && Date.now() < cachedToken.refreshAt) return cachedToken;
  pendingToken ??= requestAccessToken()
    .then((token) => {
      cachedToken = token;
      return token;
    })
    .finally(() => {
      pendingToken = undefined;
    });
  return pendingToken;
};

/**
 * Forgets the cached access token, so the next call refreshes it. For tests: a token Spotify
 * rejects is already forgotten by spotifyGet.
 */
export const forgetSpotifyAccessToken = (): void => {
  cachedToken = undefined;
};

/**
 * Returns a Spotify access token, refreshing it with the refresh token only when the cached one
 * is missing or about to expire (Spotify's `expires_in`, less a safety margin).
 *
 * @returns {Promise<{ access_token: string }>} Resolves with the access token object.
 * @throws {Error} When Spotify isn't configured or the token endpoint fails.
 * @see https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens
 * @example
 * const { access_token } = await getAccessToken();
 */
export const getAccessToken = async (): Promise<{ access_token: string }> => {
  const { accessToken } = await currentAccessToken();
  return { access_token: accessToken };
};

/** Spotify rejected the access token (it can do so before the token's stated expiry). */
const isRejectedToken = (error: unknown): boolean =>
  error instanceof FetcherError && error.status === HTTP_UNAUTHORIZED;

/** Spotify's own failure, as opposed to an answer about this request (a 4xx). */
const isServerError = (error: unknown): boolean =>
  error instanceof FetcherError &&
  error.status !== undefined &&
  error.status >= HTTP_SERVER_ERROR_MIN;

/**
 * Forgets `token` if it is still the cached one. A concurrent call may already have replaced it
 * with a new token after its own 401; that newer token stays.
 */
const forgetRejectedToken = (token: CachedAccessToken): void => {
  if (cachedToken === token) cachedToken = undefined;
};

interface SpotifyGetOptions<A, I> {
  schema: Schema.Schema<A, I, never>;
  /** The fetcher's own retries, for a 5xx or a dropped connection; a 4xx is never retried. */
  retries: number;
  retryDelay?: number;
}

/** One GET with the current access token. A 401 forgets that token before the error is thrown. */
const getWithCurrentToken = async <A, I>(
  url: string,
  { schema, retries, retryDelay }: SpotifyGetOptions<A, I>,
): Promise<A> => {
  const token = await currentAccessToken();
  const effect = pipe(
    get(url, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
      schema,
      retries,
      retryDelay,
      timeout: SPOTIFY_REQUEST_TIMEOUT_MS,
    }),
    Effect.provide(FetchHttpClient.layer),
  );
  try {
    return await runOrThrow(effect);
  } catch (error) {
    if (isRejectedToken(error)) forgetRejectedToken(token);
    throw error;
  }
};

/**
 * GET from the Spotify Web API with the shared access token. Every Spotify Web API call goes
 * through here. When Spotify rejects the token (401), it is forgotten and the request is made once
 * more with a new one, so callers see the 401 only when the new token is rejected too. Rejects
 * with the fetcher's own error (a FetcherError keeps its status).
 */
const spotifyGet = async <A, I>(url: string, options: SpotifyGetOptions<A, I>): Promise<A> => {
  try {
    return await getWithCurrentToken(url, options);
  } catch (error) {
    if (!isRejectedToken(error)) throw error;
    return getWithCurrentToken(url, options);
  }
};

type TopItemsEndpoint = 'tracks' | 'artists';

const topItemsUrl = (endpoint: TopItemsEndpoint, limit: number, offset?: number): string => {
  const query = new URLSearchParams({ limit: String(limit), time_range: 'short_term' });
  if (offset !== undefined) query.set('offset', String(offset));
  return `${SPOTIFY_TOP_ITEMS_URL}/${endpoint}?${query.toString()}`;
};

/** One page of top tracks, in a single attempt: fetchTopItemsResilient decides what follows. */
const fetchTopTracksPage = async (limit: number, offset: number): Promise<readonly unknown[]> => {
  const page = await spotifyGet(topItemsUrl('tracks', limit, offset), {
    schema: SpotifyTrackSchema,
    retries: 0,
  });
  return page.items;
};

/**
 * Top tracks, skipping an item Spotify can't serve. A 5xx on a page is Spotify failing, possibly on
 * one corrupted item, so the page is split in two until the bad item stands alone and is skipped.
 * Any other failure (a 4xx, a timeout, a dropped connection, an answer the schema rejects) is the
 * same for every page, so it is thrown at once rather than repeated for each half.
 */
const fetchTopItemsResilient = async (
  limit = TOP_ITEMS_LIMIT,
  offset = 0,
): Promise<readonly unknown[]> => {
  try {
    return await fetchTopTracksPage(limit, offset);
  } catch (error) {
    if (!isServerError(error)) throw error;
    if (limit <= 1) {
      logger.warn(`Skipping corrupted Spotify tracks item at offset ${offset}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
    const mid = Math.floor(limit / 2);
    const [left, right] = await Promise.all([
      fetchTopItemsResilient(mid, offset),
      fetchTopItemsResilient(limit - mid, offset + mid),
    ]);
    return [...left, ...right];
  }
};

/**
 * Fetches the user's top 20 Spotify tracks for the short-term range.
 *
 * @returns {Promise<readonly unknown[]>} The top track objects, unvalidated.
 * @throws {Error} When the access token can't be had, Spotify answers with a 4xx (a 401 only after
 * a new token was rejected too), or every item fails with a 5xx.
 * @see https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks
 * @example
 * const tracks = await topTracks();
 */
export const topTracks = async (): Promise<readonly unknown[]> => {
  try {
    const items = await fetchTopItemsResilient();
    if (items.length === 0) {
      throw new Error('Failed to fetch any top tracks from Spotify API');
    }
    return items;
  } catch (error) {
    logger.error('Error fetching top tracks:', error);
    throw error;
  }
};

/**
 * Fetches the user's top 20 Spotify artists for the short-term range.
 *
 * @returns {Promise<readonly unknown[]>} The top artist objects, unvalidated.
 * @throws {Error} When the access token can't be had or Spotify answers with an HTTP error (a 401
 * only after a new token was rejected too).
 * @see https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks
 * @example
 * const artists = await topArtists();
 */
export const topArtists = async (): Promise<readonly unknown[]> => {
  try {
    const page = await spotifyGet(topItemsUrl('artists', TOP_ITEMS_LIMIT), {
      schema: SpotifyArtistSchema,
      retries: TOP_ARTISTS_RETRIES,
    });
    return page.items;
  } catch (error) {
    logger.error('Error fetching top artists:', error);
    throw error;
  }
};

/**
 * Retrieves what is playing on Spotify right now.
 *
 * @returns {Promise<CurrentlyPlaying | null>} The playback state, or null when Spotify answers
 * 204 No Content because nothing is playing.
 * @throws {Error} When Spotify isn't configured, the token refresh fails, Spotify answers with an
 * HTTP error (a 401 only after a new token was rejected too), or the reply doesn't match
 * {@link CurrentlyPlayingSchema}. Callers must not read a failure as "nothing playing".
 * @see https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track
 * @example
 * const playback = await currentlyPlayingSong();
 * if (playback?.is_playing) { ... }
 */
export const currentlyPlayingSong = (): Promise<CurrentlyPlaying | null> =>
  spotifyGet(SPOTIFY_CURRENTLY_PLAYING_URL, {
    schema: Schema.NullOr(CurrentlyPlayingSchema),
    retries: CURRENTLY_PLAYING_RETRIES,
    retryDelay: CURRENTLY_PLAYING_RETRY_DELAY_MS,
  });
