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
 * @file The live islands' fetch makes one attempt and leaves retrying to the QueryClient: a 5xx
 * is retried once, a 4xx never. A failed answer's body is cancelled, so the browser never keeps
 * its stream open. It gives up after its timeout or when the query is cancelled, and its parsers
 * accept the endpoints' real answers and nothing else.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// The QueryClient module reaches effect-fetcher, which imports t3-env; nothing here needs it.
vi.mock('@/env', () => ({ env: {}, default: {} }));

import {
  FetchStatusError,
  FetchTimeoutError,
  fetchJson,
  LiveResponseError,
  parseNowPlaying,
  parseServiceStatus,
} from '@/app/_components/home/live/live-fetch';
import { shouldRetryQuery } from '@/providers/server/query-client';

const URL_UNDER_TEST = '/api/v1/now-playing';
const BROWSER = false;

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A fetch that answers `response`, recording the init it was called with. */
function stubFetch(response: () => Response) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response());
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** A fetch that never answers, and rejects with the signal's reason when it aborts. */
function stubHangingFetch() {
  const fetchMock = vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return;
        if (signal.aborted) reject(signal.reason);
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/**
 * A fetch whose 200 answer arrives at once but whose body stalls until the request aborts, then
 * errors with the abort's reason, as a browser's body stream does.
 */
function stubStalledBodyFetch() {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const signal = init?.signal;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        signal?.addEventListener('abort', () => controller.error(signal.reason), { once: true });
      },
    });
    return new Response(stream, { status: 200, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/**
 * A `status` answer whose body never ends on its own, like a stalled stream, and records whether
 * it was cancelled. `failCancel` makes its cancel reject.
 */
function openBodyResponse(status: number, { failCancel = false } = {}) {
  const body = { cancelled: false };
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      body.cancelled = true;
      if (failCancel) throw new Error('cancel failed');
    },
  });
  const response = new Response(stream, {
    status,
    headers: { 'content-type': 'application/json' },
  });
  return { body, response };
}

