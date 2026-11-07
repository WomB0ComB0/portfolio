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
 * A compact tile of one row, the same height in every state: 56px album art, then the track over
 * its artist. While a track plays, a small equaliser before the artist is the only live cue (no
 * 'Live' badge) and the page's only moving element; it stands still under reduced motion. Without
 * a track, a large still glyph of the same bars takes the art's place. The content names the
 * tile, so its h2 is for screen readers only: 'Playing now on Spotify', or 'Spotify'.
 *
 * Retries are the QueryClient's (shouldRetryQuery): the query sets none of its own. Polls do not
 * announce themselves (no aria-live): a song change is not worth interrupting a screen reader.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { type ReactElement, useEffect } from 'react';

import type { NowPlayingResponse } from '@/app/api/v1/[[...route]]/now-playing/handlers';
import { Tile } from '@/components/console/tile';
import { TileLink } from '@/components/console/tile-link';
import { cn } from '@/lib/utils';
import type { LiveInitial } from '../data/tile-result';
import styles from './equaliser.module.css';
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
/** The art's drawn size (size-14); next/image picks the file for it. */
const ART_SIZE_PX = 56;
const SPOTIFY_PATH = '/spotify';

/** The tile's hidden h2 while something plays, and otherwise. */
export const PLAYING_TITLE = 'Playing now on Spotify';
export const SPOTIFY_TITLE = 'Spotify';

/** One row: the art, then the text, centred on each other. */
const ROW_CLASS = 'flex min-w-0 items-center gap-3';
/** 56px with an 8px radius. Shared by the art, its glyph and the skeleton. */
const ART_BOX_CLASS = 'size-14 shrink-0 rounded-lg bg-surface-3';
const TEXT_CLASS = 'flex min-w-0 flex-1 flex-col gap-0.5';
/** The primary line: one line, cut short with an ellipsis. */
const TITLE_CLASS = 'min-w-0 truncate tile-title';
const SUB_CLASS = 'flex min-w-0 items-center gap-2 tile-sub text-muted-foreground';
/** Links read as text in the tile and take the brand tint while the tile is hovered. */
const LINK_CLASS = 'text-foreground group-hover/tile:text-brand-ink';
/**
 * The track link is a row of the truncated title and TileLink's new-tab arrow, so the ellipsis
 * cuts the title short and never the arrow after it.
 */
const TRACK_LINK_CLASS = `flex min-w-0 items-baseline ${LINK_CLASS}`;
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

/** The bars in order: each one's rest pose and speed (equaliser.module.css). */
const BAR_POSES = ['low', 'high', 'mid'] as const;

interface EqualiserProps {
  /** 'inline' before the artist (12px), or 'glyph' in the art's place (20px). */
  size: 'inline' | 'glyph';
  /** Moving, in the live colour; otherwise still and faint. */
  live: boolean;
}

/** Three bars: the live cue while a track plays, a still glyph otherwise. Decorative. */
function Equaliser({ size, live }: EqualiserProps): ReactElement {
  const isGlyph = size === 'glyph';
  return (
    <span
      aria-hidden="true"
      data-equaliser={live ? 'live' : 'still'}
      className={cn(styles.bars, isGlyph && styles.glyph)}
    >
      {BAR_POSES.map((pose) => (
        <span
          key={pose}
          className={cn(
            styles.bar,
            isGlyph && styles.thick,
            live ? styles.live : styles.still,
            styles[pose],
          )}
        />
      ))}
    </span>
  );
}

/** The art's box holding the large bars, so every state keeps the same shape. */
function ArtGlyph({ live = false }: { live?: boolean }): ReactElement {
  return (
    <span aria-hidden="true" className={cn(ART_BOX_CLASS, 'grid place-items-center')}>
      <Equaliser size="glyph" live={live} />
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
      <h2 className="sr-only">{PLAYING_TITLE}</h2>
      <div className={ROW_CLASS}>
        <TrackArt imageURL={view.imageURL} />
        <div className={TEXT_CLASS}>
          <p className="min-w-0 tile-title">
            <TileLink
              href={view.href ?? ''}
              external
              srSuffix={view.spokenSuffix}
              className={TRACK_LINK_CLASS}
            >
              <span className="min-w-0 truncate">{view.title}</span>
            </TileLink>
          </p>
          <p className={SUB_CLASS}>
            <Equaliser size="inline" live />
            <span className="min-w-0 truncate">{view.subtitle}</span>
          </p>
        </div>
      </div>
    </>
  );
}

/** Playing, but not a track (an episode or an ad): the glyph's bars move, nothing is linked. */
function PlayingUnknown(): ReactElement {
  return (
    <>
      <h2 className="sr-only">{PLAYING_TITLE}</h2>
      <div className={ROW_CLASS}>
        <ArtGlyph live />
        <p className={cn('flex-1', TITLE_CLASS, 'text-foreground')}>Listening on Spotify</p>
      </div>
    </>
  );
}

function Idle(): ReactElement {
  return (
    <>
      <h2 className="sr-only">{SPOTIFY_TITLE}</h2>
      <div className={ROW_CLASS}>
        <ArtGlyph />
        <div className={TEXT_CLASS}>
          <p className={cn(TITLE_CLASS, 'text-foreground')}>Not playing</p>
          <p className="tile-sub text-muted-foreground">
            <TileLink
              href={SPOTIFY_PATH}
              srSuffix="and artists I listen to most"
              className="text-inherit group-hover/tile:text-brand-ink"
            >
              Top tracks
            </TileLink>
          </p>
        </div>
      </div>
    </>
  );
}

/**
 * Spotify did not answer. Faint, not red: red means a site outage (see the status tile). The tile
 * is plain; 'Top tracks' is an ordinary link out.
 */
function Unreachable(): ReactElement {
  return (
    <>
      <h2 className="sr-only">{SPOTIFY_TITLE}</h2>
      <div className={ROW_CLASS}>
        <ArtGlyph />
        <div className={TEXT_CLASS}>
          <p className={cn(TITLE_CLASS, 'text-faint')}>Spotify unreachable</p>
          <p className="tile-sub text-muted-foreground">
            <Link
              href={SPOTIFY_PATH}
              prefetch={false}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Top tracks
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

/**
 * The tile before any answer, the same row as every state: the art's box and a bar in each text
 * line (each box one line of its type), so the answer does not move anything.
 */
export function NowPlayingTileSkeleton(): ReactElement {
  return (
    <Tile variant="plain" aria-busy="true" data-state="loading">
      <h2 className="sr-only">{SPOTIFY_TITLE}</h2>
      <div className={ROW_CLASS}>
        <span aria-hidden="true" className={cn(ART_BOX_CLASS, 'motion-safe:animate-pulse')} />
        <div aria-hidden="true" className={TEXT_CLASS}>
          <span className="flex h-[1lh] items-center tile-title">
            <span className={cn(BAR_CLASS, 'h-4 w-3/4')} />
          </span>
          <span className="flex h-[1lh] items-center tile-sub">
            <span className={cn(BAR_CLASS, 'h-3.5 w-1/2')} />
          </span>
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
    <Tile variant={nowPlayingHasLink(view) ? 'linked' : 'plain'} data-state={view.kind}>
      <NowPlayingBody view={view} />
    </Tile>
  );
}
