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
 * @file The Spotify client tells "nothing playing" apart from "Spotify failed". A 204 No Content
 * is the only idle answer; a refused token refresh or an HTTP error throws, so the route can
 * answer 500 instead of claiming nothing plays. The access token is cached until shortly before
 * Spotify's `expires_in` rather than refreshed on every call. The real fetcher runs against a
 * stubbed fetch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import {
  currentlyPlayingSong,
  forgetSpotifyAccessToken,
  getAccessToken,
} from '@/lib/api-integrations/spotify';
import { FetcherError } from '@/lib/http-clients/effect-fetcher';
import { logger } from '@/utils';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';
const T0 = new Date('2026-11-05T12:00:00Z').getTime();
const TOKEN_LIFETIME_S = 3_600;
const MINUTE = 60_000;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const tokenReply = () =>
  json(200, {
    access_token: 'test-access-token',
    token_type: 'Bearer',
    expires_in: TOKEN_LIFETIME_S,
  });
const refusedToken = () => json(400, { error: 'invalid_grant' });
const noContent = () => new Response(null, { status: 204 });
const unauthorized = () => json(401, { error: { status: 401, message: 'Invalid access token' } });

const playback = {
  is_playing: true,
  item: {
    name: 'Test Song',
    artists: [
      { name: 'First Artist', external_urls: { spotify: 'https://open.spotify.com/artist/first' } },
      {
        name: 'Second Artist',
        external_urls: { spotify: 'https://open.spotify.com/artist/second' },
      },
    ],
    album: { images: [{ url: 'https://i.scdn.co/image/test-art' }] },
    external_urls: { spotify: 'https://open.spotify.com/track/test-song' },
  },
};

const urlOf = (input: RequestInfo | URL) => (input instanceof Request ? input.url : String(input));

interface SpotifyReplies {
  token?: () => Response;
  playing?: () => Response;
}

/** Answers the token and currently-playing endpoints; anything else is a test bug. */
const stubSpotify = ({ token = tokenReply, playing = noContent }: SpotifyReplies = {}) => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = urlOf(input);
    if (url === TOKEN_URL) return token();
    if (url === PLAYING_URL) return playing();
    throw new Error(`unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const callsTo = (fetchMock: ReturnType<typeof stubSpotify>, url: string) =>
  fetchMock.mock.calls.filter(([input]) => urlOf(input) === url).length;

beforeEach(() => {
  forgetSpotifyAccessToken();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('currentlyPlayingSong', () => {
  it('reads 204 No Content as nothing playing, in one request', async () => {
    const fetchMock = stubSpotify({ playing: noContent });

    await expect(currentlyPlayingSong()).resolves.toBeNull();
    expect(callsTo(fetchMock, PLAYING_URL)).toBe(1);
  });

  it('returns the playback Spotify reports, with each artist page', async () => {
    stubSpotify({ playing: () => json(200, playback) });

    const result = await currentlyPlayingSong();

    expect(result?.is_playing).toBe(true);
    expect(result?.item?.artists[0]?.external_urls?.spotify).toBe(
      'https://open.spotify.com/artist/first',
    );
  });

  it('throws when the token endpoint refuses the refresh token', async () => {
    const fetchMock = stubSpotify({ token: refusedToken });

    const failure = await currentlyPlayingSong().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(FetcherError);
    expect((failure as FetcherError).status).toBe(400);
    expect(callsTo(fetchMock, PLAYING_URL)).toBe(0);
  });

  it('throws when Spotify answers 500 instead of reporting nothing playing', async () => {
    stubSpotify({ playing: () => json(500, { error: { status: 500, message: 'Server error' } }) });

    const failure = await currentlyPlayingSong().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(FetcherError);
    expect((failure as FetcherError).status).toBe(500);
  });

  it('throws when the reply does not match the playback schema', async () => {
    stubSpotify({ playing: () => json(200, { unexpected: true }) });

    await expect(currentlyPlayingSong()).rejects.toThrow('Response validation failed');
  });

  it('asks again with a new token, in the same call, when Spotify rejects the cached one', async () => {
    // The first token is rejected; the one refreshed after the 401 is accepted.
    const replies = [unauthorized, noContent];
    const fetchMock = stubSpotify({ playing: () => (replies.shift() ?? noContent)() });

    await expect(currentlyPlayingSong()).resolves.toBeNull();

    expect(callsTo(fetchMock, TOKEN_URL)).toBe(2);
    expect(callsTo(fetchMock, PLAYING_URL)).toBe(2);
  });

  it('throws, and refreshes again on the next call, when the new token is rejected too', async () => {
    const fetchMock = stubSpotify({ playing: unauthorized });

    const failure = await currentlyPlayingSong().catch((error: unknown) => error);
    expect((failure as FetcherError).status).toBe(401);
    expect(callsTo(fetchMock, TOKEN_URL)).toBe(2);
    expect(callsTo(fetchMock, PLAYING_URL)).toBe(2);

    await currentlyPlayingSong().catch(() => undefined);
    expect(callsTo(fetchMock, TOKEN_URL)).toBe(4);
  });
});

describe('getAccessToken', () => {
  it('reuses one token across requests until shortly before it expires', async () => {
    const fetchMock = stubSpotify();

    await currentlyPlayingSong();
    vi.setSystemTime(T0 + 30 * MINUTE);
    await currentlyPlayingSong();
    expect(callsTo(fetchMock, TOKEN_URL)).toBe(1);

    // Inside the safety margin before `expires_in`: refreshed before it can lapse mid-request.
    vi.setSystemTime(T0 + TOKEN_LIFETIME_S * 1_000 - 30_000);
    await currentlyPlayingSong();
    expect(callsTo(fetchMock, TOKEN_URL)).toBe(2);
  });

  it('shares one refresh between concurrent callers', async () => {
    const fetchMock = stubSpotify();

    const [first, second] = await Promise.all([getAccessToken(), getAccessToken()]);

    expect(first).toEqual({ access_token: 'test-access-token' });
    expect(second).toEqual(first);
    expect(callsTo(fetchMock, TOKEN_URL)).toBe(1);
  });

  it('does not cache a failed refresh', async () => {
    let token = refusedToken;
    const fetchMock = stubSpotify({ token: () => token() });

    await expect(getAccessToken()).rejects.toBeInstanceOf(FetcherError);
    token = tokenReply;
    await expect(getAccessToken()).resolves.toEqual({ access_token: 'test-access-token' });

    expect(callsTo(fetchMock, TOKEN_URL)).toBe(2);
  });
});
