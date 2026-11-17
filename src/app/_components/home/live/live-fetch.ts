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

import { type FetchJsonOptions, fetchJsonResponse } from '@/lib/http-clients/live-json';

export type { FetchJsonOptions } from '@/lib/http-clients/live-json';
// Keep existing import paths and error identity for callers of the home reader.
export {
  FetchStatusError,
  FetchTimeoutError,
} from '@/lib/http-clients/live-json';

/** The endpoint answered JSON of the wrong shape. */
export class LiveResponseError extends Error {
  override readonly name = 'LiveResponseError';
}

/** GET JSON using the shared request timeout, caller abort and failed-body cleanup. */
export async function fetchJson(url: string, options: FetchJsonOptions = {}): Promise<unknown> {
  return (await fetchJsonResponse(url, options)).json;
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
