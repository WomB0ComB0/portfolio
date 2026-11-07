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

import 'server-only';

/**
 * @file The home place tile, 'Recently at': the place whose visit ended most recently. Past
 * visits only, so it never says where the owner is now: no 'Here now', and no coordinates (/places
 * has the map). selectLatestPlace picks only a visit that is over (placeCutoffDay: from noon ET
 * the day after), and the view applies the same rule again: a place whose visit may still be on,
 * however it got here, shows the empty state. A linked tile whose stretched link is the place's
 * name.
 *
 * One row: the first photo as a 64px thumbnail (at every width; nothing in its place without one),
 * then the label, the name on one line and 'Event · Aug 21'. A run of visits shows its first and
 * last day ('Jul 29 – Sep 15', heard as 'Jul 29 to Sep 15').
 */

import Image from 'next/image';
import type { ReactElement } from 'react';

import { hasDestination, SrOnlyWords, Tile, TileLink } from '@/components/console';
import { urlFor } from '@/lib/sanity/client';
import type { Place } from '@/lib/sanity/loaders';
import { type DaySpanParts, formatAsOfDay, formatDaySpan, type Instant } from '../data/format';
import { loadLatestPlace } from '../data/loaders';
import { lastDayIfOver, placeCutoffDay } from '../data/selectors';
import type { TileResult } from '../data/tile-result';
import {
  joinMeta,
  LoadingNote,
  META_SEPARATOR,
  SkeletonBar,
  SkeletonLine,
  TileEmpty,
  TileLabel,
  TileMeta,
  TileUnavailable,
} from './tile-states';

const LABEL = 'Recently at';
const PLACES_PATH = '/places';

/** Drawn at 64 px; the file is twice that for 2x screens. */
const THUMB_PX = 64;
const THUMB_SOURCE_PX = THUMB_PX * 2;

/** Between a span's first and last day: an en dash, as /places prints a visit's dates. */
const SPAN_DASH = ' – ';

/** At least the thumbnail's 64 px, so a place without a photo is as tall as one with. */
const ROW_CLASS = 'flex min-h-16 min-w-0 items-center gap-3';
const THUMB_CLASS = 'size-16 shrink-0 rounded-lg bg-surface-3 object-cover';
const TEXT_CLASS = 'flex min-w-0 flex-1 flex-col gap-0.5';
/**
 * The name: one line, cut with an ellipsis, so the tile is the same height for every place (32
 * of the 57 names have 26 or more characters, and one that wrapped made the tile 18 px taller
 * than its skeleton and its estimate). The whole name stays the link's name, and the heading's
 * title shows it on hover: the stretched link's overlay belongs to the link, inside the heading.
 */
const NAME_CLASS = 'truncate tile-title text-foreground';

const NO_PLACE: TileResult<never> = { status: 'empty' };

/** The first photo's 128 px square, or null without a photo it can resolve. */
function thumbnailUrl(place: Place): string | null {
  const photo = place.photos?.[0];
  if (!photo?.asset) return null;
  try {
    const url = urlFor(photo).width(THUMB_SOURCE_PX).height(THUMB_SOURCE_PX).fit('crop').url();
    return url || null;
  } catch {
    return null;
  }
}

const placeHref = (place: Place): string => `${PLACES_PATH}/${encodeURIComponent(place._id)}`;

/**
 * A range's end, after its start: ' – Sep 15' on screen, ' to Sep 15' to a screen reader, which
 * does not read an en dash at its default punctuation level. /places' PlaceDateRange says a span
 * the same way.
 */
function SpanEnd({ end }: { end: string }): ReactElement {
  return (
    <>
      <span aria-hidden="true">{SPAN_DASH}</span>
      <SrOnlyWords>to</SrOnlyWords>
      {` ${end}`}
    </>
  );
}

interface PlaceMetaProps {
  category: Place['category'];
  days: DaySpanParts | null;
  asOf: string;
}

/**
 * The context line: the category and the days ('Event · Aug 21'), and, for a stale place, the
 * list's day. A range's end is markup (SpanEnd), so the line is joined around it.
 */
