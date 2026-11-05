// @vitest-environment node
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

/**
 * @file GET /api/v1/now-playing keeps "nothing playing" and "Spotify failed" apart. Spotify's
 * 204 is a 200 `{ isPlaying: false }`; a failed token refresh or a Spotify error is a 500 that
 * no cache may keep, logged and reported once. A playing track links the artist's own page, not
 * the track's. The real handler and Spotify client run against a stubbed fetch.
 */

import { Elysia } from 'elysia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock('@sentry/nextjs', () => sentry);
// t3-env validates on import. Placeholder credentials, not real ones.
vi.mock('@/env', () => {
  const values: Record<string, string> = {
    NODE_ENV: 'test',
    SPOTIFY_CLIENT_ID: 'test-client-id',
    SPOTIFY_CLIENT_SECRET: 'test-client-secret',
    SPOTIFY_REFRESH_TOKEN: 'test-refresh-token',
  };
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (typeof key === 'string' ? values[key] : undefined),
  });
  return { env, default: env };
});

import { nowPlayingRoute } from '@/app/api/v1/[[...route]]/now-playing';
import { forgetSpotifyAccessToken } from '@/lib/api-integrations/spotify';
import { resetApiReportCooldowns } from '@/lib/observability/report';
import { logger } from '@/utils';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const tokenReply = () =>
  json(200, { access_token: 'test-access-token', token_type: 'Bearer', expires_in: 3_600 });
const refusedToken = () => json(400, { error: 'invalid_grant' });
const noContent = () => new Response(null, { status: 204 });
const spotifyServerError = () => json(500, { error: { status: 500, message: 'Server error' } });

const urlOf = (input: RequestInfo | URL) => (input instanceof Request ? input.url : String(input));

/** Answers the token and currently-playing endpoints; anything else is a test bug. */
const stubSpotify = (playing: () => Response, token: () => Response = tokenReply) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url === TOKEN_URL) return token();
      if (url === PLAYING_URL) return playing();
      throw new Error(`unexpected request: ${url}`);
    }),
  );
};

const app = new Elysia().use(nowPlayingRoute);
const getNowPlaying = () => app.handle(new Request('http://localhost/now-playing'));

beforeEach(() => {
  forgetSpotifyAccessToken();
  resetApiReportCooldowns();
  sentry.captureException.mockClear();
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /now-playing', () => {
  it('answers 200 { isPlaying: false } when Spotify has nothing playing', async () => {
    stubSpotify(noContent);

    const res = await getNowPlaying();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ isPlaying: false });
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('answers 200 { isPlaying: false } while the player is paused', async () => {
    stubSpotify(() => json(200, { is_playing: false, item: null }));

    const res = await getNowPlaying();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ isPlaying: false });
  });

  it("links the first artist's page apart from the track's", async () => {
    stubSpotify(() =>
      json(200, {
        is_playing: true,
        item: {
          name: 'Test Song',
          artists: [
            {
              name: 'First Artist',
              external_urls: { spotify: 'https://open.spotify.com/artist/first' },
            },
            {
              name: 'Second Artist',
              external_urls: { spotify: 'https://open.spotify.com/artist/second' },
            },
          ],
          album: { images: [{ url: 'https://i.scdn.co/image/test-art' }] },
          external_urls: { spotify: 'https://open.spotify.com/track/test-song' },
        },
      }),
    );

    const res = await getNowPlaying();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      isPlaying: true,
      songName: 'Test Song',
      artistName: 'First Artist, Second Artist',
      songURL: 'https://open.spotify.com/track/test-song',
      artistURL: 'https://open.spotify.com/artist/first',
      imageURL: 'https://i.scdn.co/image/test-art',
    });
  });

  it('leaves out links that are not Spotify pages', async () => {
    stubSpotify(() =>
      json(200, {
        is_playing: true,
        item: {
          name: 'Local File',
          artists: [{ name: 'Someone', external_urls: {} }],
          album: { images: [] },
          external_urls: { spotify: 'javascript:alert(1)' },
        },
      }),
    );

    const res = await getNowPlaying();

    expect(await res.json()).toEqual({
      isPlaying: true,
      songName: 'Local File',
      artistName: 'Someone',
    });
  });

  it.each([
    { failure: 'the token refresh is refused', playing: noContent, token: refusedToken },
    { failure: 'Spotify answers 500', playing: spotifyServerError, token: tokenReply },
  ])('answers a no-store 500 and reports it once when $failure', async ({ playing, token }) => {
    stubSpotify(playing, token);

    const res = await getNowPlaying();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ level: 'error', tags: { 'api.context': 'now-playing API route' } }),
    );
  });
});
