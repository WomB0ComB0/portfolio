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
 * @file The /spotify top tracks grid, rendered on the server. It calls fetchTopTracks, the
 * function behind GET /api/v1/top-tracks, directly; nothing in the browser calls that route any
 * more. Each track is a real link to its Spotify page, so it works with Enter, middle-click and
 * without JavaScript.
 */

import 'server-only';

import Image from 'next/image';
import type { ReactElement } from 'react';
import { SiSpotify } from 'react-icons/si';

import { fetchTopTracks, type TopTrack } from '@/app/api/v1/[[...route]]/top-tracks/handlers';
import { RetryButton } from '@/components/data/retry-button';
import { SectionError } from '@/components/data/section-error';
import { Skeleton } from '@/components/ui/skeleton';
import { DeadlineError, withDeadline } from '@/lib/async/deadline';
import { reportApiFailure } from '@/lib/observability/report';
import { cn } from '@/lib/utils';

/** The grid of the list and of its skeleton, so the skeleton takes the list's place exactly. */
const TOP_TRACKS_GRID_CLASS = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';

/**
 * How long the section waits for Spotify before it shows its error, so a slow Spotify can't hold
 * the page's stream open. A late answer still fills the handler's cache for the next visit.
 */
export const TOP_TRACKS_DEADLINE_MS = 8_000;

/** Spotify returns at most this many top tracks (TOP_ITEMS_LIMIT in the Spotify integration). */
const SKELETON_ITEM_COUNT = 20;
const ALBUM_ART_PX = 64;
/** The card's link draws it 3% larger on hover (motion-safe:hover:scale-[1.03] in LINK_CLASS). */
const LINK_HOVER_SCALE = 1.03;
/**
 * The art's width at its hover scale (65.92px, rounded up), so a 1x screen fetches the 96w file
 * instead of drawing the 64w one larger than it is.
 */
const ALBUM_ART_SIZES = `${Math.ceil(ALBUM_ART_PX * LINK_HOVER_SCALE)}px`;
const REPORT_CONTEXT = 'render /spotify top tracks';
const ERROR_TITLE = "Couldn't load top tracks";
const EMPTY_MESSAGE = 'No top tracks data available at the moment.';

/** gap rather than space-x: the link's absolutely positioned sr-only text must not add a margin. */
const CARD_CLASS = 'flex h-full items-center gap-4 bg-secondary rounded-lg p-3';
const LINK_CLASS =
  'transition-[background-color,transform] duration-300 hover:bg-primary/25 motion-safe:hover:scale-[1.03] motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const ALBUM_ART_CLASS = 'w-16 h-16 shrink-0 rounded-md shadow-md';
const RANK_CLASS = 'w-6 shrink-0 text-right font-semibold tabular-nums text-muted-foreground';

type TopTracksResult =
  | { readonly ok: true; readonly tracks: readonly TopTrack[] }
  | { readonly ok: false };