function PlaceMeta({ category, days, asOf }: PlaceMetaProps): ReactElement {
  const head = joinMeta([category, days?.start]);
  return (
    // A date's year shows once the year turns: the words depend on today. Stale, it says which
    // day the list is from (data-stale).
    <TileMeta dated stale={asOf !== ''}>
      {head}
      {days?.end ? <SpanEnd end={days.end} /> : null}
      {head && asOf ? META_SEPARATOR : null}
      {asOf}
    </TileMeta>
  );
}

interface PlaceViewProps {
  place: Place;
  now: Instant;
  /** The place comes from the list last loaded, served past the deadline. */
  stale: boolean;
  /** 'as of Nov 5' for a stale place whose list's load day is known, else ''. */
  asOf: string;
}

function PlaceView({ place, now, stale, asOf }: PlaceViewProps): ReactElement {
  const href = placeHref(place);
  const thumbnail = thumbnailUrl(place);
  return (
    <Tile
      variant={hasDestination(href) ? 'linked' : 'plain'}
      data-state={stale ? 'stale' : 'ready'}
    >
      <div className={ROW_CLASS}>
        {thumbnail && (
          // Decorative: the name beside it says where.
          <Image
            src={thumbnail}
            alt=""
            width={THUMB_PX}
            height={THUMB_PX}
            sizes={`${THUMB_PX}px`}
            loading="lazy"
            className={THUMB_CLASS}
          />
        )}
        <div className={TEXT_CLASS}>
          <TileLabel>{LABEL}</TileLabel>
          <h3 className={NAME_CLASS} title={place.name}>
            <TileLink href={href} className="text-inherit">
              {place.name}
            </TileLink>
          </h3>
          <PlaceMeta category={place.category} days={formatDaySpan(place, now)} asOf={asOf} />
        </div>
      </div>
    </Tile>
  );
}

export interface PlaceTileViewProps {
  result: TileResult<Place>;
  now?: Instant;
}

/**
 * `result` as the tile may show it at `now`: a place whose visit is not over by placeCutoffDay
 * (dated today or within the grace, a range still on, a place yet to come, an undated one) is no
 * place. selectLatestPlace never picks one; this holds for any other way a place gets here.
 */
function pastVisitsOnly(result: TileResult<Place>, now: Instant): TileResult<Place> {
  if (result.status !== 'ok') return result;
  return lastDayIfOver(result.data, placeCutoffDay(now)) === null ? NO_PLACE : result;
}

/**
 * The latest place, or a note with a way to every place. A stale one (from the list last loaded,
 * served past the deadline) says which day that list is from. Past visits only (pastVisitsOnly).
 */
export function PlaceTileView({ result, now = Date.now() }: PlaceTileViewProps): ReactElement {
  const shown = pastVisitsOnly(result, now);
  if (shown.status === 'ok') {
    const { data, stale } = shown;
    const asOf = stale ? formatAsOfDay(shown.asOf, now) : '';
    return <PlaceView place={data} now={now} stale={stale} asOf={asOf} />;
  }
  const Note = shown.status === 'error' ? TileUnavailable : TileEmpty;
  return (
    <Tile className="gap-3" data-state={shown.status}>
      <TileLabel>{LABEL}</TileLabel>
      <Note
        message={shown.status === 'error' ? 'Places unavailable' : 'No places yet'}
        href={PLACES_PATH}
        linkLabel="All places"
      />
    </Tile>
  );
}

/**
 * The loading place tile, the loaded one's size with or without a photo: the thumbnail's box
 * beside the real label, one line of the name's type and one of the meta's. The row keeps the
 * thumbnail's 64 px either way.
 */
export function PlaceTileSkeleton(): ReactElement {
  return (
    <Tile aria-busy="true" data-state="loading">
      <div className={ROW_CLASS}>
        <SkeletonBar className="size-16 shrink-0 rounded-lg" />
        <div className={TEXT_CLASS}>
          <TileLabel>{LABEL}</TileLabel>
          <SkeletonLine type="tile-title" bar="h-4 w-4/5" />
          <SkeletonLine type="tile-meta" bar="h-3 w-28 rounded-sm" />
        </div>
      </div>
      <LoadingNote>Loading the latest place</LoadingNote>
    </Tile>
  );
}

export async function PlaceTile(): Promise<ReactElement> {
  return <PlaceTileView result={await loadLatestPlace()} />;
}
