'use client';

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
 * @file The photos as a plain captioned grid: the first view on touch, before JavaScript and
 * without it. Every photo is a real link to its past place's page, so it works with no script;
 * a plain left click is upgraded to the open view (a modified or middle click still opens the
 * place). Each link is named by its place, category, dates and its number there, so no two read
 * the same; the name is one aria-label string, so every browser reads it with the same commas
 * and spaces. The first GRID_FIRST show; "Show all" reveals the rest (without script, a note says
 * how to see them instead).
 *
 * The links, the line under each name, the end of each link's name (which the card does not show),
 * how many show first and the list's name are the places' by default; another page (the /projects
 * Screens view, whose pictures link to their projects and are all listed) passes its own. That page
 * also names each project once per run of its pictures (`runs`): the first card of a run carries
 * the name and the line under it, the rest only their figure number ('Fig. 2'), whose link names
 * start with that number, as shown, and go on with the name; from a 40rem window those cards sit in
 * a justified contact sheet, each at its own shape, as the project page shows its screens.
 *
 * A name (and the line under it) is never cut: it wraps at its spaces, a short name with a hyphen
 * or slash ('(PG-FMS)') moves whole to the next line whenever it fits there (whole-words.tsx),
 * and enlarged text is set smaller only down to the normal size, so a word wider than the card
 * even then breaks (its width estimated from its letters, word-measure). The line under a name is
 * never larger than the name.
 */

import Link from 'next/link';
import {
  type CSSProperties,
  Fragment,
  type MouseEvent,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from 'react';
import { widestWordUnits } from '@/components/console/folio/word-measure';
import { WholeWords } from '@/components/console/photo/whole-words';
import Image from '@/components/ui/cdn-image';
import type { PhotoPlace, WallPhoto } from '@/types/places';
import { PlaceDateRange } from '../../_components/place-date-range';
import { placeholderOf } from '../_lib/card-placeholder';
import { focusPosition, gridLinkName, gridLinkSuffix, placeMetaWords } from '../_lib/photo-labels';
import styles from './photo-grid.module.css';
import type { OpenPhoto, PlacesById } from './photo-types';

/** The grid shows this many photos before "Show all". */
const GRID_FIRST = 48;
/** Two columns on a phone, 240 px cards wider (the source covers 480 x 360). */
const THUMB_SIZES = '(max-width: 639px) 50vw, 240px';
/** A contact sheet's tile grows to about 400 px (a wide shot on a 1440 window). */
const RUN_SIZES = '(max-width: 639px) 50vw, 400px';
/**
 * A tile's shape in the contact sheet: its picture's own, kept between these. A run's first
 * picture is never narrower than 5:4, so the name under it has room; a phone screenshot after it
 * may be as narrow as 3:5.
 */
const LEAD_RATIO = { min: 1.25, max: 2 } as const;
const FIG_RATIO = { min: 0.6, max: 2 } as const;

/** A photo's place page: the grid's own link. */
const placeHref = (photo: WallPhoto): string => `/places/${encodeURIComponent(photo.placeId)}`;

export interface PhotoGridProps {
  readonly photos: readonly WallPhoto[];
  readonly places: PlacesById;
  readonly onOpen: OpenPhoto;
  /** Whether a plain click opens the view; false once its code failed to load. */
  readonly enhance: boolean;
  /** Where a photo's link goes; its place's page by default. */
  readonly hrefOf?: (photo: WallPhoto) => string;
  /**
   * The line under the name, as parts joined by a dot only the eye sees; the place's category
   * and dates by default.
   */
  readonly metaOf?: (place: PhotoPlace) => readonly string[];
  /**
   * The end of a link's name, which the card does not show (', photo 3 of 5: …'); gridLinkSuffix
   * by default.
   */
  readonly suffixOf?: (photo: WallPhoto, place: PhotoPlace) => string;
  /** How many show before "Show all"; GRID_FIRST by default. */
  readonly first?: number;
  /** The list's name; 'Photos' by default. */
  readonly label?: string;
  /**
   * Name a place once per run of its photos, the rest of the run numbered, in a justified
   * contact sheet from a 40rem window (see the file comment). Off by default.
   */
  readonly runs?: boolean;
}

/** A card in a run: its run's first (named) or a later one (numbered); null outside runs. */
type RunPart = 'lead' | 'fig' | null;

/** The text's widest word as word-measure units, for a fit size in CSS. */
const unitsOf = (text: string): string => String(widestWordUnits(text));

/** The line under a name: its own widest word (`--fit`). */
const fitOf = (text: string): CSSProperties => ({ '--fit': unitsOf(text) }) as CSSProperties;

/**
 * A card's own values for CSS, on its cell: its name's widest word (`--name-fit`), which sizes the
 * name and caps the line under it, and in a run its tile's shape for the contact sheet (`--r`),
 * its picture's own within the run's bounds.
 */
function cellStyle(photo: WallPhoto, place: PhotoPlace, part: RunPart): CSSProperties {
  const nameFit = { '--name-fit': unitsOf(place.name) };
  if (part === null) return nameFit as CSSProperties;
  const { min, max } = part === 'lead' ? LEAD_RATIO : FIG_RATIO;
  const ratio = Number.isFinite(photo.ratio) && photo.ratio > 0 ? photo.ratio : 4 / 3;
  return { ...nameFit, '--r': String(Math.min(max, Math.max(min, ratio))) } as CSSProperties;
}

/** Each photo's part in its run: the first of a place's consecutive photos leads. */
const runParts = (photos: readonly WallPhoto[], runs: boolean): RunPart[] =>
  photos.map((photo, at) => {
    if (!runs) return null;
    return photos[at - 1]?.placeId === photo.placeId ? 'fig' : 'lead';
  });

/** The line under a card's name: the parts given, or the place's category and dates. */
function CardMeta({
  place,
  metaOf,
}: {
  readonly place: PhotoPlace;
  readonly metaOf: PhotoGridProps['metaOf'];
}): ReactElement {
  if (metaOf) {
    const parts = metaOf(place);
    return (
      <span className={styles.meta} style={fitOf(parts.join(' '))}>
        {parts.map((part, at) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a short fixed list whose parts may read the same.
          <Fragment key={at}>
            {at > 0 ? (
              <>
                <span aria-hidden="true">{' · '}</span>{' '}
              </>
            ) : null}
            {part}
          </Fragment>
        ))}
      </span>
    );
  }
  return (
    <span className={styles.meta} style={fitOf(place.category)}>
      {place.category}
      {place.startDate ? (
        <>
          <span aria-hidden="true">{' · '}</span>{' '}
          <PlaceDateRange startDate={place.startDate} endDate={place.endDate} />
        </>
      ) : null}
    </span>
  );
}

