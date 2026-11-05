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
 * @file The /spotify top artists grid, rendered on the server. It calls fetchTopArtists, the
 * function behind GET /api/v1/top-artists, directly; nothing in the browser calls that route any
 * more. Each artist is a real link to its Spotify page, so it works with Enter, middle-click and
 * without JavaScript.
 */

import 'server-only';

import Image from 'next/image';
import type { ReactElement } from 'react';
import { SiSpotify } from 'react-icons/si';

import { fetchTopArtists, type TopArtist } from '@/app/api/v1/[[...route]]/top-artists/handlers';
import { RetryButton } from '@/components/data/retry-button';
import { SectionError } from '@/components/data/section-error';
import { Skeleton } from '@/components/ui/skeleton';
import { DeadlineError, withDeadline } from '@/lib/async/deadline';
import { reportApiFailure } from '@/lib/observability/report';
import { cn } from '@/lib/utils';

/** The grid of the list and of its skeleton, so the skeleton takes the list's place exactly. */
const TOP_ARTISTS_GRID_CLASS =
  'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6';

/**
 * How long the section waits for Spotify before it shows its error, so a slow Spotify can't hold
 * the page's stream open. A late answer still fills the handler's cache for the next visit.
 */
export const TOP_ARTISTS_DEADLINE_MS = 8_000;

/** Spotify returns at most this many top artists (TOP_ITEMS_LIMIT in the Spotify integration). */
const SKELETON_ITEM_COUNT = 20;
const PORTRAIT_PX = 96;
const REPORT_CONTEXT = 'render /spotify top artists';
const ERROR_TITLE = "Couldn't load top artists";
const EMPTY_MESSAGE = 'No top artists data available at the moment.';

/** gap rather than space-y: the link's absolutely positioned sr-only text must not add a margin. */
const CARD_CLASS = 'flex h-full flex-col items-center gap-3 rounded-lg p-4 text-center';
const LINK_CLASS =
  'backdrop-blur-sm transition-[background-color,transform] duration-300 hover:bg-primary/60 motion-safe:hover:scale-105 motion-safe:active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const PORTRAIT_CLASS = 'w-24 h-24 rounded-full shadow-lg border-2 border-primary';

type TopArtistsResult =
  | { readonly ok: true; readonly artists: readonly TopArtist[] }
  | { readonly ok: false };

/** The artist's Spotify page when the API sent an https URL, otherwise nothing to link to. */
const spotifyHref = (url: string): string | undefined => {
  try {
    return new URL(url).protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The top artists, or a failure that is already reported. Never throws: a Spotify outage stays
 * inside this section instead of reaching the route's error page.
 */
async function loadTopArtists(): Promise<TopArtistsResult> {
  try {
    const artists = await withDeadline(fetchTopArtists(), TOP_ARTISTS_DEADLINE_MS, 'top artists');
    return { ok: true, artists };
  } catch (error) {
    reportApiFailure(error, {
      context: REPORT_CONTEXT,
      level: error instanceof DeadlineError ? 'warning' : 'error',
    });
    return { ok: false };
  }
}

/** The artist's portrait, or the Spotify mark when the API sent no image. */
const ArtistPortrait = ({ imageUrl }: { imageUrl: string }): ReactElement =>
  imageUrl ? (
    // The artist's name sits right under the portrait, so the image itself is decorative.
    <Image
      src={imageUrl}
      alt=""
      className={cn(PORTRAIT_CLASS, 'object-cover')}
      width={PORTRAIT_PX}
      height={PORTRAIT_PX}
      sizes={`${PORTRAIT_PX}px`}
      placeholder="empty"
    />
  ) : (
    <span
      className={cn(
        PORTRAIT_CLASS,
        'flex items-center justify-center bg-secondary text-muted-foreground',
      )}
    >
      <SiSpotify aria-hidden="true" className="size-8" />
    </span>
  );

/** The 1-based rank on the portrait's corner. */
const RankBadge = ({ rank }: { rank: number }): ReactElement => (
  <span className="absolute -left-1 -top-1 flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold tabular-nums text-primary-foreground shadow-md ring-2 ring-background">
    {rank}
  </span>
);

interface ArtistCardProps {
  artist: TopArtist;
  rank: number;
}

/** Portrait, rank and name. The space between them keeps the link's name "1 Name". */
const ArtistCardContent = ({ artist, rank }: ArtistCardProps): ReactElement => (
  <>
    {/* flex, so the portrait sits on no text baseline and the card keeps its old height. */}
    <span className="relative flex">
      <ArtistPortrait imageUrl={artist.imageUrl} />
      <RankBadge rank={rank} />
    </span>{' '}
    <span className="w-full truncate font-semibold text-foreground">{artist.name}</span>
  </>
);

/** A link to the artist's Spotify page, or a plain card when the API sent no usable URL. */
const ArtistCard = ({ artist, rank }: ArtistCardProps): ReactElement => {
  const href = spotifyHref(artist.url);
  if (!href) {
    return (
      <div className={CARD_CLASS}>
        <ArtistCardContent artist={artist} rank={rank} />
      </div>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn(CARD_CLASS, LINK_CLASS)}>
      <ArtistCardContent artist={artist} rank={rank} />{' '}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
};

/** The ranked grid; an ordered list, so assistive tech hears the position and the count too. */
const TopArtistsGrid = ({ artists }: { artists: readonly TopArtist[] }): ReactElement => (
  <ol className={TOP_ARTISTS_GRID_CLASS}>
    {artists.map((artist, index) => (
      <li key={artist.url || artist.name}>
        <ArtistCard artist={artist} rank={index + 1} />
      </li>
    ))}
  </ol>
);

/**
 * The /spotify top artists of the last 4 weeks. An async server component: it renders the grid
 * in the server HTML, or "Couldn't load top artists" with a Try again that re-renders the route
 * when Spotify fails or takes longer than {@link TOP_ARTISTS_DEADLINE_MS}.
 *
 * @example
 * <Suspense fallback={<TopArtistsSkeleton />}>
 *   <TopArtists />
 * </Suspense>
 */
export async function TopArtists(): Promise<ReactElement> {
  const result = await loadTopArtists();
  if (!result.ok) return <SectionError title={ERROR_TITLE} action={<RetryButton />} />;
  if (result.artists.length === 0) {
    return (
      <p className="text-muted-foreground bg-card/30 p-4 rounded-lg text-center">{EMPTY_MESSAGE}</p>
    );
  }
  return <TopArtistsGrid artists={result.artists} />;
}

const SKELETON_KEYS = Array.from({ length: SKELETON_ITEM_COUNT }, (_, index) => `artist-${index}`);

/** The grid's placeholder, with the real grid classes and card box sizes. */
export function TopArtistsSkeleton(): ReactElement {
  return (
    <output className="block" aria-label="Loading top artists">
      <ul className={TOP_ARTISTS_GRID_CLASS} aria-hidden="true">
        {SKELETON_KEYS.map((key) => (
          <li key={key} className={CARD_CLASS}>
            <Skeleton className="size-24 rounded-full bg-muted" />
            <Skeleton className="h-6 w-3/4 bg-muted" />
          </li>
        ))}
      </ul>
    </output>
  );
}
