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
 * @file Top tracks and top artists share now-playing's cached access token, so they handle a
 * rejected one the same way: a 401 drops the token and the request is made once more with a new
 * one. Splitting a top-tracks page to skip a corrupted item is for Spotify's own 5xx failures
 * only; a 4xx is the same answer for every page, so it fails in one request. The real fetcher
 * runs against a stubbed fetch.
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
  forgetSpotifyAccessToken,
  getAccessToken,
  topArtists,
  topTracks,
} from '@/lib/api-integrations/spotify';
import { FetcherError } from '@/lib/http-clients/effect-fetcher';
import { logger } from '@/utils';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const TOP_TRACKS_PATH = '/v1/me/top/tracks';
const TOP_ARTISTS_PATH = '/v1/me/top/artists';
const FIRST_TOKEN = 'Bearer test-token-1';
const SECOND_TOKEN = 'Bearer test-token-2';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const unauthorized = () => json(401, { error: { status: 401, message: 'Invalid access token' } });
const forbidden = () => json(403, { error: { status: 403, message: 'Insufficient client scope' } });
const badGateway = () => json(502, { error: { status: 502, message: 'Bad gateway' } });
const tokenUnavailable = () => json(503, { error: 'temporarily_unavailable' });
/** test-token-1, test-token-2, ... for the 1st, 2nd, ... token request. */
const issueToken = (count: number) =>
  json(200, { access_token: `test-token-${count}`, token_type: 'Bearer', expires_in: 3_600 });
/** One token refresh: its first request plus the fetcher's two retries (TOKEN_REQUEST_RETRIES). */
const TOKEN_REQUESTS_PER_REFRESH = 3;
const items = (count: number, prefix = 'item') =>
  json(200, {
    items: Array.from({ length: count }, (_, index) => ({ name: `${prefix}-${index}` })),
  });

/** One request Spotify received: where it went and which token it carried. */
interface SpotifyRequest {
  url: URL;
  authorization: string | null;
}

type TopReply = (request: SpotifyRequest) => Response;

const requestOf = (input: RequestInfo | URL, init?: RequestInit): SpotifyRequest => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
  return { url, authorization: headers.get('authorization') };
};

/**
 * Answers the token endpoint with `token` (by default test-token-1, test-token-2, ... in turn),
 * and the top-items endpoints with `top`. Anything else is a test bug.
 */
const stubSpotify = (top: TopReply, token: (count: number) => Response = issueToken) => {
  let tokenCalls = 0;
  const requests: SpotifyRequest[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = requestOf(input, init);
    if (request.url.href === TOKEN_URL) {
      tokenCalls += 1;
      return token(tokenCalls);
    }
    if ([TOP_TRACKS_PATH, TOP_ARTISTS_PATH].includes(request.url.pathname)) {
      requests.push(request);
      return top(request);
    }
    throw new Error(`unexpected request: ${request.url.href}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { requests, tokenCalls: () => tokenCalls };
};

/** Rejects the first token with a 401 and answers any later one with `reply`. */
const rejectFirstToken =
  (reply: () => Response): TopReply =>
  ({ authorization }) =>
    authorization === FIRST_TOKEN ? unauthorized() : reply();

beforeEach(() => {
  forgetSpotifyAccessToken();
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('topTracks', () => {
  it('refreshes a token Spotify rejects with 401 once, and returns the tracks', async () => {
    const spotify = stubSpotify(rejectFirstToken(() => items(20, 'track')));
    await getAccessToken(); // test-token-1 is now the cached token.

    const tracks = await topTracks();

    expect(tracks).toHaveLength(20);
    expect(spotify.tokenCalls()).toBe(2);
    expect(spotify.requests.map((request) => request.authorization)).toEqual([
      FIRST_TOKEN,
      SECOND_TOKEN,
    ]);
  });

  it('fails a 403 in one request instead of splitting it into smaller pages', async () => {
    const spotify = stubSpotify(forbidden);

    const failure = await topTracks().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(FetcherError);
    expect((failure as FetcherError).status).toBe(403);
    expect(spotify.requests).toHaveLength(1);
  });

  it('fails a 401 that a new token does not fix in two requests, not one per item', async () => {
    const spotify = stubSpotify(unauthorized);

    const failure = await topTracks().catch((error: unknown) => error);

    expect((failure as FetcherError).status).toBe(401);
    expect(spotify.requests).toHaveLength(2);
    expect(spotify.tokenCalls()).toBe(2);
  });

  it('still splits a page Spotify answers with a 5xx, to get past a corrupted item', async () => {
    const spotify = stubSpotify(({ url }) =>
      url.searchParams.get('limit') === '20' ? badGateway() : items(10, 'track'),
    );

    const tracks = await topTracks();

    expect(tracks).toHaveLength(20);
    expect(spotify.requests.map(({ url }) => url.searchParams.get('offset'))).toEqual([
      '0',
      '0',
      '10',
    ]);
  });

  it('fails a 5xx from the token endpoint after one refresh, without splitting the page', async () => {
    // The fake clock runs the token request's retry backoff (1 s, then 2 s) at once.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const spotify = stubSpotify(() => items(20, 'track'), tokenUnavailable);

    const failure = topTracks().catch((error: unknown) => error);
    await vi.runAllTimersAsync();

    const error = await failure;
    expect(error).toBeInstanceOf(FetcherError);
    expect((error as FetcherError).status).toBe(503);
    expect((error as FetcherError).url).toBe(TOKEN_URL);
    // Splitting on it would refresh again for every half: about six refreshes per call.
    expect(spotify.tokenCalls()).toBe(TOKEN_REQUESTS_PER_REFRESH);
    expect(spotify.requests).toHaveLength(0);
  });
});

describe('topArtists', () => {
  it('refreshes a token Spotify rejects with 401 once, and returns the artists', async () => {
    const spotify = stubSpotify(rejectFirstToken(() => items(5, 'artist')));
    await getAccessToken();

    const artists = await topArtists();

    expect(artists).toHaveLength(5);
    expect(spotify.tokenCalls()).toBe(2);
    expect(spotify.requests.map((request) => request.authorization)).toEqual([
      FIRST_TOKEN,
      SECOND_TOKEN,
    ]);
  });
});
