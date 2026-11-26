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

'use client';

import { type CSSProperties, memo, type ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { type BookItem, COVER_HEIGHT, COVER_WIDTH, coverAt } from '../_lib/books';
import styles from './bookshelf.module.css';

/**
 * Where the first book either side of the active one sits from the stage's centre, and the pitch
 * between the books after it, in book heights. A shelf's page spaces its books a little wider.
 */
const SLOT_GEOMETRY = {
  circular: { first: 0.515, pitch: 0.19 },
  finite: { first: 0.53, pitch: 0.205 },
} as const;

/** The books this far from the active one, or nearer, load eagerly: a step or two shows them. */
const NEAR_OFFSET = 2;
/**
 * The cover widths drawn, in CSS px. The active cover is about 0.75 of the book height wide, at
 * most 265 px (the stage tops out at 420 px): the 260 px copy at 1x, the 520 px source at 2x and
 * up. Every other book shows only a sliver of its cover, edge on. A near one holds the 260 px
 * copy, so a step turns it to a cover already loaded (at 2x the source follows as it turns); a
 * farther one needs no more than 96 px. On the production covers (AVIF: source 26 KB, 260 px
 * 9 KB, 96 px 2 KB), the source at 2x on all five near books put a 375 px phone at 3x over its
 * 250 KB first-load budget: 281 KB, against 207 KB with it on the active book alone.
 */
const NEAR_COVER_WIDTH = 260;
const FAR_COVER_WIDTH = 96;

/**
 * A slot's horizontal place as a factor of the book height: 0 for the active book, negative to
 * its left. The slot renders it as calc(var(--book-h) * factor), so the server's HTML puts every
 * book where the browser will, and a lazy cover off the stage stays unloaded.
 */
export function slotOffsetFactor(offset: number, finite: boolean): number {
  if (offset === 0) return 0;
  const { first, pitch } = finite ? SLOT_GEOMETRY.finite : SLOT_GEOMETRY.circular;
  return Math.sign(offset) * (first + (Math.abs(offset) - 1) * pitch);
}

/**
 * A slot's cover sources: the active book's 260 px copy with the source at 2x, a near book's
 * 260 px copy, a far book's 96 px copy.
 */
function slotCover(
  src: string,
  offset: number,
): { readonly src: string; readonly srcSet?: string } {
  const distance = Math.abs(offset);
  if (distance > NEAR_OFFSET) return { src: coverAt(src, FAR_COVER_WIDTH) };
  const near = coverAt(src, NEAR_COVER_WIDTH);
  if (distance > 0) return { src: near };
  return { src: near, srcSet: `${near} 1x, ${coverAt(src, COVER_WIDTH)} 2x` };
}

export interface BookshelfBookSlotProps {
  readonly poolIndex: number;
  readonly offset: number;
  /** slotOffsetFactor(offset, finite): the slot's place from the centre, in book heights. */
  readonly x: number;
  readonly book: BookItem;
  readonly isActive: boolean;
  readonly isHighlighted: boolean;
  readonly isDimmed: boolean;
  readonly registerRef: (poolIndex: number, element: HTMLDivElement | null) => void;
}

/**
 * Single 3D cuboid book slot rendered in fixed ascending `poolIndex` order so CSS transitions
 * stay identical in both left and right directions. Its place, stacking and state classes
 * (active, before/after, highlighted, dimmed) come from props, so the server HTML already paints
 * the active cover and the tilts; the stage's layout effect only adds the teleport (.no-anim).
 */
export const BookshelfBookSlot = memo(function BookshelfBookSlot({
  poolIndex,
  offset,
  x,
  book,
  isActive,
  isHighlighted,
  isDimmed,
  registerRef,
}: BookshelfBookSlotProps): ReactElement {
  const cover = slotCover(book.coverSrc, offset);
  return (
    <div
      ref={(el) => registerRef(poolIndex, el)}
      data-pool-index={poolIndex}
      data-slot-offset={offset}
      data-active-slot={isActive ? 'true' : 'false'}
      data-book-status={book.status}
      data-highlighted={isHighlighted ? 'true' : 'false'}
      data-dimmed={isDimmed ? 'true' : 'false'}
      className={cn(
        styles.slot,
        isActive && styles['is-active'],
        offset < 0 && styles['is-before'],
        offset > 0 && styles['is-after'],
        isHighlighted && styles['is-highlighted'],
        isDimmed && styles['is-dimmed'],
      )}
      style={
        {
          '--slot-x': x === 0 ? '0px' : `calc(var(--book-h) * ${x.toFixed(4)})`,
          zIndex: 100 - Math.abs(offset),
        } as CSSProperties
      }
    >
      <div
        className={styles.book}
        style={
          {
            '--spine-hdr': book.spine.capBg,
            '--spine-body': book.spine.bodyBg,
            '--spine-num': book.spine.capText,
            '--spine-ink': book.spine.titleColor,
          } as CSSProperties
        }
      >
        <div className={cn(styles.face, styles['face-spine'])}>
          <div className={styles['spine-hdr']}>{book.stageLabel}</div>
          <div className={styles['spine-title']}>
            <span>{book.spineTitle}</span>
          </div>
          <div className={styles['spine-author']}>
            <span>{book.spineAuthor}</span>
          </div>
          <div
            aria-hidden="true"
            className={cn(styles['spine-status-bar'], styles[`spine-status-${book.status}`])}
          />
        </div>

        <div data-book-cover className={cn(styles.face, styles['face-cover'])}>
          <div className={styles.cover}>
            {/* biome-ignore lint/performance/noImgElement: Sanity CDN cover, sized to how it is drawn (coverAt); next.config disables /_next/image. */}
            <img
              // Keyed by book: a slot reused for another book (a jump) mounts a fresh <img> and
              // shows the cover background, never the previous book's cover, until its own loads.
              key={book.slug}
              src={cover.src}
              srcSet={cover.srcSet}
              alt={book.coverAlt}
              width={COVER_WIDTH}
              height={COVER_HEIGHT}
              loading={Math.abs(offset) <= NEAR_OFFSET ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
              className={styles['cover-img']}
            />
          </div>
        </div>

        <div className={cn(styles.face, styles['face-back'])} />
        <div className={cn(styles.face, styles['face-pages'])} />
      </div>

      {/* Full-cover 2D hit plane for active book (eliminates 51px perspective hit clipping) */}
      <div
        aria-hidden="true"
        data-active-hit={isActive ? 'true' : 'false'}
        className={styles['active-hit']}
      />
      <div aria-hidden="true" className={styles['slot-shadow']} />
    </div>
  );
});
