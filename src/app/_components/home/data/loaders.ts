import 'server-only';

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
 * @file The home tiles' server loaders. Server components import this module; client islands
 * never do (they get their snapshot as a prop).
 *
 * - Every loader is React-cache()d per request and never throws: a failure, or a source slower
 *   than its deadline, becomes the tile's error (or timeout) state and is reported once. No tile
 *   can fail the page or hold the stream.
 * - A server tile whose source is still reloading at the deadline shows the value that source
 *   last loaded (peeked, never awaited), marked stale with when it was loaded, rather than its
 *   error state. The reload keeps running and fills the cache for the next request.
 * - The Sanity tiles pick from the lists the pages already load (shared, stale-on-error caches),
 *   so each fails on its own collection only.
 * - A stale answer (the last good one, served because its source just failed) is shown, marked
 *   stale, with a warning, except for now playing: an old track must never show as playing.
 * - The project tile also reads the owner's recent commits on GitHub (a source of their own,
 *   apart from the GitHub tile's, so each tile's failure is reported under its own name), but
 *   never fails or waits past its own short budget for them: without them it shows the featured
 *   pick, as before.
 * - Route handlers are called directly; their schema modules are imported as types only, so
 *   Elysia never loads here.
 */

import { cache } from 'react';
import { handleStatusCheck, peekServiceStatus } from '@/app/api/[[...route]]/status/handlers';
import type { ServiceStatus } from '@/app/api/[[...route]]/status/schema';
import {
  type LeetCodeStats,
  peekLeetCodeStats,
  readLeetCodeStats,
} from '@/app/api/v1/[[...route]]/leetcode/handlers';
import {
  getNowPlaying,
  type NowPlayingResponse,
} from '@/app/api/v1/[[...route]]/now-playing/handlers';
import { ensureBaseError } from '@/classes/error';
import {
  type CommittedRepo,
  type GitHubActivity,
  peekGitHubActivity,
  peekRecentCommits,
  type RecentCommits,
  readGitHubActivity,
  readRecentCommits,
} from '@/lib/api-integrations/github-activity';
import {
  type MonkeytypeProfile,
  peekMonkeytypeProfile,
  readMonkeytypeProfile,
} from '@/lib/api-integrations/monkeytype';
import { DeadlineError, withDeadline } from '@/lib/async/deadline';
import { type CachedValue, createStaleCache, type StaleCacheResult } from '@/lib/cache/stale-cache';
import { reportApiFailure } from '@/lib/observability/report';
import {
  type Experience,
  loadCertifications,
  loadExperiences,
  loadPlaces,
  loadProjects,
  type Place,
  type Project,
  peekCertifications,
  peekExperiences,
  peekPlaces,
  peekProjects,
} from '@/lib/sanity/loaders';
import {
  type CurrentRoles,
  hasBest60,
  type ProjectPick,
  placeCutoffDay,
  selectCurrentRoles,
  selectLatestPlace,
  selectProjectPick,
  type TypingTileData,
  toTypingStats,
} from './selectors';
import {
  LIVE_TILE_DEADLINE_MS,
  type LiveInitial,
  SERVER_TILE_DEADLINE_MS,
  settle,
  staleTile,
  type TileResult,
} from './tile-result';

/** How many documents each section holds, for the site index. Null when its list failed. */
export interface SiteCounts {
  readonly projects: number | null;
  readonly roles: number | null;
  readonly certifications: number | null;
  readonly places: number | null;
}

/** Spotify's answer is reused this long, so concurrent renders share one request. */
export const NOW_PLAYING_TTL_MS = 15_000;
const NOW_PLAYING_KEY = 'now';

/**
 * How long the project tile waits for the owner's recent commits. Shorter than the tile's own
 * deadline ({@link SERVER_TILE_DEADLINE_MS}), so a slow GitHub alone never runs the tile out of
 * time: Sanity's list, loaded alongside, still decides when it renders.
 */
