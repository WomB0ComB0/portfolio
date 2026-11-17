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
 * @file The /spotify chart: the top tracks as one ranked IndexTable group in style 2 (the open
 * index, as /projects), rendered on the server. Server-safe (no directive, no hooks).
 *
 * A wide row: the rank; the 40px album art beside the title (the row's one link, stretched over
 * the row, to the track on Spotify in a new tab, with the arrow that says so) over its artists;
 * the album from a 48rem page; the length from 40rem. On a phone the row is the rank and one
 * cell: art, title and a meta line "Artist · 3:05". The kit's tint hover; nothing moves, nothing
 * is coloured. A local file (no Spotify page) keeps its row, unlinked.
 *
 * With text enlarged, a page under ten lines of its own text wide (never at the browser's own
 * size, where a 320px phone is 12 lines wide) gives the cover's width to the words: the title
 * wraps whole with its new-tab arrow after the last word, the artist and the length each take
 * their own line, so none is cut to a letter, and the rank sits on the title's first line.
 */

import type { ReactElement } from 'react';
import { EmptyState } from '@/components/console/empty-state';
import {
  INDEX_SUB_CLASS,
  INDEX_TITLE_TEXT_CLASS,
  type IndexColumn,
  IndexGroup,
  IndexRow,
  IndexTitleLink,
  indexCellClass,
} from '@/components/console/index-table';
import { NewTabArrow } from '@/components/console/tile-link';
import { RetryButton } from '@/components/data/retry-button';
import { SectionError } from '@/components/data/section-error';
import Image from '@/components/ui/cdn-image';
import { cn } from '@/lib/utils';
import { type ChartListResult, type ChartTrack, TRACK_ART_PX } from '../_lib/chart';
import { ArtGlyph } from './equaliser';

const HEADING_ID = 'spotify-top-tracks';

/**
 * A section head's bar grows to fit on a page under ten lines of its text wide: with text
 * enlarged, "Top tracks" and "last four weeks" no longer fit the fixed 40px bar, so the qualifier
 * wraps under the heading. At the browser's own size the bar keeps its fixed 40px (the kit's
 * phone-wide grow class would add the bar's 1px border to it). The artist strip's head uses it too.
 */
export const SECTION_HEAD_GROW_CLASS =
  '@max-[10lh]/page:h-auto @max-[10lh]/page:min-h-10 @max-[10lh]/page:flex-wrap @max-[10lh]/page:gap-y-0.5 @max-[10lh]/page:pt-2.5';

/**
 * The rank column: 36px (48px from a 40rem page) at the browser's own size, and wider once the
 * text is: its width also follows the column's own line height (24px here), which a phone's text
 * size setting (text-size-adjust) grows with the text while it leaves rem lengths alone, so "20"
 * is never cut to "2…". With the root font enlarged the rem width grows by itself.
 */
const RANK_WIDTH = 'leading-6 w-[max(2.25rem,1.375lh)] @min-[40rem]/page:w-[max(3rem,1.75lh)]';

/** Rank, Track (art, title over artists), Album, Length. */
export const TRACK_COLUMNS = [
  { id: 'rank', label: '#', align: 'end', width: RANK_WIDTH, sort: 'number' },
  { id: 'track', label: 'Track' },
  { id: 'album', label: 'Album', priority: 2, width: 'w-[30%]' },
  { id: 'length', label: 'Length', align: 'end', priority: 1, width: 'w-20', sort: 'number' },
] as const satisfies readonly IndexColumn[];
const [RANK, TRACK, ALBUM, LENGTH] = TRACK_COLUMNS;

const RANK_CLASS = 'font-medium tabular-nums text-faint';
/**
 * The art and its glyph: 40px, a step under the year bar's radius. Dropped on a page under ten
 * lines of its text wide, so the words get its width.
 */
