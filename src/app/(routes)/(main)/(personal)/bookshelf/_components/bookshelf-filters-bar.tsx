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

import Link from 'next/link';
import type { MutableRefObject, ReactElement } from 'react';
import { FiArrowUpRight } from 'react-icons/fi';
import { cn } from '@/lib/utils';
import {
  BOOK_STATUS_META,
  BOOK_STATUSES,
  type BookCategory,
  type BookStatus,
  type BookStatusFilter,
} from '../_lib/books';
import styles from './bookshelf.module.css';

export interface TabIndicatorState {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly ready: boolean;
}

export interface BookshelfFiltersBarProps {
  readonly showCategories: boolean;
  readonly categories: readonly BookCategory[];
  readonly categoryCounts: Readonly<Record<string, number>>;
  readonly highlightedTrack: string | null;
  readonly activeTabCategory: BookCategory;
  readonly tabIndicator: TabIndicatorState;
  readonly tabButtonRefs: MutableRefObject<Map<BookCategory, HTMLButtonElement>>;
  readonly onSelectCategory: (category: BookCategory) => void;
  readonly statusFilter: BookStatusFilter;
  readonly statusCounts: Readonly<Record<BookStatusFilter, number>>;
  readonly onSelectStatus: (status: BookStatusFilter) => void;
  readonly highlightedShelfSlug: string | null;
  readonly matchingFilterCount: number;
  readonly onResetFilters: () => void;
}

/** Category tablist, reading-status filter chips, shelf shortcut, and empty-match banner. */
export function BookshelfFiltersBar({
  showCategories,
  categories,
  categoryCounts,
  highlightedTrack,
  activeTabCategory,
  tabIndicator,
  tabButtonRefs,
  onSelectCategory,
  statusFilter,
  statusCounts,
  onSelectStatus,
  highlightedShelfSlug,
  matchingFilterCount,
  onResetFilters,
}: BookshelfFiltersBarProps): ReactElement {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {showCategories && (
          <div role="tablist" aria-label="Categories" className={styles['track-bar']}>
            <span
              aria-hidden="true"
              className={cn(styles['track-pill'], !tabIndicator.ready && styles['no-anim'])}
              style={{
                width: `${tabIndicator.width}px`,
                height: `${tabIndicator.height}px`,
                transform: `translate3d(${tabIndicator.left}px, ${tabIndicator.top}px, 0)`,
              }}
            />
            {categories.map((category) => (
              <button
                key={category}
                ref={(el) => {
                  if (el) tabButtonRefs.current.set(category, el);
                  else tabButtonRefs.current.delete(category);
                }}
                type="button"
                role="tab"
                aria-selected={
                  category === 'All' ? highlightedTrack === null : activeTabCategory === category
                }
                onClick={() => onSelectCategory(category)}
                className={styles['track-chip']}
              >
                <span>{category}</span>
                <span className={styles['track-count']}>{categoryCounts[category] ?? 0}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <fieldset aria-label="Reading status" className={styles['status-bar']}>
            <button
              type="button"
              aria-pressed={statusFilter === 'all'}
              onClick={() => onSelectStatus('all')}
              className={styles['status-chip']}
            >
              <span>Any status</span>
              <span className={styles['track-count']}>{statusCounts.all}</span>
            </button>
            {BOOK_STATUSES.map((status: BookStatus) => (
              <button
                key={status}
                type="button"
                aria-pressed={statusFilter === status}
                onClick={() => onSelectStatus(status)}
                className={styles['status-chip']}
              >
                <span
                  aria-hidden="true"
                  className={cn(styles['status-dot'], styles[`status-dot-${status}`])}
                />
                <span>{BOOK_STATUS_META[status].label}</span>
                <span className={styles['track-count']}>{statusCounts[status]}</span>
              </button>
            ))}
          </fieldset>

          {highlightedTrack && highlightedShelfSlug && (
            <Link
              href={`/bookshelf/shelf/${highlightedShelfSlug}`}
              prefetch={false}
              className="inline-flex items-center gap-1 tile-meta text-brand-ink no-underline underline-offset-4 hover:text-foreground hover:underline"
            >
              Open {highlightedTrack} shelf
              <FiArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      {matchingFilterCount === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline bg-surface-1 px-4 py-2.5 tile-meta text-muted-foreground">
          <span>
            No books match this filter yet — update a book&apos;s reading status in Sanity Studio.
          </span>
          <button
            type="button"
            onClick={onResetFilters}
            className="text-brand-ink underline-offset-4 hover:text-foreground hover:underline"
          >
            Show all books
          </button>
        </div>
      )}
    </>
  );
}
