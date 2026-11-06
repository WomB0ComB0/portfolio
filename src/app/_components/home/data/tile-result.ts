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
 * @file What the home tiles' server loaders answer, and {@link settle}, which turns a load into
 * one that never throws and never holds the stream past its deadline.
 *
 * No directive and no 'server-only': the types are shared with the client islands. Islands
 * import them with `import type` only, because settle's reporting brings Sentry and Effect.
 */

import { ensureBaseError } from '@/classes/error';
import { DeadlineError, withDeadline } from '@/lib/async/deadline';
import { reportApiFailure } from '@/lib/observability/report';

/**
 * A server-rendered tile's data.
 * - `ok`: data to show. `stale` marks the last good answer, served because the upstream just
 *   failed; `asOf` (ISO 8601) is when that data was loaded, when the source knows it.
 * - `empty`: the source answered, but there is nothing to show (no current role, no 60 s test).
 * - `error`: the source failed or ran out of time. The tile shows its error copy, never a number.
 */
export type TileResult<T> =
  | { readonly status: 'ok'; readonly data: T; readonly stale: boolean; readonly asOf?: string }
  | { readonly status: 'empty' }
  | { readonly status: 'error' };

/**
 * A live island's server snapshot.
 * - `data`: what the source answered, and when (epoch ms), for TanStack Query's
 *   `initialDataUpdatedAt`.
 * - `error`: the source failed. The island shows its error state and fetches on its own.
 * - `timeout`: the source was too slow for the server render. The island shows its skeleton and
 *   fetches on its own.
 */
export type LiveInitial<T> =
  | { readonly kind: 'data'; readonly data: T; readonly fetchedAt: number }
  | { readonly kind: 'error' }
  | { readonly kind: 'timeout' };

/** How long a server tile may hold its Suspense boundary before it renders its error state. */
export const SERVER_TILE_DEADLINE_MS = 4_000;

/** How long a live tile's server snapshot may take; past it the island fetches for itself. */
export const LIVE_TILE_DEADLINE_MS = 2_500;

const ERROR_RESULT: TileResult<never> = { status: 'error' };

/**
 * Reports a tile's failure: a missed deadline is a warning (the source may just be slow, and its
 * late answer still fills its cache), anything else is an error. The context names the tile.
 */
function reportTileFailure(name: string, error: unknown): void {
  reportApiFailure(ensureBaseError(error, `home:${name}`), {
    context: `home ${name} tile`,
    level: error instanceof DeadlineError ? 'warning' : 'error',
  });
}

export interface SettleOptions<T> {
  /** How long the load may run. Defaults to {@link SERVER_TILE_DEADLINE_MS}. */
  readonly deadlineMs?: number;
  /**
   * What the tile shows when the deadline passes first, typically its source's last good value
   * marked stale ({@link staleTile}). It must answer at once, without loading. Undefined (nothing
   * was ever loaded), or a throw, leaves the error state.
   */
  readonly onDeadline?: () => TileResult<T> | undefined;
}

/**
 * `data` as the last good answer, loaded at `asOf` (ISO 8601): served because its source just
 * failed, or was slower than the tile's deadline.
 */
export const staleTile = <T>(data: T, asOf: string): TileResult<T> => ({
  status: 'ok',
  data,
  stale: true,
  asOf,
});

/** What `onDeadline` answers; a throw is reported as the tile's error and leaves undefined. */
function deadlineFallback<T>(
  name: string,
  onDeadline: () => TileResult<T> | undefined,
): TileResult<T> | undefined {
  try {
    return onDeadline();
  } catch (error) {
    reportTileFailure(name, error);
    return undefined;
  }
}

/**
 * Runs a tile's load under a deadline and never rejects.
 *
 * - Resolves with what `run` resolves with, if that comes within the deadline.
 * - A rejection, a synchronous throw or a missed deadline is reported (context `home <name>
 *   tile`) and resolves `{ status: 'error' }`.
 * - A missed deadline resolves what `onDeadline` answers instead, when it answers: the last good
 *   value, so a slow reload does not hide data the source still holds. It is reported once, as
 *   any missed deadline is (a warning).
 * - The load is not cancelled: a late answer still fills its source's cache for the next
 *   request, and a late rejection is handled, never unhandled.
 *
 * @param name - The tile, e.g. 'github'. Tags the error (`home:github`) and the report.
 *
 * @example
 * const result = await settle('typing', async () => typingTile(await readProfile()), {
 *   onDeadline: () => {
 *     const cached = peekProfile();
 *     return cached && staleTile(toStats(cached.data), new Date(cached.loadedAt).toISOString());
 *   },
 * });
 */
export async function settle<T>(
  name: string,
  run: () => Promise<TileResult<T>>,
  { deadlineMs = SERVER_TILE_DEADLINE_MS, onDeadline }: SettleOptions<T> = {},
): Promise<TileResult<T>> {
  const label = `home:${name}`;
  try {
    return await withDeadline(run(), deadlineMs, label);
  } catch (error) {
    reportTileFailure(name, error);
    const missedDeadline = error instanceof DeadlineError && error.label === label;
    if (!missedDeadline || !onDeadline) return ERROR_RESULT;
    return deadlineFallback(name, onDeadline) ?? ERROR_RESULT;
  }
}
