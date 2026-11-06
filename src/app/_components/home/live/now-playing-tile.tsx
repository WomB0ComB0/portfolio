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

'use client';

/**
 * @file The home page's now-playing tile: the server's Spotify snapshot first, then a poll of
 * /api/v1/now-playing every 30 s while the tab is visible. Plain fetch through TanStack Query,
 * no Effect, so the island stays small.
 *
 * Retries are the QueryClient's (shouldRetryQuery): the query sets none of its own. Polls do not
 * announce themselves (no aria-live): a song change is not worth interrupting a screen reader.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AudioLines } from 'lucide-react';
import Image from 'next/image';
import { type ReactElement, type ReactNode, useEffect } from 'react';

import type { NowPlayingResponse } from '@/app/api/v1/[[...route]]/now-playing/handlers';
import { StatusDot } from '@/components/console/status-dot';
import { Tile } from '@/components/console/tile';
import { TileLink } from '@/components/console/tile-link';
import { cn } from '@/lib/utils';
import type { LiveInitial } from '../data/tile-result';
import { fetchJson, parseNowPlaying } from './live-fetch';
import {
  type NowPlayingView,
  nowPlayingHasLink,
  nowPlayingView,
  type PlayingTrackView,
} from './now-playing-view';

/** Its own key: /spotify and the Discord card poll the same endpoint into other shapes. */
export const NOW_PLAYING_QUERY_KEY = ['home', 'now-playing'] as const;
const NOW_PLAYING_URL = '/api/v1/now-playing';
/** How often the tile asks Spotify again while the tab is visible. */
export const NOW_PLAYING_POLL_MS = 30_000;
/** A snapshot younger than this is not fetched again on mount or on focus. */
const NOW_PLAYING_STALE_MS = 25_000;
/** The art's largest drawn size (size-24); next/image picks the file for it. */
const ART_SIZE_PX = 96;
const MS_PER_SECOND = 1_000;
/** The error state's promise, worded from the poll interval so the two never disagree. */
const RETRY_NOTE = `retrying every ${NOW_PLAYING_POLL_MS / MS_PER_SECOND} s`;

const LABEL = 'Now playing';
const LABEL_CLASS = 'label-mono text-muted-foreground';
const HEADER_CLASS = 'flex flex-wrap items-center justify-between gap-x-3 gap-y-1';
const STATE_CLASS = 'label-mono inline-flex shrink-0 items-center gap-1.5';
/** The track sits at the bottom of the tile, however tall its grid row makes it. */
const BODY_CLASS = 'mt-auto flex items-center gap-3 @xs:gap-4';
/** 64px in a tile under 20rem, 96px from there. Shared by the art, its glyph and the skeleton. */
const ART_BOX_CLASS = 'size-16 shrink-0 rounded-md @xs:size-24';
const TEXT_CLASS = 'min-w-0 flex-1';
const TITLE_CLASS = 'line-clamp-2 text-title font-semibold';
const MESSAGE_CLASS = 'line-clamp-2 text-body font-semibold';
const SUBTITLE_CLASS = 'line-clamp-1 text-body-sm text-muted-foreground';
/** Links read as text in the tile and take the brand tint while the tile is hovered. */
const LINK_CLASS = 'text-foreground group-hover/tile:text-brand-ink';
const BAR_CLASS = 'block rounded-sm bg-surface-3 motion-safe:animate-pulse';

export interface NowPlayingTileProps {
  /** The server's snapshot. Only `data` seeds the query; otherwise the island fetches itself. */
  initial: LiveInitial<NowPlayingResponse>;
}

type NowPlayingSnapshot = Extract<LiveInitial<NowPlayingResponse>, { kind: 'data' }>;

/**
 * Puts a server snapshot newer than the cached answer into the cache. The QueryClient outlives
 * client navigations, so on a return to '/' it can hold an older answer, and initialData only
 * fills an empty cache. This runs in an effect, as TanStack's HydrationBoundary does for a query
 * already cached: on a first load the cache holds this very snapshot, so nothing changes and the
 * hydrating render still matches the server HTML. Called before useQuery, so the newer answer is
 * cached by the time the query decides whether to fetch on mount.
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

function useNowPlaying(initial: LiveInitial<NowPlayingResponse>) {
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

function TileHeader({ children }: { children?: ReactNode }): ReactElement {
  return (
    <div className={HEADER_CLASS}>
      <h2 className={LABEL_CLASS}>{LABEL}</h2>
      {children}
    </div>
  );
}

/** The live word beside the label. The dot only decorates it. */
function LiveState(): ReactElement {
  return (
    <span className={cn(STATE_CLASS, 'text-live')}>
      <StatusDot tone="live" pulse />
      Live
    </span>
  );
}