const ART_CLASS = 'size-10 shrink-0 rounded-md @max-[10lh]/page:hidden';
const TRACK_CELL_CLASS = 'flex min-w-0 items-center gap-3';
const TEXT_CLASS = 'flex min-w-0 flex-1 flex-col';
/**
 * A title on a page under ten lines wide: it wraps, whole (no clamp: with the text enlarged a title
 * cut to two lines lost its end and its new-tab arrow), and a word breaks inside only when it is
 * wider than the whole line.
 */
const TITLE_WRAP_CLASS =
  '@max-[10lh]/page:whitespace-normal @max-[10lh]/page:[overflow-wrap:anywhere]';
/**
 * The title link: one line, the title truncating and never the arrow after it. On a page under
 * ten lines wide the link is a block whose words run inline, so the arrow follows the last word
 * instead of taking a column of its own beside every line; nothing clips it there.
 */
const TITLE_LINK_CLASS = cn(
  'inline-flex max-w-full items-baseline align-bottom @max-[10lh]/page:block @max-[10lh]/page:overflow-visible',
  TITLE_WRAP_CLASS,
);
/** The linked title's words: cut on one line; inline in the link's lines (see above). */
const LINKED_TITLE_CLASS = cn('min-w-0 truncate @max-[10lh]/page:inline', TITLE_WRAP_CLASS);
/** A title without a link (a local file): one line, or whole on a page under ten lines wide. */
const TITLE_TEXT_CLASS = cn('min-w-0 truncate', TITLE_WRAP_CLASS);
/**
 * The arrow: faint at rest, brand-ink with its row, as the title is. On a page under ten lines
 * wide it takes no room on the line (its 1rem, the icon and its gap, is given back by the margin),
 * so it is never what pushes the last word, or itself, onto a new line: glued to the last word by
 * the word joiner, it sits right after it and hangs into the cell's end padding when that word
 * fills the line.
 */
const ARROW_CLASS =
  'text-faint transition-colors duration-(--motion-base) ease-effect group-hover/row:text-brand-ink group-hover/row:duration-(--motion-instant) @max-[10lh]/page:-me-4';
/**
 * The rank and track cells on a page under ten lines wide: the rank sits on the title's first
 * line (both cells on one baseline) rather than in the middle of a row of three or more lines,
 * and the track cell lets a hanging arrow show (see ARROW_CLASS).
 */
const RANK_CELL_CLASS = cn(indexCellClass(RANK), '@max-[10lh]/page:align-baseline');
const TRACK_TD_CLASS = cn(
  indexCellClass(TRACK),
  '@max-[10lh]/page:align-baseline @max-[10lh]/page:overflow-visible',
);

/**
 * The phone's meta line, "Artist · 3:05": the kit's INDEX_META_CLASS as a row, so the artists
 * truncate and the length (whose column is hidden on a phone) always shows. On a page under ten
 * lines wide the artists and the length take a line each, the dot between them dropped.
 */
const PHONE_META_CLASS =
  'mt-0.5 flex min-w-0 gap-1 tile-meta text-muted-foreground @min-[40rem]/page:hidden @max-[10lh]/page:flex-col @max-[10lh]/page:gap-0';
/** The artists: cut on one line; on a page under ten lines wide, up to two lines. */
const PHONE_ARTIST_CLASS =
  'min-w-0 truncate @max-[10lh]/page:line-clamp-2 @max-[10lh]/page:whitespace-normal @max-[10lh]/page:[overflow-wrap:anywhere]';

/** The album art, or the still glyph when Spotify sent none. Decorative: the title is beside it. */
function TrackArt({ art }: { readonly art?: string }): ReactElement {
  if (!art) return <ArtGlyph className={ART_CLASS} />;
  return (
    <Image
      src={art}
      alt=""
      width={TRACK_ART_PX}
      height={TRACK_ART_PX}
      sizes={`${TRACK_ART_PX}px`}
      className={cn(ART_CLASS, 'bg-surface-3 object-cover')}
    />
  );
}

