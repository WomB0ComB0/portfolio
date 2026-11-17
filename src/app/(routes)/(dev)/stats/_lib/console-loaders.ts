import 'server-only';

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
 * @file The /stats console's server loaders, which the page awaits at the top so every figure is
 * final in the server HTML (no Suspense skeleton, no loading.tsx), as /certifications, /projects
 * and /places do.
 *
 * - Each source settles on its own and never throws: within its deadline (STATS_DEADLINE_MS for a
 *   tile, DISCORD_DEADLINE_MS for the live Discord snapshot) it is what the source answered;
 *   past it, the answer it last gave, marked stale, else its error state. A late answer still
 *   fills its handler's cache for the next request (after() keeps that load alive).
 * - The hourly sources (GitHub totals, coding time, page views) never wait on a reload of an
 *   answer their handler holds: past the hour it shows at once, stale, while the handler
 *   refreshes in the background. Only a source with nothing cached is waited for.
 * - The handlers are called directly, never through the site's own /api/v1, and keep their
 *   caches (processGlobal) and upstream deadlines as they are.
 * - The GitHub activity, LeetCode, typing and now-playing sources are the home bento's own
 *   loaders, so home and /stats always show the same numbers.
 */

import { cache } from 'react';

import {
  loadGitHubActivity,
  loadLeetCode,
  loadNowPlaying,
  loadTyping,
} from '@/app/_components/home/data/loaders';
import type { TypingTileData } from '@/app/_components/home/data/selectors';
import {
  LIVE_TILE_DEADLINE_MS,
  type LiveInitial,
  SERVER_TILE_DEADLINE_MS,
  settle,
  staleTile,
  type TileResult,
} from '@/app/_components/home/data/tile-result';
import {
  type GitHubStatsData,
  getGitHubStats,
  peekGitHubStats,
} from '@/app/api/v1/[[...route]]/github-stats/handlers';
import { getGoogleAnalytics, peekGoogleAnalytics } from '@/app/api/v1/[[...route]]/google/handlers';
import { getLanyardSnapshot, type LanyardData } from '@/app/api/v1/[[...route]]/lanyard/handlers';
import { type LeetCodeStats, peekLeetCodeStats } from '@/app/api/v1/[[...route]]/leetcode/handlers';
import {
  getWakaTimeData,
  peekWakaTimeData,
  type WakaTimeData,
} from '@/app/api/v1/[[...route]]/wakatime/handlers';
import { ensureBaseError } from '@/classes/error';
import { peekMonkeytypeProfile } from '@/lib/api-integrations/monkeytype';
import { DeadlineError, withDeadline } from '@/lib/async/deadline';
import { keepAlive } from '@/lib/cache/keep-alive';
import type { CachedValue } from '@/lib/cache/stale-cache';
import { reportApiFailure } from '@/lib/observability/report';
import type { StatsConsoleData } from './console-model';

/** How long a tile's source may take before it shows its last answer (or its error state). */
export const STATS_DEADLINE_MS = SERVER_TILE_DEADLINE_MS;
/** How long the Discord snapshot may take; past it the island fetches for itself. */
export const DISCORD_DEADLINE_MS = LIVE_TILE_DEADLINE_MS;
/**
 * How long the GitHub stats, WakaTime and Google handlers serve one answer before asking again.
 * An answer older than this was served because the reload failed: stale.
 */
const HANDLER_TTL_MS = 60 * 60_000;

const EMPTY: TileResult<never> = { status: 'empty' };

/**
 * A source cache entry as a tile: empty when `toData` finds nothing to show, stale when older than the
 * handler's hour (or when `forceStale`, past a deadline), dated by the original cache timestamp.
 */
function cachedTile<S, T>(
  seen: CachedValue<S>,
  toData: (data: S) => T | null,
  now: number,
  forceStale = false,
): TileResult<T> {
  const data = toData(seen.data);
  if (data === null) return EMPTY;
  const asOf = new Date(seen.loadedAt).toISOString();
  if (forceStale || now - seen.loadedAt >= HANDLER_TTL_MS) return staleTile(data, asOf);
  return { status: 'ok', data, stale: false, asOf };
}

/** A loaded answer as a tile, dated by the handler's cache when the answer is what it holds. */
function loadedTile<S, T>(
  raw: S,
  peek: () => CachedValue<S> | undefined,
  toData: (data: S) => T | null,
): TileResult<T> {
  const data = toData(raw);
  if (data === null) return EMPTY;
  const cached = peek();
  return cached?.data === raw
    ? cachedTile(cached, toData, Date.now())
    : { status: 'ok', data, stale: false };
}

/**
 * Loads an hourly source and uses the handler's original timestamp, even when a v1 call filled
 * the cache before any Stats visit. A result with no matching cache entry stays undated rather
 * than inventing an update time.
 *
 * The page never waits on a reload of an answer the handler holds: past the handler's hour, that
 * answer is shown at once (dated, so stale) while the handler's own refresh, one at a time for
 * every caller, runs in the background, kept alive past the response. Only a source with nothing
 * cached is waited for, STATS_DEADLINE_MS at most; past it the load carries on (kept alive) and
 * fills the cache for the next request.
 */