/** Whether a click is a plain left click, the only one the open view takes over. */
const isPlainClick = (event: MouseEvent): boolean =>
  event.button === 0 &&
  !event.defaultPrevented &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

/**
 * The card's words: the name over the line under it; in a run's later card only its number
 * shows ('Fig. 2'). Its link's name (linkName) starts with that number, as a voice user says what
 * they see, then goes on with the name and the line ('Fig. 2, ResQ Viz, …').
 */
function CardWords({
  place,
  metaOf,
  fig,
}: {
  readonly place: PhotoPlace;
  readonly metaOf: PhotoGridProps['metaOf'];
  /** The photo's number among its place's, for a run's later card; else null. */
  readonly fig: number | null;
}): ReactElement {
  if (fig !== null) return <span className={styles.fig}>Fig. {fig}</span>;
  return (
    <>
      <span className={styles.name}>
        <WholeWords text={place.name} />
      </span>{' '}
      <CardMeta place={place} metaOf={metaOf} />
    </>
  );
}

interface GridCardProps
  extends Required<Pick<PhotoGridProps, 'hrefOf' | 'suffixOf'>>,
    Pick<PhotoGridProps, 'metaOf'> {
  readonly photo: WallPhoto;
  readonly place: PhotoPlace;
  readonly part: RunPart;
  readonly onClick: (event: MouseEvent<HTMLAnchorElement>, photo: WallPhoto) => void;
}

/**
 * A card's link name, whole: what the card shows, then the end it does not ('Antler NYC,
 * Hackathon, May 19 to 20, 2026, photo 3 of 5: Opening night'), the same in every browser.
 */
