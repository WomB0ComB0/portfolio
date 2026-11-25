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
 * Upright, tactile book cover with a subtle spine crease, right-edge paper block, and soft
 * grounded shadow, used on the book detail screen.
 */
export function BookCoverFrame({
  book,
  className,
  priority = false,
}: BookCoverFrameProps): ReactElement {
  return (
    <div className={cn('relative inline-flex w-full max-w-[360px] select-none', className)}>
      <div
        className={cn(
          'relative aspect-[520/680] w-full overflow-hidden rounded-[6px_10px_10px_6px] border border-hairline-strong/80 bg-surface-1',
          styles['detail-cover-shadow'],
        )}
      >
        {/* biome-ignore lint/performance/noImgElement: Local WebP asset served directly from public/assets/bookshelf (next.config disables /_next/image). */}
        <img
          src={book.coverSrc}
          alt={`${book.title} by ${book.authors}`}
          width={520}
          height={680}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className={cn('pointer-events-none absolute inset-0', styles['cover-crease'])}
        />
      </div>
      <div
        aria-hidden="true"
        className={cn(
          'my-[5px] w-[7px] shrink-0 rounded-r-[3px] border-y border-r border-black/25',
          styles['page-block-edge'],
        )}
      />
    </div>
  );
}