function loadCached<S, T>(
  source: string,
  load: () => Promise<S>,
  peek: () => CachedValue<S> | undefined,
  toData: (data: S) => T | null,
): Promise<TileResult<T>> {
  let loading: Promise<S> | undefined;
  return settle(
    `stats-${source}`,
    async () => {
      const held = peek();
      if (held && Date.now() - held.loadedAt >= HANDLER_TTL_MS) {
        keepAlive(load());
        return cachedTile(held, toData, Date.now());
      }
      loading = load();
      return loadedTile(await loading, peek, toData);
    },
    {
      deadlineMs: STATS_DEADLINE_MS,
      onDeadline: () => {
        if (loading) keepAlive(loading);
        const cached = peek();
        return cached ? cachedTile(cached, toData, Date.now(), true) : undefined;
      },
    },
  );
}

const itself = <T>(data: T): T => data;

/** Repositories, stars, followers and the top repositories (every page, since the stars fix). */
export const loadGitHubTotals = cache(
  (): Promise<TileResult<GitHubStatsData>> =>
    loadCached('github', getGitHubStats, peekGitHubStats, itself),
);

/** All-time coding time. */
export const loadCodingTime = cache(
  (): Promise<TileResult<WakaTimeData>> =>
    loadCached('wakatime', getWakaTimeData, peekWakaTimeData, itself),
);

/**
 * Page views over 30 days. When Analytics fails the Google handler answers the count it last
 * held (dated by its cache, so stale once past the hour), or 0 when it never had one; it never
 * caches that 0. So zero is no count, never a figure.
 */
export const loadPageViews = cache(
  (): Promise<TileResult<number>> =>
    loadCached(
      'pageviews',
      getGoogleAnalytics,
      peekGoogleAnalytics,
      ({ total_pageviews: views }) => (Number.isFinite(views) && views > 0 ? views : null),
    ),
);

/**
 * `result` dated `loadedAt` (epoch ms) when it is ok and not dated yet: the home loaders date only
 * stale results, while /stats says how old every figure is.
 */
function withAsOf<T>(result: TileResult<T>, loadedAt: number | undefined): TileResult<T> {
  if (result.status !== 'ok' || result.asOf || loadedAt === undefined) return result;
  return { ...result, asOf: new Date(loadedAt).toISOString() };
}

/** LeetCode's solved counts (the home loader), dated from LeetCode's cache. */
export const loadLeetCodeStats = cache(
  async (): Promise<TileResult<LeetCodeStats>> =>
    withAsOf(await loadLeetCode(), peekLeetCodeStats()?.loadedAt),
);

/** The fastest 60 s Monkeytype test (the home loader), dated from Monkeytype's cache. */
export const loadTypingStats = cache(
  async (): Promise<TileResult<TypingTileData>> =>
    withAsOf(await loadTyping(), peekMonkeytypeProfile()?.loadedAt),
);

const DISCORD_LABEL = 'stats:discord';

/**
 * The Discord presence snapshot for the live island, dated by when the handler read it from
 * Lanyard (its cache holds a read for a minute). A missed deadline is a timeout and is not
 * reported (Lanyard may just be slow; the island fetches for itself); a failure is a warning,
 * since the island recovers on its next poll. Never throws.
 */
export const loadDiscord = cache(async (): Promise<LiveInitial<LanyardData>> => {
  try {
    const { data, readAt } = await withDeadline(
      getLanyardSnapshot(),
      DISCORD_DEADLINE_MS,
      DISCORD_LABEL,
    );
    return { kind: 'data', data, fetchedAt: readAt };
  } catch (error) {
    if (error instanceof DeadlineError && error.label === DISCORD_LABEL) return { kind: 'timeout' };
    reportApiFailure(ensureBaseError(error, DISCORD_LABEL), {
      context: 'stats discord tile',
      level: 'warning',
    });
    return { kind: 'error' };
  }
});

/**
 * Everything the console shows, every source loaded in parallel and settled on its own: the
 * page waits at most the slowest deadline ({@link STATS_DEADLINE_MS}), and one source failing
 * never fails the page.
 */
export const loadStatsConsole = cache(async (): Promise<StatsConsoleData> => {
  const [activity, totals, leetcode, typing, codingTime, pageViews, discord, nowPlaying] =
    await Promise.all([
      loadGitHubActivity(),
      loadGitHubTotals(),
      loadLeetCodeStats(),
      loadTypingStats(),
      loadCodingTime(),
      loadPageViews(),
      loadDiscord(),
      loadNowPlaying(),
    ]);
  return { activity, totals, leetcode, typing, codingTime, pageViews, discord, nowPlaying };
});
