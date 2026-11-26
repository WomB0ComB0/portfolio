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

import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { type BookItem, COVER_HEIGHT, COVER_WIDTH, coverAt } from '../_lib/books';
import styles from './bookshelf.module.css';

/**
 * The frame's widths (bookshelf.module.css .detail-cover): 340 px, and 260 px at 900 px wide and
 * under, where the cover moves above the text.
 */
const FRAME_WIDTH = 340;
const FRAME_SIZES = '(max-width: 900px) 260px, 340px';

export interface BookCoverFrameProps {
  readonly book: BookItem;
  readonly className?: string;
  readonly priority?: boolean;
}

/**
 * Borderless upright book cover with subtle spine-hinge shading and elevation shadow,
 * shared by the standalone `/bookshelf/[slug]` route. With `priority` it is the page's hero (its
 * LCP image): loaded eagerly and at high fetch priority, the one cover that is.
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
