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
 * @file A book's upright cover in its frame, with the hinge's shading. BookDetailView draws it, so
 * it shows in the stage's in-page detail and on /bookshelf/[slug], where it is the page's LCP
 * image. Guarded by tests/unit/bookshelf/book-detail-view.test.tsx.
 */

import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { COVER_HEIGHT, COVER_WIDTH, coverAt } from '../_lib/book-covers';
import type { BookItem } from '../_lib/books';
import styles from './book-cover-frame.module.css';

/**
 * The frame's widths (book-cover-frame.module.css .detail-cover): 340 px, and 260 px at 900 px
 * wide and under.
 */
const FRAME_WIDTH = 340;
const FRAME_SIZES = '(max-width: 900px) 260px, 340px';

export interface BookCoverFrameProps {
  readonly book: BookItem;
  readonly className?: string;
  readonly priority?: boolean;
}

/**
 * A book's cover in its frame, in the detail view both in-page and on `/bookshelf/[slug]`. With
 * `priority` it is the page's hero (its LCP image): loaded eagerly and at high fetch priority, the
 * one cover that is.
 */
export function BookCoverFrame({
  book,
  className,
  priority = false,
}: BookCoverFrameProps): ReactElement {
  return (
    <div className={cn(styles['detail-cover'], 'select-none', className)}>
      <div className={styles.cover}>
        {/* biome-ignore lint/performance/noImgElement: Sanity CDN cover, sized to how it is drawn (coverAt); next.config disables /_next/image. */}
        <img
          src={book.coverSrc}
          srcSet={`${coverAt(book.coverSrc, FRAME_WIDTH)} ${FRAME_WIDTH}w, ${book.coverSrc} ${COVER_WIDTH}w`}
          sizes={FRAME_SIZES}
          alt={book.coverAlt}
          width={COVER_WIDTH}
          height={COVER_HEIGHT}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
          draggable={false}
          className={styles['cover-img']}
        />
      </div>
    </div>
  );
}
