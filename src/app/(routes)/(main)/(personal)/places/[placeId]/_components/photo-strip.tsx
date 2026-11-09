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
 * @file A row of photo thumbnails that picks the photo the place viewer shows (the focus-cards
 * pattern, our own rewrite; the owner's pick B in the Aceternity lab review). It is a toolbar:
 * ONE Tab stop (the photo shown), Left and Right (and Home and End) move between thumbnails, and
 * Enter or Space shows the one focused (a native button's click). Every thumbnail is a real
 * button named "Photo n of N" (plus its caption), and the photo shown is marked aria-current. The
 * look is CSS (photo-strip.module.css); the script only keeps the shown or focused thumbnail in
 * view inside the strip, never by scrolling the page.
 */

import Image from 'next/image';
import {
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from 'react';

import { prefersReducedMotion } from '@/lib/design/motion';
import type { ViewerPhoto } from '../page.types';
import styles from './photo-strip.module.css';

/** Drawn at most 160 x 120 on a wide screen (the 10rem cap), 104 px wide on a phone. */
const THUMB_WIDTH = 160;
const THUMB_HEIGHT = 120;
const THUMB_SIZES = '(max-width: 639px) 104px, 160px';

/** What a thumbnail needs from a viewer photo. */
export type StripPhoto = Pick<ViewerPhoto, 'thumb' | 'caption'>;

export interface PhotoStripProps {
  readonly photos: readonly StripPhoto[];
  /** The photo shown, 0-based. */
  readonly index: number;
  readonly onPick: (index: number) => void;
  /** Names the toolbar, e.g. "Photos of Pubkey". */
  readonly label: string;
}

/** Where each key moves the focus from `from`, among `count` thumbnails; null for other keys. */
function moveFor(key: string, from: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return Math.min(from + 1, count - 1);
    case 'ArrowLeft':
      return Math.max(from - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/** Scrolls `strip` sideways so `item` sits in its middle; nothing when the strip doesn't scroll. */
function centreInStrip(strip: HTMLElement, item: HTMLElement): void {
  if (strip.scrollWidth <= strip.clientWidth) return;
  const stripBox = strip.getBoundingClientRect();
  const itemBox = item.getBoundingClientRect();
  const delta = itemBox.left - stripBox.left - (stripBox.width - itemBox.width) / 2;
  strip.scrollBy({ left: delta, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

export function PhotoStrip({ photos, index, onPick, label }: PhotoStripProps): ReactElement {
  const stripRef = useRef<HTMLDivElement>(null);
  const shownIndex = useRef(index);
  /** The roving Tab stop while the keyboard is in the strip; null follows the photo shown. */
  const [roving, setRoving] = useState<number | null>(null);
  const stop = roving ?? index;

  // A new photo shown (from the strip, a swipe or the keyboard) is brought to the strip's middle.
  // The first render keeps the server's scroll position: the first photo, at the start.
  useEffect(() => {
    if (shownIndex.current === index) return;
    shownIndex.current = index;
    const strip = stripRef.current;
    const current = strip?.querySelector<HTMLElement>('[aria-current="true"]');
    if (strip && current) centreInStrip(strip, current);
  }, [index]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // Alt+Left and Cmd+Left are the browser's back; any modified key stays the browser's.
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = moveFor(event.key, stop, photos.length);
    if (next === null) return;
    event.preventDefault();
    setRoving(next);
    const strip = stripRef.current;
    const button = strip?.querySelectorAll<HTMLButtonElement>('button')[next];
    if (!strip || !button) return;
    button.focus({ preventScroll: true });
    centreInStrip(strip, button);
  };

  /** Leaving the strip hands the Tab stop back to the photo shown. */
  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget)) setRoving(null);
  };

  return (
    <div
      ref={stripRef}
      role="toolbar"
      aria-label={label}
      aria-orientation="horizontal"
      className={styles.strip}
      style={{ '--n': photos.length } as CSSProperties}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      data-photo-strip=""
    >
      {photos.map((photo, i) => (
        <button
          key={`${photo.thumb}-${+i}`}
          type="button"
          className={styles.thumb}
          tabIndex={i === stop ? 0 : -1}
          aria-current={i === index ? 'true' : undefined}
          aria-label={`Photo ${i + 1} of ${photos.length}${photo.caption ? `: ${photo.caption}` : ''}`}
          onClick={() => {
            setRoving(null);
            onPick(i);
          }}
        >
          <Image
            src={photo.thumb}
            alt=""
            width={THUMB_WIDTH}
            height={THUMB_HEIGHT}
            sizes={THUMB_SIZES}
            className={styles.img}
            draggable={false}
          />
          <span className={styles.light} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
