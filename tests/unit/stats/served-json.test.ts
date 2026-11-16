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
 * @file The Discord tile's poll (served-json.ts): fetchJson's request, one attempt that asks for
 * JSON, gives up after 5 s or when the query is cancelled, and cancels a failed answer's body,
 * that also says when the server served the answer, by the server's clock: the response's Date
 * plus its Age. With no Date (some proxies, tests) it says nothing, and the tile then dates by
 * this browser's clock as it did before.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { FetchStatusError, FetchTimeoutError } from '@/app/_components/home/live/live-fetch';
import { fetchServedJson, servedAtOf } from '@/app/(routes)/(dev)/stats/_lib/served-json';

const URL_UNDER_TEST = '/api/v1/lanyard';
const DATE = 'Fri, 13 Nov 2026 18:00:30 GMT';
const DATE_MS = Date.parse('2026-11-13T18:00:30Z');

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

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

describe('servedAtOf', () => {
  it('reads when the server served the answer from its Date', () => {
    expect(servedAtOf(new Headers({ date: DATE }))).toBe(DATE_MS);
  });

  it('adds the seconds a cache kept the answer (Age)', () => {
    expect(servedAtOf(new Headers({ date: DATE, age: '20' }))).toBe(DATE_MS + 20_000);
    expect(servedAtOf(new Headers({ date: DATE, age: '0' }))).toBe(DATE_MS);
  });

  it('ignores an Age that is not whole seconds', () => {
    for (const age of ['', 'soon', '-5', '1.5', '20s', '5, 9']) {
      expect(servedAtOf(new Headers({ date: DATE, age }))).toBe(DATE_MS);
    }
  });

  it('takes an Age as long as the route may be cached: 60 s fresh and 30 s stale', () => {
    expect(servedAtOf(new Headers({ date: DATE, age: '90' }))).toBe(DATE_MS + 90_000);
  });

  it('ignores an Age longer than the route may be cached, or too long to be a number', () => {
    // 2^31 read 'updated 24855 d ago'; 400 digits made the time of serve Infinity, and no age.
    for (const age of ['91', '3600', '2147483648', '9'.repeat(400)]) {
      expect(servedAtOf(new Headers({ date: DATE, age }))).toBe(DATE_MS);
    }
  });

  it('says nothing without a Date, or with one it cannot read', () => {
    expect(servedAtOf(new Headers())).toBeUndefined();
    expect(servedAtOf(new Headers({ age: '20' }))).toBeUndefined();
    expect(servedAtOf(new Headers({ date: 'yesterday' }))).toBeUndefined();
  });
});

describe('fetchServedJson', () => {
  it('resolves the JSON body and when it was served, asking for JSON', async () => {
    const fetchMock = stubFetch(() => jsonResponse({ ok: true }, 200, { date: DATE, age: '3' }));

    await expect(fetchServedJson(URL_UNDER_TEST)).resolves.toEqual({
      json: { ok: true },
      servedAt: DATE_MS + 3_000,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(URL_UNDER_TEST);
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('accept')).toBe(
      'application/json',
    );
  });

  it('resolves no serving time for an answer without a Date', async () => {
    stubFetch(() => jsonResponse({ ok: true }));

    const served = await fetchServedJson(URL_UNDER_TEST);

    expect(served.json).toEqual({ ok: true });
    expect(served.servedAt).toBeUndefined();
  });

  it('throws FetchStatusError for a non-2xx answer and cancels its body', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
    });
    stubFetch(() => new Response(stream, { status: 503, headers: { date: DATE } }));

    const error = await rejectionOf(fetchServedJson(URL_UNDER_TEST));

    expect(error).toBeInstanceOf(FetchStatusError);
    expect(error).toMatchObject({ status: 503 });
    expect(cancelled).toBe(true);
  });

  it('aborts the request when its 5 s pass', async () => {
    vi.useFakeTimers();
    const fetchMock = stubHangingFetch();

    const pending = rejectionOf(fetchServedJson(URL_UNDER_TEST));
    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(await pending).toBeInstanceOf(FetchTimeoutError);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts the request with the query's reason when the query is cancelled", async () => {
    const fetchMock = stubHangingFetch();
    const query = new AbortController();
    const reason = new Error('query cancelled');

    const pending = rejectionOf(fetchServedJson(URL_UNDER_TEST, { signal: query.signal }));
    query.abort(reason);

    await expect(pending).resolves.toBe(reason);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
});
