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
import type { BookItem } from '../_lib/books';
import styles from './bookshelf.module.css';

export interface BookCoverFrameProps {
  readonly book: BookItem;
  readonly className?: string;
  readonly priority?: boolean;
}

/**
 * Borderless upright book cover with subtle spine-hinge shading and elevation shadow,
 * shared by the standalone `/bookshelf/[slug]` route.
 */
export function BookCoverFrame({
  book,
  className,
  priority = false,
}: BookCoverFrameProps): ReactElement {
  return (
    <div className={cn(styles['detail-cover'], 'select-none', className)}>
      <div className={styles.cover}>
        {/* biome-ignore lint/performance/noImgElement: Sanity CDN cover, sized by urlFor (520x680); next.config disables /_next/image. */}
        <img
          src={book.coverSrc}
          alt={book.coverAlt}
          width={520}
          height={680}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          className={styles['cover-img']}
        />
      </div>
    </div>
  );
}
