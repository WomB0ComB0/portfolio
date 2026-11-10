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
 * the same. The first GRID_FIRST show; "Show all" reveals the rest (without script, a note says
 * how to see them instead).
 */

import Image from 'next/image';
import Link from 'next/link';
import { type MouseEvent, type ReactElement, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import type { WallPhoto } from '@/types/places';
import { PlaceDateRange } from '../../_components/place-date-range';
import { placeholderOf } from '../_lib/card-placeholder';
import { focusPosition, gridLinkSuffix } from '../_lib/photo-labels';
import styles from './photo-grid.module.css';
import type { OpenPhoto, PlacesById } from './photo-types';

/** The grid shows this many photos before "Show all". */
export const GRID_FIRST = 48;
/** Two columns on a phone, 240 px cards wider (the source covers 480 x 360). */
const THUMB_SIZES = '(max-width: 639px) 50vw, 240px';

export interface PhotoGridProps {
  readonly photos: readonly WallPhoto[];
  readonly places: PlacesById;
  readonly onOpen: OpenPhoto;
  /** Whether a plain click opens the view; false once its code failed to load. */
  readonly enhance: boolean;
}

/** Whether a click is a plain left click, the only one the open view takes over. */
const isPlainClick = (event: MouseEvent): boolean =>
  event.button === 0 &&
  !event.defaultPrevented &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

/** Every photo's link, the first GRID_FIRST at once and the rest behind "Show all". */
export function PhotoGrid({ photos, places, onOpen, enhance }: PhotoGridProps): ReactElement {
  const [all, setAll] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const shown = all ? photos : photos.slice(0, GRID_FIRST);
  const hidden = photos.length - shown.length;

  // "Show all" leaves the page: hand focus to the first photo it revealed.
  useEffect(() => {
    if (!all) return;
    listRef.current?.querySelectorAll<HTMLAnchorElement>('a')[GRID_FIRST]?.focus();
  }, [all]);

  /** Opens the photo in the view on a plain left click; any other click is the link's own. */
  const openOnClick = (event: MouseEvent<HTMLAnchorElement>, photo: WallPhoto): void => {
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

  return (
    <div className={styles.root}>
      <ul ref={listRef} aria-label="Photos" className={styles.grid}>
        {shown.map((photo) => {
          const place = places.get(photo.placeId);
          if (!place) return null;
          return (
            <li key={photo.key}>
              <Link
                href={`/places/${encodeURIComponent(photo.placeId)}`}
                prefetch={false}
                className={styles.card}
                onClick={(event) => openOnClick(event, photo)}
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
                      sizes={THUMB_SIZES}
                      className={styles.thumb}
                      style={{ objectPosition: focusPosition(photo) }}
                      draggable={false}
                    />
                  </span>
                  <span className={styles.light} />
                </span>
                <span className={cn(styles.name, 'line-clamp-2')}>{place.name}</span>{' '}
                <span className={styles.meta}>
                  {place.category}
                  {place.startDate ? (
                    <>
                      <span aria-hidden="true">{' · '}</span>{' '}
                      <PlaceDateRange startDate={place.startDate} endDate={place.endDate} />
                    </>
                  ) : null}
                </span>
                <span className="sr-only">{gridLinkSuffix(photo, place)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {hidden > 0 ? (
        <>
          <button type="button" className={styles.more} onClick={() => setAll(true)}>
            Show all {photos.length} photos
          </button>
          <p className={styles['no-script-note']}>
            Showing {GRID_FIRST} of {photos.length}. Open a place for all of its photos, or narrow
            the list with the filters.
          </p>
        </>
      ) : null}
    </div>
  );
}