/** A glyph where the art goes, so every state keeps the same shape. */
function ArtGlyph(): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(ART_BOX_CLASS, 'grid place-items-center bg-surface-3 text-muted-foreground')}
    >
      <AudioLines className="size-6 @xs:size-8" />
    </span>
  );
}

/** The album art is decorative: the track's name sits right beside it. */
function TrackArt({ imageURL }: { imageURL?: string }): ReactElement {
  if (!imageURL) return <ArtGlyph />;
  return (
    <Image
      src={imageURL}
      alt=""
      width={ART_SIZE_PX}
      height={ART_SIZE_PX}
      sizes={`${ART_SIZE_PX}px`}
      className={cn(ART_BOX_CLASS, 'object-cover')}
    />
  );
}

function PlayingTrack({ view }: { view: PlayingTrackView }): ReactElement {
  return (
    <>
      <TileHeader>
        <LiveState />
      </TileHeader>
      <div className={BODY_CLASS}>
        <TrackArt imageURL={view.imageURL} />
        <div className={TEXT_CLASS}>
          <p className={TITLE_CLASS}>
            <TileLink
              href={view.href ?? ''}
              external
              srSuffix={view.spokenSuffix}
              className={LINK_CLASS}
            >
              {view.title}
            </TileLink>
          </p>
          <p className={SUBTITLE_CLASS}>{view.subtitle}</p>
        </div>
      </div>
    </>
  );
}

function PlayingUnknown(): ReactElement {
  return (
    <>
      <TileHeader>
        <LiveState />
      </TileHeader>
      <div className={BODY_CLASS}>
        <ArtGlyph />
        <p className={cn(TEXT_CLASS, TITLE_CLASS)}>Listening on Spotify</p>
      </div>
    </>
  );
}

function Idle(): ReactElement {
  return (
    <>
      <TileHeader>
        <span className={cn(STATE_CLASS, 'text-muted-foreground')}>
          <StatusDot tone="idle" />
          Spotify · idle
        </span>
      </TileHeader>
      <div className={BODY_CLASS}>
        <ArtGlyph />
        <div className={TEXT_CLASS}>
          <p className={MESSAGE_CLASS}>Not playing right now</p>
          <p className="text-body-sm">
            <TileLink
              href="/spotify"
              srSuffix="and artists I listen to most"
              className={LINK_CLASS}
            >
              Top tracks
            </TileLink>
          </p>
        </div>
      </div>
    </>
  );
}

/** Spotify did not answer. Muted, not red: red means a site outage (see the status tile). */
function Unreachable(): ReactElement {
  return (
    <>
      <TileHeader>
        <span className={cn(STATE_CLASS, 'text-muted-foreground')}>{RETRY_NOTE}</span>
      </TileHeader>
      <div className={BODY_CLASS}>
        <ArtGlyph />
        <p className={cn(TEXT_CLASS, MESSAGE_CLASS)}>Spotify is unreachable</p>
      </div>
    </>
  );
}

/**
 * The tile before any answer: the real label, the art box and two bars where the title and the
 * artist go, at their line heights, so the answer does not move anything.
 */
export function NowPlayingTileSkeleton(): ReactElement {
  return (
    <Tile variant="plain" className="h-full gap-3" aria-busy="true">
      <TileHeader />
      <div className={BODY_CLASS}>
        <span aria-hidden="true" className={cn(BAR_CLASS, ART_BOX_CLASS)} />
        <div aria-hidden="true" className={TEXT_CLASS}>
          <span className={cn(BAR_CLASS, 'my-1 h-5 w-3/4')} />
          <span className={cn(BAR_CLASS, 'my-1 h-3.5 w-1/2')} />
        </div>
      </div>
      <span className="sr-only">Loading now playing</span>
    </Tile>
  );
}

function NowPlayingBody({
  view,
}: {
  view: Exclude<NowPlayingView, { kind: 'loading' }>;
}): ReactElement {
  switch (view.kind) {
    case 'playing':
      return <PlayingTrack view={view} />;
    case 'playing-unknown':
      return <PlayingUnknown />;
    case 'idle':
      return <Idle />;
    case 'error':
      return <Unreachable />;
  }
}

/**
 * What I am listening to. Linked (lifts, one stretched link) when there is somewhere to go: the
 * track on Spotify, or /spotify while idle. Otherwise a plain tile, so it never looks clickable
 * without going anywhere.
 *
 * @example
 * <NowPlayingTile initial={await loadNowPlaying()} />
 */
export function NowPlayingTile({ initial }: NowPlayingTileProps): ReactElement {
  const { data, isError } = useNowPlaying(initial);
  const view = nowPlayingView({ data, isError, initialKind: initial.kind });
  if (view.kind === 'loading') return <NowPlayingTileSkeleton />;

  return (
    <Tile variant={nowPlayingHasLink(view) ? 'linked' : 'plain'} className="h-full gap-3">
      <NowPlayingBody view={view} />
    </Tile>
  );
}
