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
 * @file The Discord tile's poll: the home islands' request (fetchJson in live-fetch.ts: one
 * attempt that asks for JSON, a 5 s timeout, the query's abort, a failed answer's body
 * cancelled) that also says when the server served the answer, by the server's clock. The tile
 * orders and ages its reads by that clock (discord-presence.ts). Pure (no directive, no Effect),
 * so the island's bundle stays small; live-fetch.ts stays as the home page uses it. The route's
 * cache rule is restated below rather than imported: its module (the API's shared middleware)
 * would bring the server's error reporting and logger into the island.
 */

import {
  type FetchJsonOptions,
  FetchStatusError,
  FetchTimeoutError,
  LIVE_FETCH_TIMEOUT_MS,
} from '@/app/_components/home/live/live-fetch';

/** An answer's JSON body, and when the server served it (epoch ms, by its clock), if it said. */
export interface ServedJson {
  readonly json: unknown;
  readonly servedAt?: number;
}

/** Age is a count of whole seconds; anything else is no Age. */
const WHOLE_SECONDS = /^\d+$/;
const SECOND_MS = 1000;

/**
 * The longest a cache may hold /api/v1/lanyard, in seconds: the route sends
 * `Cache-Control: public, s-maxage=60, stale-while-revalidate=30` (CachePresets.Short),
 * so a shared cache keeps a copy fresh for 60 s and may serve it stale for 30 s more, and no copy
 * it serves under that rule is older. A longer Age comes from no cache that keeps it: a broken
 * one, or garbage (2^31 read 'updated 24855 d ago'; 400 digits made the time of serve Infinity).
 */
const LONGEST_CACHED_S = 60 + 30;

/**
 * When the server served a response, by its clock: its Date, plus its Age when a cache kept the
 * copy (a cache passes the origin's Date on and counts the seconds it held the copy in Age).
 * Both are whole seconds. An Age that is not a whole number of seconds, or longer than the route
 * may be cached ({@link LONGEST_CACHED_S}), is ignored. Undefined without a Date it can read:
 * the tile then dates by this browser's clock, as it did before the header was read.
 *
 * Both kinds of copy reach the tile. On the live site Vercel's CDN keeps the route's answer
 * (measured 14 November 2026: x-vercel-cache HIT, the same Date on every hit and Age 0, 4, 9 s
 * apart), so a CDN copy carries the origin's Date plus its Age. Each server instance also keeps
 * its own cache and stamps its own Date when it serves from it. The local dev server sends no Age.
 */
export function servedAtOf(headers: Headers): number | undefined {
  const date = Date.parse(headers.get('date') ?? '');
  if (!Number.isFinite(date)) return undefined;
  const age = headers.get('age')?.trim() ?? '';
  const seconds = WHOLE_SECONDS.test(age) ? Number(age) : Number.NaN;
  return seconds <= LONGEST_CACHED_S ? date + seconds * SECOND_MS : date;
}

/**
 * Lets go of a body nobody will read, as fetchJson does, so a failed poll holds no connection.
 * A cancel that fails changes nothing for the caller, whose error is the status.
 */
async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Already locked or errored: there is nothing left to release.
  }
}

/**
 * GETs `url` and resolves its JSON body with when the server served it ({@link servedAtOf}).
 *
 * @throws {FetchStatusError} For a non-2xx answer, carrying its status (its body is cancelled).
 * @throws {FetchTimeoutError} When the answer or its body takes longer than `timeoutMs`.
 * @throws The caller's abort reason when `signal` aborts, and a SyntaxError for a non-JSON body.
 */
export async function fetchServedJson(
  url: string,
  { signal, timeoutMs = LIVE_FETCH_TIMEOUT_MS }: FetchJsonOptions = {},
): Promise<ServedJson> {
  const controller = new AbortController();
  const abortWithCaller = (): void => controller.abort(signal?.reason);
  if (signal?.aborted) abortWithCaller();
  signal?.addEventListener('abort', abortWithCaller, { once: true });
  const timer = setTimeout(() => controller.abort(new FetchTimeoutError(timeoutMs)), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      await discardBody(response);
      throw new FetchStatusError(response.status);
    }
    const json: unknown = await response.json();
    return { json, servedAt: servedAtOf(response.headers) };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortWithCaller);
  }
}
