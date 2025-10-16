import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';
import { env } from '@/env';
import { get, post } from '@/lib/http-clients/effect-fetcher';
import { logger } from '@/utils';
import 'server-only';

const client_id = env.SPOTIFY_CLIENT_ID;
const client_secret = env.SPOTIFY_CLIENT_SECRET;
const refresh_token = env.SPOTIFY_REFRESH_TOKEN;

// Spotify API authorization value (read-only)
/**
 * @readonly
 * @type {string}
 * @description Spotify API Basic Auth token
 * @see https://developer.spotify.com/documentation/general/guides/authorization/
 */
const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64');

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

/**
 * Retrieves a new Spotify access token using the provided refresh token.
 *
 * @async
 * @function
 * @public
 * @returns {Promise<{ access_token: string }>} Resolves with the access token object.
 * @throws {Error} If an error occurs while fetching the access token.
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens
 * @see https://github.com/WomB0ComB0/portfolio
 * @web
 * @example
 * const { access_token } = await getAccessToken();
 */
export const getAccessToken = async (): Promise<{ access_token: string }> => {
  const formData = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh_token!,
  }).toString();

  const effect = pipe(
    post('https://accounts.spotify.com/api/token', formData, {
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      schema: AccessTokenSchema,
      retries: 2,
      timeout: 10_000,
      bodyType: 'text', // Send as form-encoded text, not JSON
    }),
    Effect.provide(FetchHttpClient.layer),
  );

  try {
    return await Effect.runPromise(effect);
  } catch (error) {
    logger.error('Error getting Spotify access token:', error);
    throw error;
  }
};

/**
 * Fetches the user's top 20 Spotify tracks for the short-term range.
 *
 * @async
 * @function
 * @public
 * @returns {Promise<any[]>} Promise resolving with an array of top track objects.
 * @throws {Error} If fetching the top tracks fails or the access token cannot be retrieved.
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks
 * @see https://github.com/WomB0ComB0/portfolio
 * @web
 * @example
 * const tracks = await topTracks();
 */
export const topTracks = async (): Promise<any[]> => {
  // Obtain an access token
  const { access_token } = await getAccessToken();

  const effect = pipe(
    get('https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=short_term', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      schema: SpotifyTrackSchema,
      retries: 2,
      timeout: 10_000,
    }),
    Effect.provide(FetchHttpClient.layer),
  );

  try {
    const result = await Effect.runPromise(effect);
    return result.items as any[];
  } catch (error) {
    logger.error('Error fetching top tracks:', error);
    throw error;
  }
};

/**
 * Fetches the user's top 20 Spotify artists for the short-term range.
 *
 * @async
 * @function
 * @public
 * @returns {Promise<any[]>} Promise resolving with an array of top artist objects.
 * @throws {Error} If fetching the top artists fails or the access token cannot be retrieved.
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks
 * @see https://github.com/WomB0ComB0/portfolio
 * @web
 * @example
 * const artists = await topArtists();
 */
export const topArtists = async (): Promise<any[]> => {
  // Obtain an access token
  const { access_token } = await getAccessToken();

  const effect = pipe(
    get('https://api.spotify.com/v1/me/top/artists?limit=20&time_range=short_term', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      schema: SpotifyArtistSchema,
      retries: 2,
      timeout: 10_000,
    }),
    Effect.provide(FetchHttpClient.layer),
  );

  try {
    const result = await Effect.runPromise(effect);
    return result.items as any[];
  } catch (error) {
    logger.error('Error fetching top artists:', error);
    throw error;
  }
};

/**
 * Retrieves the user's currently playing Spotify song, if available.
 *
 * @async
 * @function
 * @public
 * @returns {Promise<any|null>} Resolves with the currently playing song object, or null if not available.
 * @throws {Error} If authorizing or fetching from the Spotify API fails.
 * @author Mike Odnis
 * @version 1.0.0
 * @see https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track
 * @see https://github.com/WomB0ComB0/portfolio
 * @web
 * @example
 * const song = await currentlyPlayingSong();
 * if (song) { ... }
 */
export const currentlyPlayingSong = async (): Promise<any | null> => {
  try {
    const { access_token } = await getAccessToken();

    const effect = pipe(
      get('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        retries: 2,
        timeout: 10_000,
      }),
      Effect.provide(FetchHttpClient.layer),
    );

    return await Effect.runPromise(effect);
  } catch (error) {
    logger.error('Error fetching currently playing song:', error);
    return null;
  }
};