/** The title: the row's link out to Spotify, or plain text for a local file. */
function TrackTitle({ track }: { readonly track: ChartTrack }): ReactElement {
  if (!track.href) {
    return <span className={cn(INDEX_TITLE_TEXT_CLASS, TITLE_TEXT_CLASS)}>{track.title}</span>;
  }
  return (
    <IndexTitleLink href={track.href} external data-track-title="" className={TITLE_LINK_CLASS}>
      <span className={LINKED_TITLE_CLASS}>{track.title}</span>
      <span className={ARROW_CLASS}>
        <NewTabArrow />
      </span>
    </IndexTitleLink>
  );
}

/** The length as m:ss in a <time>, or a dash that readers hear as "unknown length". */
function Length({ track }: { readonly track: ChartTrack }): ReactElement {
  if (!track.duration) {
    return (
      <>
        <span aria-hidden="true">—</span>
        <span className="sr-only">Unknown length</span>
      </>
    );
  }
  return (
    <time dateTime={track.durationIso} className="tabular-nums">
      {track.duration}
    </time>
  );
}

/** The album, or a dash that readers hear as "unknown album", as the length cell does. */
function Album({ album }: { readonly album?: string }): ReactElement {
  if (album) return <>{album}</>;
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">Unknown album</span>
    </>
  );
}

/** The phone's line under the title: the artists, then the length, which never truncates. */
function PhoneMeta({ track }: { readonly track: ChartTrack }): ReactElement {
  return (
    <span data-phone-meta="" className={PHONE_META_CLASS}>
      {track.artist ? <span className={PHONE_ARTIST_CLASS}>{track.artist}</span> : null}
      {/* The spaces are for the text (copy, readers); a flex row draws none, the gap does. */}
      {track.artist && track.duration ? (
        <>
          {' '}
          <span aria-hidden="true" className="@max-[10lh]/page:hidden">
            ·
          </span>{' '}
        </>
      ) : null}
      {track.duration ? <span className="shrink-0 tabular-nums">{track.duration}</span> : null}
    </span>
  );
}

/** One ranked track. */
function TrackRow({ track }: { readonly track: ChartTrack }): ReactElement {
  return (
    <IndexRow data-spotify-track="">
      <td className={RANK_CELL_CLASS}>
        <span data-rank="" className={RANK_CLASS}>
          {track.rank}
        </span>
      </td>
      <td className={TRACK_TD_CLASS}>
        <span className={TRACK_CELL_CLASS}>
          <TrackArt art={track.art} />
          <span className={TEXT_CLASS}>
            <span className="flex min-w-0 items-center">
              <TrackTitle track={track} />
            </span>
            <span className={INDEX_SUB_CLASS}>{track.artist}</span>
            <PhoneMeta track={track} />
          </span>
        </span>
      </td>
      <td className={indexCellClass(ALBUM)}>
        <Album album={track.album} />
      </td>
      <td className={indexCellClass(LENGTH)}>
        <Length track={track} />
      </td>
    </IndexRow>
  );
}

export interface TrackTableProps {
  readonly result: ChartListResult<ChartTrack>;
}

/**
 * The top tracks of the last four weeks as a ranked table; its own error (with Try again) or
 * empty state when Spotify failed or sent none, without touching the rest of the page.
 *
 * @example
 * <TrackTable result={await loadTopTracksChart()} />
 */
export function TrackTable({ result }: TrackTableProps): ReactElement {
  if (result.status === 'error') {
    return (
      <SectionError title="Couldn't load top tracks" headingLevel={2} action={<RetryButton />} />
    );
  }
  if (result.data.length === 0) {
    return (
      <EmptyState title="No top tracks yet">
        Spotify has no chart for the last four weeks.
      </EmptyState>
    );
  }
  return (
    <IndexGroup
      id={HEADING_ID}
      year="Top tracks"
      count="last four weeks"
      columns={TRACK_COLUMNS}
      variant="open"
      headerClassName={SECTION_HEAD_GROW_CLASS}
    >
      {result.data.map((track) => (
        <TrackRow key={track.key} track={track} />
      ))}
    </IndexGroup>
  );
}
