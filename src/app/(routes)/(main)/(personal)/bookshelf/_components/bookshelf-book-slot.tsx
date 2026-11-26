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
import type { BookItem } from '../_lib/books';
import styles from './bookshelf.module.css';

export interface BookshelfBookSlotProps {
  readonly poolIndex: number;
  readonly offset: number;
  readonly book: BookItem;
  readonly isActive: boolean;
  readonly isHighlighted: boolean;
  readonly isDimmed: boolean;
  readonly registerRef: (poolIndex: number, element: HTMLDivElement | null) => void;
}

/**
 * Single 3D cuboid book slot rendered in fixed ascending `poolIndex` order so CSS transitions
 * stay identical in both left and right directions.
 */
export const BookshelfBookSlot = memo(function BookshelfBookSlot({
  poolIndex,
  offset,
  book,
  isActive,
  isHighlighted,
  isDimmed,
  registerRef,
}: BookshelfBookSlotProps): ReactElement {
  return (
    <div
      ref={(el) => registerRef(poolIndex, el)}
      data-pool-index={poolIndex}
      data-slot-offset={offset}
      data-active-slot={isActive ? 'true' : 'false'}
      data-book-status={book.status}
      data-highlighted={isHighlighted ? 'true' : 'false'}
      data-dimmed={isDimmed ? 'true' : 'false'}
      className={styles.slot}
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
            {/* biome-ignore lint/performance/noImgElement: Sanity CDN cover, sized by urlFor (520x680); next.config disables /_next/image. */}
            <img
              src={book.coverSrc}
              alt={book.coverAlt}
              width={520}
              height={680}
              loading={Math.abs(offset) <= 2 ? 'eager' : 'lazy'}
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