export const PROJECT_ACTIVITY_BUDGET_MS = SERVER_TILE_DEADLINE_MS - 1_000;
const PROJECT_ACTIVITY_LABEL = 'home:project-activity';
/** Its own context, so a GitHub warning never holds back the project tile's Sanity reports. */
const PROJECT_ACTIVITY_CONTEXT = 'home project activity';

const EMPTY: TileResult<never> = { status: 'empty' };

const fresh = <T>(data: T): TileResult<T> => ({ status: 'ok', data, stale: false });

/** Data, or the empty state when there is none. */
const okOrEmpty = <T>(data: T | null): TileResult<T> => (data === null ? EMPTY : fresh(data));

/**
 * `tile` as the last good answer, loaded at `loadedAt` (epoch ms). Empty and error pass
 * through; an `asOf` the tile already carries (when its source answered) is kept.
 */
function asStale<T>(tile: TileResult<T>, loadedAt: number): TileResult<T> {
  if (tile.status !== 'ok') return tile;
  return staleTile(tile.data, tile.asOf ?? new Date(loadedAt).toISOString());
}

/**
 * What a tile shows when its deadline passes: `toTile` of the value its source last loaded,
 * marked stale. Undefined, so the error state, when the source never loaded one.
 */
function lastGood<S, T>(
  cached: CachedValue<S> | undefined,
  toTile: (data: S) => TileResult<T>,
): TileResult<T> | undefined {
  if (!cached) return undefined;
  return asStale(toTile(cached.data), cached.loadedAt);
}

/** A stale answer still renders, so its source's failure is a warning. */
function reportStale(result: StaleCacheResult<unknown>, command: string, tile: string): void {
  if (!result.stale) return;
  reportApiFailure(ensureBaseError(result.error, command), {
    context: `home ${tile} tile`,
    level: 'warning',
  });
}

const rolesTile = (experiences: readonly Experience[]): TileResult<CurrentRoles> => {
  const roles = selectCurrentRoles(experiences);
  return roles.total === 0 ? EMPTY : fresh(roles);
};

const placeTile = (places: readonly Place[]): TileResult<Place> =>
  okOrEmpty(selectLatestPlace(places, placeCutoffDay(Date.now())));

const projectTile = (
  projects: readonly Project[],
  repos: readonly CommittedRepo[],
): TileResult<ProjectPick> => okOrEmpty(selectProjectPick(projects, repos, Date.now()));

/** The repositories in `commits`, none without an answer. */
const reposOf = (commits: RecentCommits | undefined): readonly CommittedRepo[] =>
  commits?.repos ?? [];

/**
 * A GitHub problem the project tile got past: it still shows a project, so it is a warning. The
 * error comes from the recent commits' own source, never the GitHub tile's, so this report never
 * stands in for (and so silences) that tile's own.
 */
function reportActivityProblem(error: unknown): void {
  reportApiFailure(ensureBaseError(error, PROJECT_ACTIVITY_LABEL), {
    context: PROJECT_ACTIVITY_CONTEXT,
    level: 'warning',
  });
}

/**
 * The owner's recent commits for the project tile. Never rejects. A stale answer is used (its
 * days are still true). A failure, or no answer within {@link PROJECT_ACTIVITY_BUDGET_MS}, leaves
 * the commits GitHub last answered (peeked), else none. Each is one warning.
 */
async function recentCommits(): Promise<readonly CommittedRepo[]> {
  try {
    const result = await withDeadline(
      readRecentCommits(),
      PROJECT_ACTIVITY_BUDGET_MS,
      PROJECT_ACTIVITY_LABEL,
    );
    if (result.stale) reportActivityProblem(result.error);
    return reposOf(result.data);
  } catch (error) {
    reportActivityProblem(error);
    return reposOf(peekRecentCommits()?.data);
  }
}

/**
 * The current roles (first 3 in Studio order, plus the total); empty when none is current.
 * Past the deadline, from the last experiences cached.
 */
export const loadCurrentRoles = cache(
  (): Promise<TileResult<CurrentRoles>> =>
    settle('roles', async () => rolesTile(await loadExperiences()), {
      onDeadline: () => lastGood(peekExperiences(), rolesTile),
    }),
);

