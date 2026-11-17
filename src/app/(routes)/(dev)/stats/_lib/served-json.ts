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
 * cancelled), shared through lib/http-clients/live-json.ts, that also says when the server served the answer, by the server's clock. The tile
 * orders and ages its reads by that clock (discord-presence.ts). Pure (no directive, no Effect),
 * so the island's bundle stays small; the home page keeps its existing JSON-only interface. The route's
 * cache rule is restated below rather than imported: its module (the API's shared middleware)
 * would bring the server's error reporting and logger into the island.
 */

import { type FetchJsonOptions, fetchJsonResponse } from '@/lib/http-clients/live-json';

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

/** Read JSON with the shared transport and keep the server's Date/Age metadata. */
export async function fetchServedJson(
  url: string,
  options: FetchJsonOptions = {},
): Promise<ServedJson> {
  const { json, headers } = await fetchJsonResponse(url, options);
  return { json, servedAt: servedAtOf(headers) };
}
