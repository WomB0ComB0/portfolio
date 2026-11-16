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

'use client';

/**
 * @file The /spotify hero's live island: the server's snapshot first (so the first state is in
 * the HTML), then the home tile's own poll. Same query key, interval and fetcher as the home
 * now-playing tile, so the two pages share one cached answer and one request every 30 s while
 * the tab is visible. Same view rules (nowPlayingView), so they always agree on what plays.
 *
 * It also remembers the last track it saw playing in this tab, so a track that stops reads
 * "Recently played · just now" rather than vanishing. Polls never announce themselves (no
 * aria-live): a song change is not worth interrupting a screen reader.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactElement, useEffect, useState } from 'react';

import type { LiveInitial } from '@/app/_components/home/data/tile-result';
import { fetchJson, parseNowPlaying } from '@/app/_components/home/live/live-fetch';
import {
  NOW_PLAYING_POLL_MS,
  NOW_PLAYING_QUERY_KEY,
} from '@/app/_components/home/live/now-playing-tile';
import { nowPlayingView } from '@/app/_components/home/live/now-playing-view';
import type { NowPlayingResponse } from '@/app/api/v1/[[...route]]/now-playing/handlers';
import { freshRecent, heroState, nextRecent, type RecentTrack } from '../_lib/hero-state';
import type { ArtMode } from './art-backlight';
import { HeroView } from './hero-view';

const NOW_PLAYING_URL = '/api/v1/now-playing';
/** The home tile's freshness window: a snapshot younger than this is not fetched again on mount. */
const NOW_PLAYING_STALE_MS = 25_000;

type NowPlayingSnapshot = Extract<LiveInitial<NowPlayingResponse>, { kind: 'data' }>;

/**
 * Puts a server snapshot newer than the cached answer into the shared cache, as the home tile
 * does: the QueryClient outlives client navigations, and initialData only fills an empty cache.
 * On a first load the cache holds this very snapshot, so nothing changes and hydration matches.
 */
function useNewerSnapshot(seeded: NowPlayingSnapshot | undefined): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!seeded) return;
    const cachedAt = queryClient.getQueryState(NOW_PLAYING_QUERY_KEY)?.dataUpdatedAt ?? 0;
    if (seeded.fetchedAt <= cachedAt) return;
    queryClient.setQueryData(NOW_PLAYING_QUERY_KEY, seeded.data, { updatedAt: seeded.fetchedAt });
  }, [queryClient, seeded]);
}

/** The home tile's query, seeded with this page's server snapshot. */
function useSharedNowPlaying(initial: LiveInitial<NowPlayingResponse>) {
  const seeded = initial.kind === 'data' ? initial : undefined;
  useNewerSnapshot(seeded);
  return useQuery({
    queryKey: NOW_PLAYING_QUERY_KEY,
    queryFn: async ({ signal }) => parseNowPlaying(await fetchJson(NOW_PLAYING_URL, { signal })),
    initialData: seeded?.data,
    initialDataUpdatedAt: seeded?.fetchedAt,
    staleTime: NOW_PLAYING_STALE_MS,
    refetchInterval: NOW_PLAYING_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export interface LiveHeroProps {
  /** The server's snapshot (the home tile's loader). */
  readonly initial: LiveInitial<NowPlayingResponse>;
  /** The track the server last saw playing, when that was recent. */
  readonly recent?: RecentTrack;
  readonly art?: ArtMode;
}

/**
 * What I'm listening to, kept current. The memory follows each answer during render (React's
 * pattern for state derived from props). Each answer also ages the memory against that answer's
 * timestamp, so an unchanged idle poll can expire a track after twelve hours. Using the query's
 * timestamp rather than the wall clock keeps the server and first hydration render identical.
 * Without an answer yet, keep the server memory until a poll can age it.
 *
 * @example
 * <LiveHero initial={hero.initial} recent={hero.recent} art="plain" />
 */
export function LiveHero({ initial, recent: serverRecent, art }: LiveHeroProps): ReactElement {
  const { data, isError, dataUpdatedAt } = useSharedNowPlaying(initial);
  const view = nowPlayingView({ data, isError, initialKind: initial.kind });
  const [recent, setRecent] = useState(serverRecent);
  const remembered = nextRecent(recent, view, dataUpdatedAt);
  const latest = dataUpdatedAt > 0 ? freshRecent(remembered, dataUpdatedAt) : remembered;
  if (latest !== recent) setRecent(latest);
  return <HeroView state={heroState(view, latest)} art={art} />;
}
