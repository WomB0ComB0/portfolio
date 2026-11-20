/**
 * Copyright 2026 Mike Odnis
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
 * @file GET /api/v1/now-playing is polled every 30 s by every open home, /spotify and /stats tab.
 * A successful answer is kept by the CDN for 15 s and served stale for 15 s more, so the function
 * runs about once per 15 s per region however many tabs poll, and a tile is never more than about
 * 30 s behind. Browsers keep nothing (max-age=0), so each poll reaches the CDN. A failure is never
 * kept, by anyone. The real handler and Spotify client run against a stubbed fetch.
 */

import { Elysia } from 'elysia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
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
import { NOW_PLAYING_CACHE_CONTROL } from '@/app/api/v1/[[...route]]/now-playing/middleware';
import { forgetSpotifyAccessToken } from '@/lib/api-integrations/spotify';
import { resetApiReportCooldowns } from '@/lib/observability/report';
import { logger } from '@/utils';

/**
 * How often the home tile, the /spotify hero and the /stats fallback poll (NOW_PLAYING_POLL_MS in
 * now-playing-tile.tsx; importing the client tile here would pull in its styles).
 */
const POLL_MS = 30_000;

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const tokenReply = () =>
  json(200, { access_token: 'test-access-token', token_type: 'Bearer', expires_in: 3_600 });

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

/** The seconds a Cache-Control value gives `directive`, or undefined when it has none. */
function secondsOf(cacheControl: string | null, directive: string): number | undefined {
  const match = new RegExp(`(?:^|,)\\s*${directive}=(\\d+)`).exec(cacheControl ?? '');
  return match ? Number(match[1]) : undefined;
}

const PLAYING = {
  is_playing: true,
  item: {
    name: 'Test Song',
    artists: [{ name: 'First Artist', external_urls: {} }],
    album: { images: [{ url: 'https://i.scdn.co/image/test-art' }] },
    external_urls: {},
  },
};

beforeEach(() => {
  forgetSpotifyAccessToken();
  resetApiReportCooldowns();
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /now-playing and the CDN', () => {
  it.each([
    ['a playing track', () => json(200, PLAYING)],
    ['nothing playing (204)', () => new Response(null, { status: 204 })],
  ])('lets the CDN keep %s for 15 s, and 15 s more while it asks again', async (_what, reply) => {
    stubSpotify(reply);

    const res = await getNowPlaying();
    const cacheControl = res.headers.get('cache-control');

    expect(res.status).toBe(200);
    expect(cacheControl).toBe(NOW_PLAYING_CACHE_CONTROL);
    expect(cacheControl).toMatch(/^public,/);
    expect(secondsOf(cacheControl, 's-maxage')).toBe(15);
    expect(secondsOf(cacheControl, 'stale-while-revalidate')).toBe(15);
  });

  it('keeps nothing in browsers, so every poll reaches the CDN', async () => {
    stubSpotify(() => json(200, PLAYING));

    const res = await getNowPlaying();

    expect(secondsOf(res.headers.get('cache-control'), 'max-age')).toBe(0);
  });

  it("keeps the 30 s poll's answers at most one poll behind", () => {
    const s = secondsOf(NOW_PLAYING_CACHE_CONTROL, 's-maxage') ?? Number.POSITIVE_INFINITY;
    const swr = secondsOf(NOW_PLAYING_CACHE_CONTROL, 'stale-while-revalidate') ?? 0;

    // The oldest answer a poll can get is s-maxage plus the stale window.
    expect((s + swr) * 1_000).toBeLessThanOrEqual(POLL_MS);
  });

  it('keeps a failed token refresh (500) out of every cache', async () => {
    stubSpotify(
      () => json(200, PLAYING),
      () => json(400, { error: 'invalid_grant' }),
    );

    const res = await getNowPlaying();

    expect(res.status).toBe(500);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('keeps a Spotify error (500) out of every cache', async () => {
    stubSpotify(() => json(500, { error: { status: 500, message: 'Server error' } }));

    const res = await getNowPlaying();

    expect(res.status).toBe(500);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
