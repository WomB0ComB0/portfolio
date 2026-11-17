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
 * @file The /spotify page's server loaders: the page awaits all three at the top (in parallel),
 * so the chart and the hero's first state are in the server HTML, with no loading.tsx and no
 * hidden streamed segment.
 *
 * - The top lists come straight from the Spotify integration (topTracks, topArtists), not from
 *   the v1 handlers, whose shapes drop the album and the length. Same endpoints, no new request:
 *   nothing on the page calls the handlers any more.
 * - Each list is shaped once and kept in a per-instance stale cache for {@link CHART_TTL_MS}
 *   (Spotify's four-week chart moves slowly). A list slower than {@link CHART_DEADLINE_MS}, or
 *   failing, shows its last good value when there is one; otherwise its section's error. Every
 *   failure is reported once (a missed deadline or a stale answer as a warning). The late load
 *   is not cancelled, so it still fills the cache for the next visit.
 * - Now playing is the home tile's own loader (same cache, same 2.5 s deadline), so the two pages
 *   share one Spotify request. On top, this module remembers the last track it saw playing.
 * - Nothing here throws, so no Spotify trouble reaches the route's error page.
 */

import 'server-only';

import { cache } from 'react';

import { loadNowPlaying } from '@/app/_components/home/data/loaders';
import type { LiveInitial } from '@/app/_components/home/data/tile-result';
import type { NowPlayingResponse } from '@/app/api/v1/[[...route]]/now-playing/handlers';
import { topArtists, topTracks } from '@/lib/api-integrations/spotify';
import { DeadlineError, withDeadline } from '@/lib/async/deadline';
import { createStaleCache, type StaleCache } from '@/lib/cache/stale-cache';
import { reportApiFailure } from '@/lib/observability/report';
import {
  type ChartArtist,
  type ChartListResult,
  type ChartTrack,
  shapeTopArtists,
  shapeTopTracks,
} from './chart';
import { firstHeroView, freshRecent, nextRecent, type RecentTrack } from './hero-state';

/** How long a shaped list is served before Spotify is asked again. */
export const CHART_TTL_MS = 6 * 60 * 60_000;
/** How long the page waits for a list before it shows the last good one, or the error. */
export const CHART_DEADLINE_MS = 4_000;
/** Spotify's short_term range (about four weeks), the only one the integration asks for. */
const CHART_KEY = 'short_term';

type ListName = 'top tracks' | 'top artists';

// The clock is read on every call, so a test's faked Date moves it too.
const trackCache = createStaleCache<readonly ChartTrack[]>({
  ttlMs: CHART_TTL_MS,
  now: () => Date.now(),
});
const artistCache = createStaleCache<readonly ChartArtist[]>({
  ttlMs: CHART_TTL_MS,
  now: () => Date.now(),
});

/** The last track this instance saw playing; read through freshRecent, so it ages out. */
let recentMemory: RecentTrack | undefined;

interface ListSource<T> {
  readonly name: ListName;
  readonly store: StaleCache<readonly T[]>;
  readonly load: () => Promise<readonly T[]>;
}

/**
 * One list under the deadline, never rejecting:
 * - fresh: the list;
 * - stale (the reload failed, an earlier list is cached): that list, reported as a warning;
 * - failed or past the deadline: reported (a missed deadline as a warning), then the last good
 *   list if one was ever loaded, else the section's error.
 */
async function settleList<T>({ name, store, load }: ListSource<T>): Promise<ChartListResult<T>> {
  const context = `render /spotify ${name}`;
  try {
    const result = await withDeadline(
      store.get(CHART_KEY, load),
      CHART_DEADLINE_MS,
      `spotify ${name}`,
    );
    if (result.stale) reportApiFailure(result.error, { context, level: 'warning' });
    return { status: 'ok', data: result.data };
  } catch (error) {
    reportApiFailure(error, {
      context,
      level: error instanceof DeadlineError ? 'warning' : 'error',
    });
    const lastGood = store.peek(CHART_KEY);
    return lastGood ? { status: 'ok', data: lastGood.data } : { status: 'error' };
  }
}

/** The top tracks of the last four weeks, ranked. Per request (React cache), never rejects. */
const loadTopTracksChart = cache(
  (): Promise<ChartListResult<ChartTrack>> =>
    settleList({
      name: 'top tracks',
      store: trackCache,
      load: async () => shapeTopTracks(await topTracks()),
    }),
);

/** The top artists of the last four weeks, ranked. Per request (React cache), never rejects. */
const loadTopArtistsChart = cache(
  (): Promise<ChartListResult<ChartArtist>> =>
    settleList({
      name: 'top artists',
      store: artistCache,
      load: async () => shapeTopArtists(await topArtists()),
    }),
);

/** The hero's server snapshot, and the track last seen playing when it is still recent. */
export interface HeroSnapshot {
  readonly initial: LiveInitial<NowPlayingResponse>;
  readonly recent?: RecentTrack;
}

/**
 * The home tile's now-playing snapshot, plus the track this instance last saw playing. The
 * memory is stamped with the snapshot's own time, and aged against it too (or against now when
 * Spotify did not answer), so a remembered track is never newer than the answer it came from.
 */
const loadSpotifyHero = cache(async (): Promise<HeroSnapshot> => {
  const initial = await loadNowPlaying();
  const seenAt = initial.kind === 'data' ? initial.fetchedAt : Date.now();
  recentMemory = nextRecent(recentMemory, firstHeroView(initial), seenAt);
  return { initial, recent: freshRecent(recentMemory, seenAt) };
});

/** Everything /spotify shows, loaded in parallel. Never rejects. */
export interface SpotifyPageData {
  readonly tracks: ChartListResult<ChartTrack>;
  readonly artists: ChartListResult<ChartArtist>;
  readonly hero: HeroSnapshot;
}

/** The page's data: both lists and the hero, awaited together at the top of the page. */
export async function loadSpotifyPage(): Promise<SpotifyPageData> {
  const [tracks, artists, hero] = await Promise.all([
    loadTopTracksChart(),
    loadTopArtistsChart(),
    loadSpotifyHero(),
  ]);
  return { tracks, artists, hero };
}

/** Forgets both lists and the remembered track. Tests only. */
export function resetSpotifyLoaders(): void {
  trackCache.clear();
  artistCache.clear();
  recentMemory = undefined;
}
