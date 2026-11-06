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
 * @file The home last-place tile: the place whose visit ended most recently. Past visits only, so
 * it never says where the owner is now: no 'Here now', and no coordinates (/places has the map).
 * selectLatestPlace picks only a visit that is over (placeCutoffDay: from noon ET the day after),
 * and the view applies the same rule again: a place whose visit may still be on, however it got
 * here, shows the empty state. A linked tile whose stretched link is the place's name. A run of
 * visits shows its first and last day ('Jul 29 – Sep 15', heard as 'Jul 29 to Sep 15'), and how
 * long ago counts from the last.
 *
 * At 18rem of tile width and above it shows the first photo as a 72 px thumbnail; narrower, or
 * without a photo, nothing takes its place.
 */

import Image from 'next/image';
import type { ReactElement } from 'react';

import { hasDestination, SrOnlyWords, Tile, TileLink } from '@/components/console';
import { urlFor } from '@/lib/sanity/client';
import type { Place } from '@/lib/sanity/loaders';
import {
  type DaySpanParts,
  formatAsOfDay,
  formatDay,
  formatDaySpan,
  formatRelative,
  type Instant,
  lastDayOf,
} from '../data/format';
import { loadLatestPlace } from '../data/loaders';
import { lastDayIfOver, placeCutoffDay } from '../data/selectors';
import type { TileResult } from '../data/tile-result';
import {
  joinMeta,
  LoadingNote,
  META_SEPARATOR,
  SkeletonBar,
  TileEmpty,
  TileLabel,
  TileMeta,
  TileUnavailable,
} from './tile-states';

const LABEL = 'Last place';
const PLACES_PATH = '/places';

/** Drawn at 72 px; the file is twice that for 2x screens. */
const THUMB_PX = 72;
const THUMB_SOURCE_PX = THUMB_PX * 2;

/** Between a span's first and last day: an en dash, as /places prints a visit's dates. */
const SPAN_DASH = ' – ';

const NAME_CLASS =
  'line-clamp-2 min-w-0 flex-1 wrap-break-word text-body font-semibold text-foreground';
const THUMB_CLASS = 'hidden size-18 shrink-0 rounded-md object-cover @2xs:block';

/**
 * The skeleton's boxes: one line of the name (text-body's line height) and the meta line
 * (text-meta's), so the tile keeps its height when a place without a photo streams in.
 */
const NAME_LINE_CLASS = 'flex h-[1.625rem] items-center';
const META_LINE_CLASS = 'mt-auto flex h-[1.125rem] items-center';

const NO_PLACE: TileResult<never> = { status: 'empty' };

/** The first photo's 144 px square, or null without a photo it can resolve. */
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
  /** How long ago, or null when the days already say when. */
  when: string | null;
  asOf: string;
}

/**
 * The context line: category, days, how long ago and, for a stale place, the list's day. A range's
 * end is markup (SpanEnd), so the line is joined around it.
 */
function PlaceMeta({ category, days, when, asOf }: PlaceMetaProps): ReactElement {
  const head = joinMeta([category, days?.start]);
  const tail = joinMeta([when, asOf]);
  return (
    // The relative day, and the date's year once the year turns, depend on today.
    <TileMeta dated>
      {head}
      {days?.end ? <SpanEnd end={days.end} /> : null}
      {head && tail ? META_SEPARATOR : null}
      {tail}
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
  // A single day, or a run of visits from first to last ('Jul 29 – Sep 15').
  const days = formatDaySpan(place, now);
  // How long ago counts from the visit's last day: a range's end.
  const lastDay = lastDayOf(place) ?? '';
  const relative = formatRelative(lastDay, now);
  // From 14 days back formatRelative gives the last day's date itself, which the days already show.
  const when = relative === formatDay(lastDay, now) ? null : relative;
  return (
    <Tile
      variant={hasDestination(href) ? 'linked' : 'plain'}
      className="gap-3"
      data-state={stale ? 'stale' : undefined}
    >
      <TileLabel>{LABEL}</TileLabel>
      <div className="flex items-start gap-3">
        <h3 className={NAME_CLASS}>
          <TileLink href={href} className="text-inherit">
            {place.name}
          </TileLink>
        </h3>
        {thumbnail && (
          <Image
            src={thumbnail}
            alt={place.photos?.[0]?.alt ?? ''}
            width={THUMB_PX}
            height={THUMB_PX}
            sizes={`${THUMB_PX}px`}
            loading="lazy"
            className={THUMB_CLASS}
          />
        )}
      </div>
      <PlaceMeta category={place.category} days={days} when={when} asOf={asOf} />
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
        className="mt-auto"
        message={shown.status === 'error' ? 'Places unavailable' : 'No places yet'}
        href={PLACES_PATH}
        linkLabel="All places"
      />
    </Tile>
  );
}

/** The loading place tile, with the real label: one name line and the meta line. */
export function PlaceTileSkeleton(): ReactElement {
  return (
    <Tile className="gap-3" aria-busy="true" data-state="loading">
      <TileLabel>{LABEL}</TileLabel>
      <span className={NAME_LINE_CLASS}>
        <SkeletonBar className="h-5 w-4/5" />
      </span>
      <span className={META_LINE_CLASS}>
        <SkeletonBar className="h-3 w-32 rounded-sm" />
      </span>
      <LoadingNote>Loading the latest place</LoadingNote>
    </Tile>
  );
}

export async function PlaceTile(): Promise<ReactElement> {
  return <PlaceTileView result={await loadLatestPlace()} />;
}
