import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';
import { get, post } from '@/lib/http-clients/effect-fetcher';
import { env } from '@/env';
import 'server-only';

const client_id = env.SPOTIFY_CLIENT_ID;
const client_secret = env.SPOTIFY_CLIENT_SECRET;
const refresh_token = env.SPOTIFY_REFRESH_TOKEN;

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
 * Makes a request to the Spotify API to obtain a new access token using a refresh token.
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
    console.error('Error getting Spotify access token:', error);
    throw error;
  }
};

/**
 * Makes a request to the Spotify API to retrieve the user's top tracks.
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
    console.error('Error fetching top tracks:', error);
    throw error;
  }
};

/**
 * Makes a request to the Spotify API to retrieve the user's top artists.
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
    console.error('Error fetching top artists:', error);
    throw error;
  }
};

/**
 * Makes a request to the Spotify API to retrieve the currently playing song for the user.
 */
export const currentlyPlayingSong = async () => {
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
    console.error('Error fetching currently playing song:', error);
    return null;
  }
};
