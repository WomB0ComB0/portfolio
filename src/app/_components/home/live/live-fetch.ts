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
 * @file How the home page's live islands poll their endpoints: plain fetch with a timeout, and
 * hand-written parsers for the two answers. Pure (no directive) and free of Effect, so the
 * islands' client bundle stays small.
 *
 * One attempt per call: the QueryClient's shared rule (shouldRetryQuery) is the only retry
 * layer. It reads `status` off a thrown error, so a FetchStatusError for a 4xx is never retried
 * and one for a 5xx is retried once.
 */

import type { ServiceStatus } from '@/app/api/[[...route]]/status/schema';
import type { NowPlayingResponse } from '@/app/api/v1/[[...route]]/now-playing/handlers';

/** How long one poll may take, body included, before it is aborted. */
export const LIVE_FETCH_TIMEOUT_MS = 5_000;

/** The endpoint answered with a status outside 200-299. */
export class FetchStatusError extends Error {
  override readonly name = 'FetchStatusError';

  constructor(readonly status: number) {
    super(`Request failed with status ${status}`);
  }
}

/** The endpoint did not answer (body included) within the timeout. */
export class FetchTimeoutError extends Error {
  override readonly name = 'FetchTimeoutError';

  constructor(readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs} ms`);
  }
}

/** The endpoint answered JSON of the wrong shape. */
export class LiveResponseError extends Error {
  override readonly name = 'LiveResponseError';
}

export interface FetchJsonOptions {
  /** TanStack Query's signal: aborting it (a cancelled query) aborts the request. */
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Lets go of a body nobody will read. Left alone, the browser keeps the response stream open:
 * the page never reaches network idle and, on HTTP/1.1, every failed poll holds one of the
 * origin's six connections. A cancel that fails changes nothing for the caller, whose error is
 * the status, so its rejection is dropped here on purpose.
 */
async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Already locked or errored: there is nothing left to release.
  }
}

/**
 * GETs `url` and resolves its JSON body.
 *
 * @throws {FetchStatusError} For a non-2xx answer, carrying its status (its body is cancelled).
 * @throws {FetchTimeoutError} When the answer or its body takes longer than `timeoutMs`.
 * @throws The caller's abort reason when `signal` aborts, and a SyntaxError for a non-JSON body.
 */
export async function fetchJson(
  url: string,
  { signal, timeoutMs = LIVE_FETCH_TIMEOUT_MS }: FetchJsonOptions = {},
): Promise<unknown> {
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
    return await response.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortWithCaller);
  }
}

type JsonObject = Readonly<Record<string, unknown>>;

/** An array passes too; every caller's field checks then reject it. */
const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null;

function expectObject(value: unknown, what: string): JsonObject {
  if (!isObject(value)) throw new LiveResponseError(`${what} is not an object`);
  return value;
}

/** `object[key]` when it is a string, undefined when it is absent; anything else throws. */
function optionalString(object: JsonObject, key: string): string | undefined {
  const value = object[key];
  if (value === undefined || typeof value === 'string') return value;
  throw new LiveResponseError(`${key} is not a string`);
}

/** `object[key]` when it is a boolean, undefined when it is absent; anything else throws. */
function optionalBoolean(object: JsonObject, key: string): boolean | undefined {
  const value = object[key];
  if (value === undefined || typeof value === 'boolean') return value;
  throw new LiveResponseError(`${key} is not a boolean`);
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/**
 * /api/v1/now-playing's answer. `isPlaying` must be a boolean; the track fields are optional
 * strings. Unknown keys are dropped.
 *
 * @throws {LiveResponseError} For any other shape.
 */
export function parseNowPlaying(json: unknown): NowPlayingResponse {
  const body = expectObject(json, 'now-playing');
  if (typeof body.isPlaying !== 'boolean') throw new LiveResponseError('isPlaying is missing');
  return {
    isPlaying: body.isPlaying,
    songName: optionalString(body, 'songName'),
    artistName: optionalString(body, 'artistName'),
    songURL: optionalString(body, 'songURL'),
    artistURL: optionalString(body, 'artistURL'),
    imageURL: optionalString(body, 'imageURL'),
  };
}

const SERVICE_STATES: readonly ServiceStatus['state'][] = [
  'operational',
  'degraded',
  'down',
  'unknown',
];

const isServiceState = (value: unknown): value is ServiceStatus['state'] =>
  SERVICE_STATES.some((state) => state === value);

function parseMonitors(value: unknown): ServiceStatus['monitors'] {
  if (value === undefined) return undefined;
  const monitors = expectObject(value, 'monitors');
  if (!isCount(monitors.up) || !isCount(monitors.total)) {
    throw new LiveResponseError('monitors are not counts');
  }
  return { up: monitors.up, total: monitors.total };
}

/**
 * The `data` of /api/status's answer: a known state, `lastUpdated` as a string, and the optional
 * message, monitor counts and `stale` flag (the route's cached answer after Better Stack failed).
 * Unknown keys are dropped.
 *
 * @throws {LiveResponseError} For any other shape.
 */
export function parseServiceStatus(json: unknown): ServiceStatus {
  const data = expectObject(expectObject(json, 'status').data, 'status data');
  if (!isServiceState(data.state)) throw new LiveResponseError('state is not a known state');
  if (typeof data.lastUpdated !== 'string') throw new LiveResponseError('lastUpdated is missing');
  return {
    state: data.state,
    lastUpdated: data.lastUpdated,
    message: optionalString(data, 'message'),
    monitors: parseMonitors(data.monitors),
    stale: optionalBoolean(data, 'stale'),
  };
}