/** The error `promise` rejects with (fails the test if it resolves). */
async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected a rejection');
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fetchJson', () => {
  it('resolves the JSON body of a 2xx answer, asking for JSON', async () => {
    const fetchMock = stubFetch(() => jsonResponse({ isPlaying: false }));

    await expect(fetchJson(URL_UNDER_TEST)).resolves.toEqual({ isPlaying: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(URL_UNDER_TEST);
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('accept')).toBe(
      'application/json',
    );
  });

  it('throws FetchStatusError(500) for a 500, which the QueryClient retries once', async () => {
    stubFetch(() => jsonResponse({ error: 'Internal Server Error' }, 500));

    const error = await rejectionOf(fetchJson(URL_UNDER_TEST));

    expect(error).toBeInstanceOf(FetchStatusError);
    expect(error).toMatchObject({ status: 500 });
    expect(shouldRetryQuery(0, error, BROWSER)).toBe(true);
    expect(shouldRetryQuery(1, error, BROWSER)).toBe(false);
  });

  it('throws FetchStatusError(404) for a 404, which the QueryClient never retries', async () => {
    stubFetch(() => jsonResponse({ error: 'Not Found' }, 404));

    const error = await rejectionOf(fetchJson(URL_UNDER_TEST));

    expect(error).toBeInstanceOf(FetchStatusError);
    expect(error).toMatchObject({ status: 404 });
    expect(shouldRetryQuery(0, error, BROWSER)).toBe(false);
  });

  it.each([503, 404])("cancels a %i answer's body before throwing", async (status) => {
    const { body, response } = openBodyResponse(status);
    stubFetch(() => response);

    const error = await rejectionOf(fetchJson(URL_UNDER_TEST));

    expect(error).toBeInstanceOf(FetchStatusError);
    expect(error).toMatchObject({ status });
    expect(body.cancelled).toBe(true);
  });

  it('still throws the status error when cancelling the body fails', async () => {
    const { body, response } = openBodyResponse(500, { failCancel: true });
    stubFetch(() => response);

    const error = await rejectionOf(fetchJson(URL_UNDER_TEST));

    expect(body.cancelled).toBe(true);
    expect(error).toBeInstanceOf(FetchStatusError);
    expect(error).toMatchObject({ status: 500 });
  });

  it('still throws the status error for a body that is already locked', async () => {
    const { response } = openBodyResponse(502);
    response.body?.getReader();
    stubFetch(() => response);

    await expect(fetchJson(URL_UNDER_TEST)).rejects.toMatchObject({
      name: 'FetchStatusError',
      status: 502,
    });
  });

  it('aborts the request when the timeout passes', async () => {
    vi.useFakeTimers();
    const fetchMock = stubHangingFetch();

    const pending = rejectionOf(fetchJson(URL_UNDER_TEST, { timeoutMs: 1_000 }));
    await vi.advanceTimersByTimeAsync(1_000);
    const error = await pending;

    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(error).toBeInstanceOf(FetchTimeoutError);
    expect(shouldRetryQuery(0, error, BROWSER)).toBe(true);
  });

  it('still times out once the headers are in, while the JSON body is pending', async () => {
    vi.useFakeTimers();
    const fetchMock = stubStalledBodyFetch();
    let settled = false;

    const pending = rejectionOf(fetchJson(URL_UNDER_TEST, { timeoutMs: 1_000 })).finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(1_000);

    // Settled by the deadline: a timer cleared once the headers came in would leave it hanging.
    expect(settled).toBe(true);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(await pending).toBeInstanceOf(FetchTimeoutError);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not abort before the timeout, which defaults to 5 s', async () => {
    vi.useFakeTimers();
    const fetchMock = stubHangingFetch();

    void rejectionOf(fetchJson(URL_UNDER_TEST));
    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("aborts the request with the query's reason when the query's signal aborts", async () => {
    const fetchMock = stubHangingFetch();
    const query = new AbortController();
    const reason = new Error('query cancelled');

    const pending = rejectionOf(fetchJson(URL_UNDER_TEST, { signal: query.signal }));
    query.abort(reason);

    await expect(pending).resolves.toBe(reason);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('does not start a request whose query is already cancelled', async () => {
    const fetchMock = stubHangingFetch();
    const query = new AbortController();
    query.abort(new Error('cancelled before the call'));

    await rejectionOf(fetchJson(URL_UNDER_TEST, { signal: query.signal }));

    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("stops listening to the query's signal once the request settles", async () => {
    stubFetch(() => jsonResponse({ isPlaying: false }));
    const query = new AbortController();
    const removeSpy = vi.spyOn(query.signal, 'removeEventListener');

    await fetchJson(URL_UNDER_TEST, { signal: query.signal });

    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('clears its timer once the request settles', async () => {
    vi.useFakeTimers();
    stubFetch(() => jsonResponse({ isPlaying: false }));

    await fetchJson(URL_UNDER_TEST);

    expect(vi.getTimerCount()).toBe(0);
  });

  it('throws for a body that is not JSON', async () => {
    stubFetch(
      () =>
        new Response('<html>Bad gateway</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    );

    await expect(fetchJson(URL_UNDER_TEST)).rejects.toBeInstanceOf(SyntaxError);
  });
});

describe('parseNowPlaying', () => {
  it.each([
    ['nothing playing', { isPlaying: false }],
    ['playing, not a track', { isPlaying: true }],
    [
      'a track with every field',
      {
        isPlaying: true,
        songName: 'My War',
        artistName: 'Shinsei Kamattechan',
        songURL: 'https://open.spotify.com/track/abc',
        artistURL: 'https://open.spotify.com/artist/def',
        imageURL: 'https://i.scdn.co/image/ghi',
      },
    ],
  ])('accepts the API answer for %s', (_label, body) => {
    expect(parseNowPlaying(body)).toEqual(body);
  });

  it('drops keys the API does not send', () => {
    expect(parseNowPlaying({ isPlaying: false, progressMs: 3 })).toStrictEqual({
      isPlaying: false,
      songName: undefined,
      artistName: undefined,
      songURL: undefined,
      artistURL: undefined,
      imageURL: undefined,
    });
  });

  it.each([
    ['null', null],
    ['an array', [{ isPlaying: true }]],
    ['no isPlaying', { songName: 'My War' }],
    ['isPlaying as a string', { isPlaying: 'true' }],
    ['a numeric songName', { isPlaying: true, songName: 7 }],
    ['a null artistName', { isPlaying: true, songName: 'My War', artistName: null }],
    ['an object songURL', { isPlaying: true, songURL: { href: 'x' } }],
    ['a numeric imageURL', { isPlaying: true, imageURL: 1 }],
    ['a boolean artistURL', { isPlaying: true, artistURL: false }],
  ])('rejects %s', (_label, body) => {
    expect(() => parseNowPlaying(body)).toThrow(LiveResponseError);
  });
});

const OPERATIONAL = {
  success: true,
  message: 'Status retrieved',
  data: {
    state: 'operational',
    lastUpdated: '2026-11-05T16:02:00.000Z',
    monitors: { up: 6, total: 6 },
  },
};

describe('parseServiceStatus', () => {
  it('reads the data of a fresh answer, monitors included', () => {
    expect(parseServiceStatus(OPERATIONAL)).toEqual(OPERATIONAL.data);
  });

  it.each(['operational', 'degraded', 'down', 'unknown'])('accepts the %s state', (state) => {
    const status = parseServiceStatus({ ...OPERATIONAL, data: { ...OPERATIONAL.data, state } });
    expect(status.state).toBe(state);
  });

  it("accepts the route's fallback, which has a message and no monitors", () => {
    const fallback = {
      success: true,
      message: 'Status retrieved with fallback',
      data: {
        state: 'unknown',
        lastUpdated: '2026-11-05T16:02:00.000Z',
        message: 'Status monitoring temporarily unavailable',
      },
    };

    expect(parseServiceStatus(fallback)).toEqual(fallback.data);
    expect(parseServiceStatus(fallback).monitors).toBeUndefined();
  });

  it("reads the stale flag on the route's cached answer after Better Stack failed", () => {
    const cached = {
      ...OPERATIONAL,
      data: {
        ...OPERATIONAL.data,
        message: 'Using cached status data due to API error',
        stale: true,
      },
    };

    expect(parseServiceStatus(cached)).toEqual(cached.data);
    expect(parseServiceStatus(cached).stale).toBe(true);
    expect(parseServiceStatus(OPERATIONAL).stale).toBeUndefined();
  });

  it('drops keys the route does not send', () => {
    const status = parseServiceStatus({
      ...OPERATIONAL,
      data: { ...OPERATIONAL.data, uptime: 99.9 },
    });
    expect(status).not.toHaveProperty('uptime');
  });

  it.each([
    ['null', null],
    ['no data', { success: true, message: 'Status retrieved' }],
    ['an unknown state', { ...OPERATIONAL, data: { ...OPERATIONAL.data, state: 'maintenance' } }],
    ['no lastUpdated', { ...OPERATIONAL, data: { state: 'operational' } }],
    ['a numeric lastUpdated', { ...OPERATIONAL, data: { ...OPERATIONAL.data, lastUpdated: 1 } }],
    ['a numeric message', { ...OPERATIONAL, data: { ...OPERATIONAL.data, message: 5 } }],
    ['stale as a string', { ...OPERATIONAL, data: { ...OPERATIONAL.data, stale: 'true' } }],
    ['a null stale', { ...OPERATIONAL, data: { ...OPERATIONAL.data, stale: null } }],
    ['null monitors', { ...OPERATIONAL, data: { ...OPERATIONAL.data, monitors: null } }],
    [
      'monitor counts as strings',
      { ...OPERATIONAL, data: { ...OPERATIONAL.data, monitors: { up: '6', total: '6' } } },
    ],
    [
      'a negative monitor count',
      { ...OPERATIONAL, data: { ...OPERATIONAL.data, monitors: { up: -1, total: 6 } } },
    ],
    [
      'a fractional monitor count',
      { ...OPERATIONAL, data: { ...OPERATIONAL.data, monitors: { up: 5.5, total: 6 } } },
    ],
  ])('rejects %s', (_label, body) => {
    expect(() => parseServiceStatus(body)).toThrow(LiveResponseError);
  });
});