function linkName(
  photo: WallPhoto,
  place: PhotoPlace,
  part: RunPart,
  { metaOf, suffixOf }: Pick<GridCardProps, 'metaOf' | 'suffixOf'>,
): string {
  return gridLinkName({
    fig: part === 'fig' ? photo.index : null,
    name: place.name,
    meta: metaOf ? metaOf(place) : placeMetaWords(place),
    suffix: suffixOf(photo, place),
  });
}

/** One photo's card: a real link named in full, its picture, the name and the line under it. */
function GridCard({
  photo,
  place,
  part,
  onClick,
  hrefOf,
  metaOf,
  suffixOf,
}: GridCardProps): ReactElement {
  return (
    <li className={styles.cell} style={cellStyle(photo, place, part)} data-run={part ?? undefined}>
      <Link
        href={hrefOf(photo)}
        prefetch={false}
        className={styles.card}
        onClick={(event) => onClick(event, photo)}
        aria-label={linkName(photo, place, part, { metaOf, suffixOf })}
        data-photo-key={photo.key}
      >
        <span className={styles.frame} data-grid-frame="">
          {/* The photo is clipped to the rounded frame here, not by the frame itself,
              so the light beside it can draw its halo outside the frame. */}
          <span className={styles.clip}>
            <Image
              src={photo.thumb}
              alt=""
              fill
              sizes={part === null ? THUMB_SIZES : RUN_SIZES}
              className={styles.thumb}
              style={{ objectPosition: focusPosition(photo) }}
              draggable={false}
            />
          </span>
          <span className={styles.light} />
        </span>
        <CardWords place={place} metaOf={metaOf} fig={part === 'fig' ? photo.index : null} />
      </Link>
    </li>
  );
}

/**
 * The click handler every card shares: a plain left click opens the photo in the view (when it
 * can), handing it the card's frame to fly from; any other click is the link's own.
 */
const openerFor =
  (enhance: boolean, onOpen: OpenPhoto) =>
  (event: MouseEvent<HTMLAnchorElement>, photo: WallPhoto): void => {
    if (!enhance || !isPlainClick(event)) return;
    const link = event.currentTarget;
    const frame = link.querySelector<HTMLElement>('[data-grid-frame]');
    event.preventDefault();
    onOpen({
      photo,
      source: frame,
      placeholder: frame ? placeholderOf(frame) : '',
      returnFocus: link,
    });
  };

/** "Show all", and the note that stands in for it without script. */
function ShowAll({
  total,
  first,
  onShow,
}: {
  readonly total: number;
  readonly first: number;
  readonly onShow: () => void;
}): ReactElement {
  return (
    <>
      <button type="button" className={styles.more} onClick={onShow}>
        Show all {total} photos
      </button>
      <p className={styles['no-script-note']}>
        Showing {first} of {total}. Open a place for all of its photos, or narrow the list with the
        filters.
      </p>
    </>
  );
}

/** Every photo's link, the first GRID_FIRST at once and the rest behind "Show all". */
export function PhotoGrid({
  photos,
  places,
  onOpen,
  enhance,
  hrefOf = placeHref,
  metaOf,
  suffixOf = gridLinkSuffix,
  first = GRID_FIRST,
  label = 'Photos',
  runs = false,
}: PhotoGridProps): ReactElement {
  const [all, setAll] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const shown = all ? photos : photos.slice(0, first);
  const parts = runParts(shown, runs);
  const openOnClick = openerFor(enhance, onOpen);

  // "Show all" leaves the page: hand focus to the first photo it revealed.
  useEffect(() => {
    if (!all) return;
    listRef.current?.querySelectorAll<HTMLAnchorElement>('a')[first]?.focus();
  }, [all, first]);

  return (
    <div className={styles.root}>
      <ul ref={listRef} aria-label={label} className={styles.grid} data-runs={runs || undefined}>
        {shown.map((photo, at) => {
          const place = places.get(photo.placeId);
          if (!place) return null;
          return (
            <GridCard
              key={photo.key}
              photo={photo}
              place={place}
              part={parts[at] ?? null}
              onClick={openOnClick}
              hrefOf={hrefOf}
              metaOf={metaOf}
              suffixOf={suffixOf}
            />
          );
        })}
      </ul>
      {photos.length > shown.length ? (
        <ShowAll total={photos.length} first={first} onShow={() => setAll(true)} />
      ) : null}
    </div>
  );
}
