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

/**
 * @file The row under the stage: the stage or book number, the active book's title, status and
 * Open notes link, and the previous and next arrows (disabled at the ends of a shelf's page).
 * Guarded by tests/unit/bookshelf/bookshelf-stage.test.tsx.
 */

import type { ReactElement } from 'react';
import { FiArrowLeft, FiArrowRight, FiArrowUpRight } from 'react-icons/fi';
import { cn } from '@/lib/utils';
import { formatStageLabel } from '../_lib/book-labels';
import type { BookItem } from '../_lib/books';
import { BookStatusBadge } from './book-status-badge';
import styles from './bookshelf-controls-bar.module.css';

export interface BookshelfControlsBarProps {
  readonly isSingleShelf: boolean;
  readonly isFiniteShelf: boolean;
  readonly pos: number;
  readonly displayIndex: number;
  readonly bookCount: number;
  readonly activeBook: BookItem;
  readonly onOpenDetail: (book: BookItem) => void;
  readonly onStep: (delta: number) => void;
}

/** Stage readout, open-notes trigger, and previous/next step buttons. */
export function BookshelfControlsBar({
  isSingleShelf,
  isFiniteShelf,
  pos,
  displayIndex,
  bookCount,
  activeBook,
  onOpenDetail,
  onStep,
}: BookshelfControlsBarProps): ReactElement {
  return (
    <div className={styles['controls-row']}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="tile-meta tabular-nums text-brand-ink">
          {isSingleShelf
            ? `Book ${formatStageLabel(displayIndex + 1)} / ${formatStageLabel(bookCount)}`
            : `Stage ${activeBook.stageLabel} / ${formatStageLabel(bookCount)}`}
        </span>
        <span aria-hidden="true" className="text-faint">
          ·
        </span>
        <span className="tile-sub font-medium text-foreground">{activeBook.title}</span>
        <BookStatusBadge status={activeBook.status} data-active-status={activeBook.status} />
        <span aria-hidden="true" className="text-faint">
          ·
        </span>
        <button
          type="button"
          onClick={() => onOpenDetail(activeBook)}
          className="inline-flex items-center gap-1 tile-meta text-brand-ink underline-offset-4 hover:text-foreground hover:underline"
        >
          Open notes ({activeBook.topics.length} topics)
          <FiArrowUpRight className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className={styles['controls-arrows']}>
        <button
          type="button"
          onClick={() => onStep(-1)}
          disabled={isFiniteShelf && pos <= 0}
          aria-label="Previous book"
          className={cn(styles.arrow, isFiniteShelf && pos <= 0 && 'opacity-35')}
        >
          <FiArrowLeft className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onStep(1)}
          disabled={isFiniteShelf && pos >= bookCount - 1}
          aria-label="Next book"
          className={cn(styles.arrow, isFiniteShelf && pos >= bookCount - 1 && 'opacity-35')}
        >
          <FiArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