/** The track's Spotify page when the API sent an https URL (local files have none). */
const spotifyHref = (url: string): string | undefined => {
  try {
    return new URL(url).protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The top tracks, or a failure that is already reported. Never throws: a Spotify outage (or the
 * 502 one bad item can cause) stays inside this section instead of reaching the route's error
 * page.
 */
async function loadTopTracks(): Promise<TopTracksResult> {
  try {
    const tracks = await withDeadline(fetchTopTracks(), TOP_TRACKS_DEADLINE_MS, 'top tracks');
    return { ok: true, tracks };
  } catch (error) {
    reportApiFailure(error, {
      context: REPORT_CONTEXT,
      level: error instanceof DeadlineError ? 'warning' : 'error',
    });
    return { ok: false };
  }
}

/** The album art, or the Spotify mark when the API sent no image. */
const AlbumArt = ({ imageUrl }: { imageUrl: string }): ReactElement =>
  imageUrl ? (
    // The track and artist names sit right beside the art, so the image itself is decorative.
    <Image
      src={imageUrl}
      alt=""
      className={ALBUM_ART_CLASS}
      width={ALBUM_ART_PX}
      height={ALBUM_ART_PX}
      sizes={ALBUM_ART_SIZES}
      placeholder="empty"
    />
  ) : (
    <span
      className={cn(
        ALBUM_ART_CLASS,
        'flex items-center justify-center bg-muted text-muted-foreground',
      )}
    >
      <SiSpotify aria-hidden="true" className="size-6" />
    </span>
  );

interface TrackCardProps {
  track: TopTrack;
  rank: number;
}

/** Rank, art, name and artist. The spaces and " by " keep the link's name "1 Song by Artist". */
const TrackCardContent = ({ track, rank }: TrackCardProps): ReactElement => (
  <>
    <span className={RANK_CLASS}>{rank}</span> <AlbumArt imageUrl={track.imageUrl} />{' '}
    <span className="min-w-0 grow overflow-hidden">
      <span className="block truncate font-semibold text-foreground">{track.name}</span>{' '}
      <span className="sr-only">by</span>{' '}
      <span className="block truncate text-sm text-muted-foreground">{track.artist}</span>
    </span>
  </>
);

/** A link to the track's Spotify page, or a plain card when the API sent no usable URL. */
const TrackCard = ({ track, rank }: TrackCardProps): ReactElement => {
  const href = spotifyHref(track.url);
  if (!href) {
    return (
      <div className={CARD_CLASS}>
        <TrackCardContent track={track} rank={rank} />
      </div>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn(CARD_CLASS, LINK_CLASS)}>
      <TrackCardContent track={track} rank={rank} />{' '}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
};

/** The ranked grid; an ordered list, so assistive tech hears the position and the count too. */
const TopTracksGrid = ({ tracks }: { tracks: readonly TopTrack[] }): ReactElement => (
  <ol className={TOP_TRACKS_GRID_CLASS}>
    {tracks.map((track, index) => (
      <li key={track.url || `${track.name}-${track.artist}`}>
        <TrackCard track={track} rank={index + 1} />
      </li>
    ))}
  </ol>
);

/**
 * The /spotify top tracks of the last 4 weeks. An async server component: it renders the grid
 * in the server HTML, or "Couldn't load top tracks" with a Try again that re-renders the route
 * when Spotify fails or takes longer than {@link TOP_TRACKS_DEADLINE_MS}.
 *
 * @example
 * <Suspense fallback={<TopTracksSkeleton />}>
 *   <TopTracks />
 * </Suspense>
 */
export async function TopTracks(): Promise<ReactElement> {
  const result = await loadTopTracks();
  if (!result.ok) return <SectionError title={ERROR_TITLE} action={<RetryButton />} />;
  if (result.tracks.length === 0) {
    return <p className="text-muted-foreground text-center">{EMPTY_MESSAGE}</p>;
  }
  return <TopTracksGrid tracks={result.tracks} />;
}

const SKELETON_KEYS = Array.from({ length: SKELETON_ITEM_COUNT }, (_, index) => `track-${index}`);

/** The grid's placeholder, with the real grid classes and card box sizes. */
export function TopTracksSkeleton(): ReactElement {
  return (
    <output className="block" aria-label="Loading top tracks">
      <ul className={TOP_TRACKS_GRID_CLASS} aria-hidden="true">
        {SKELETON_KEYS.map((key) => (
          <li key={key} className={CARD_CLASS}>
            <Skeleton className="h-5 w-6 shrink-0 bg-muted" />
            <Skeleton className="size-16 shrink-0 rounded-md bg-muted" />
            <div className="grow space-y-2">
              <Skeleton className="h-5 w-3/4 bg-muted" />
              <Skeleton className="h-4 w-1/2 bg-muted" />
            </div>
          </li>
        ))}
      </ul>
    </output>
  );
}