/**
 * The place whose visit ended most recently before the cutoff day (selectLatestPlace: past visits
 * only; placeCutoffDay: New York's yesterday until noon ET, so a visit shows from noon ET the day
 * after); empty when none has. Past the deadline, from the last places cached.
 */
export const loadLatestPlace = cache(
  (): Promise<TileResult<Place>> =>
    settle('place', async () => placeTile(await loadPlaces()), {
      onDeadline: () => lastGood(peekPlaces(), placeTile),
    }),
);

/**
 * The project of the repository the owner committed to last (selectProjectPick: his own commits,
 * within 30 days, never this site), else the first featured project with a cover (else without
 * one); empty when there is neither. GitHub failing or slow leaves the featured pick and never
 * fails the tile; Sanity failing does. Past the deadline, from the last projects and commits
 * cached.
 */
export const loadProjectPick = cache(
  (): Promise<TileResult<ProjectPick>> =>
    settle(
      'project',
      async () => {
        const [projects, repos] = await Promise.all([loadProjects(), recentCommits()]);
        return projectTile(projects, repos);
      },
      {
        onDeadline: () =>
          lastGood(peekProjects(), (projects) =>
            projectTile(projects, reposOf(peekRecentCommits()?.data)),
          ),
      },
    ),
);

const lengthTile = (list: readonly unknown[]): TileResult<number> => fresh(list.length);

/**
 * The length of one list, or null when it failed (reported as the counts tile's failure). Past
 * the deadline, the length of the list last cached, when there is one.
 */
async function countOf(
  load: () => Promise<readonly unknown[]>,
  peek: () => CachedValue<readonly unknown[]> | undefined,
): Promise<number | null> {
  const result = await settle('counts', async () => lengthTile(await load()), {
    onDeadline: () => lastGood(peek(), lengthTile),
  });
  return result.status === 'ok' ? result.data : null;
}

/** How many projects, roles, certifications and places there are; each list fails on its own. */
export const loadSiteCounts = cache(async (): Promise<SiteCounts> => {
  const [projects, roles, certifications, places] = await Promise.all([
    countOf(loadProjects, peekProjects),
    countOf(loadExperiences, peekExperiences),
    countOf(loadCertifications, peekCertifications),
    countOf(loadPlaces, peekPlaces),
  ]);
  return { projects, roles, certifications, places };
});

const githubTile = (activity: GitHubActivity): TileResult<GitHubActivity> => ({
  status: 'ok',
  data: activity,
  stale: false,
  asOf: activity.fetchedAt,
});

/**
 * Twelve weeks of contributions and the latest public commit. `asOf` is when GitHub answered.
 * Zero contributions is data, not empty. Past the deadline, the activity last cached, stale.
 */
export const loadGitHubActivity = cache(
  (): Promise<TileResult<GitHubActivity>> =>
    settle(
      'github',
      async () => {
        const result = await readGitHubActivity();
        reportStale(result, 'github:activity', 'github');
        const tile = githubTile(result.data);
        return result.stale ? asStale(tile, result.loadedAt) : tile;
      },
      { onDeadline: () => lastGood(peekGitHubActivity(), githubTile) },
    ),
);

/**
 * LeetCode's solved counts. Its handler serves (and reports) its own stale fallback, which is
 * marked stale with when LeetCode gave it. Past the deadline, the stats last fetched, stale.
 */
export const loadLeetCode = cache(
  (): Promise<TileResult<LeetCodeStats>> =>
    settle(
      'leetcode',
      async () => {
        const read = await readLeetCodeStats();
        const tile = fresh(read.data);
        return read.stale ? asStale(tile, read.loadedAt) : tile;
      },
      { onDeadline: () => lastGood(peekLeetCodeStats(), fresh) },
    ),
);

const typingTile = (profile: MonkeytypeProfile): TileResult<TypingTileData> => {
  const stats = toTypingStats(profile);
  return hasBest60(stats) ? fresh(stats) : EMPTY;
};

/**
 * The fastest 60 s Monkeytype test; empty without one. A stale profile carries `asOf` (when it
 * was loaded). Past the deadline, the profile last cached, stale.
 */
export const loadTyping = cache(
  (): Promise<TileResult<TypingTileData>> =>
    settle(
      'typing',
      async () => {
        const result = await readMonkeytypeProfile();
        reportStale(result, 'monkeytype:profile', 'typing');
        const tile = typingTile(result.data);
        return result.stale ? asStale(tile, result.loadedAt) : tile;
      },
      { onDeadline: () => lastGood(peekMonkeytypeProfile(), typingTile) },
    ),
);

/**
 * A live island's failed snapshot. A missed deadline is not reported: the source may just be
 * slow, and the island fetches for itself. Anything else is a warning, since the island still
 * recovers on its next poll.
 */
function liveFailure(name: string, error: unknown): LiveInitial<never> {
  if (error instanceof DeadlineError) return { kind: 'timeout' };
  reportApiFailure(ensureBaseError(error, `home:${name}`), {
    context: `home ${name} tile`,
    level: 'warning',
  });
  return { kind: 'error' };
}

/** Spotify's answer and when it came (epoch ms), so the island knows how old the snapshot is. */
interface NowPlayingSnapshot {
  readonly response: NowPlayingResponse;
  readonly fetchedAt: number;
}

/**
 * Only this module reads it (the /api/v1/now-playing route asks Spotify itself), so plain module
 * state is enough. The clock is read on every call, so a test's faked Date moves it too.
 */
const nowPlayingCache = createStaleCache<NowPlayingSnapshot>({
  ttlMs: NOW_PLAYING_TTL_MS,
  now: () => Date.now(),
});

const fetchNowPlaying = async (): Promise<NowPlayingSnapshot> => ({
  response: await getNowPlaying(),
  fetchedAt: Date.now(),
});

/**
 * The now-playing snapshot. A stale answer is an error (an old track must never show as
 * playing), past {@link LIVE_TILE_DEADLINE_MS} a timeout. Never throws.
 */
export const loadNowPlaying = cache(async (): Promise<LiveInitial<NowPlayingResponse>> => {
  try {
    const result = await withDeadline(
      nowPlayingCache.get(NOW_PLAYING_KEY, fetchNowPlaying),
      LIVE_TILE_DEADLINE_MS,
      'home:now-playing',
    );
    if (result.stale) return liveFailure('now-playing', result.error);
    return { kind: 'data', data: result.data.response, fetchedAt: result.data.fetchedAt };
  } catch (error) {
    return liveFailure('now-playing', error);
  }
});

/** When the status was checked, from its `lastUpdated`; now when that is not a date. */
const checkedAt = (status: ServiceStatus): number => {
  const parsed = Date.parse(status.lastUpdated);
  return Number.isFinite(parsed) ? parsed : Date.now();
};

const statusSnapshot = (status: ServiceStatus): LiveInitial<ServiceStatus> => ({
  kind: 'data',
  data: status,
  fetchedAt: checkedAt(status),
});

const STATUS_DEADLINE_LABEL = 'home:status';

/**
 * The service-status snapshot, from the handler /api/status runs (one shared cache and check).
 * A failure is an error. Past {@link LIVE_TILE_DEADLINE_MS} (one check may take longer), Better
 * Stack's last answer, flagged stale by the handler once older than its minute's cache; a timeout
 * when it never answered. Never throws.
 */
export const loadServiceStatus = cache(async (): Promise<LiveInitial<ServiceStatus>> => {
  try {
    const status = await withDeadline(
      handleStatusCheck(),
      LIVE_TILE_DEADLINE_MS,
      STATUS_DEADLINE_LABEL,
    );
    return statusSnapshot(status);
  } catch (error) {
    const missedDeadline = error instanceof DeadlineError && error.label === STATUS_DEADLINE_LABEL;
    const lastKnown = missedDeadline ? peekServiceStatus() : undefined;
    return lastKnown ? statusSnapshot(lastKnown) : liveFailure('status', error);
  }
});

/** Forgets the now-playing snapshot. Tests only. */
export function resetNowPlayingCache(): void {
  nowPlayingCache.clear();
}
