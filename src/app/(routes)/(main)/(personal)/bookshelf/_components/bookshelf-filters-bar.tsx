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
import {
  type CSSProperties,
  type ReactElement,
  type RefObject,
  useLayoutEffect,
  useRef,
} from 'react';
import { FiArrowUpRight } from 'react-icons/fi';
import { cn } from '@/lib/utils';
import { BOOK_STATUS_META, BOOK_STATUSES, type BookStatus } from '../_lib/books';
import type { BookStatusFilter, ShelfTab } from '../_lib/bookshelf-filters';
import styles from './bookshelf-filters-bar.module.css';
import type { ShelfPillClip, ShelfPillState } from './use-shelf-pill';

/** The custom properties the pill's clip-path reads; none before it is measured. */
function pillStyle(clip: ShelfPillClip | null): CSSProperties | undefined {
  if (!clip) return undefined;
  return {
    '--pill-track': `${clip.track}px`,
    '--pill-t': `${clip.top}px`,
    '--pill-r': `${clip.right}px`,
    '--pill-b': `${clip.bottom}px`,
    '--pill-l': `${clip.left}px`,
  } as CSSProperties;
}

/** Which ends of a sideways scroller have content past them, or null when it all shows. */
function overflowEdges(scroller: HTMLElement): 'start' | 'end' | 'both' | null {
  const hidden = scroller.scrollWidth - scroller.clientWidth;
  if (hidden <= 1) return null;
  const before = scroller.scrollLeft > 1;
  const after = scroller.scrollLeft < hidden - 1;
  if (before && after) return 'both';
  return before ? 'start' : 'end';
}

/**
 * Keeps data-overflow on the chip row naming the ends with chips past them, so the row fades
 * there: the cue that it scrolls (it has no scrollbar). Re-measured on a scroll and a resize of
 * the row; `chipSet` names the chips, so a new set is measured afresh.
 */
function useOverflowCue(bar: RefObject<HTMLDivElement | null>, chipSet: string): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: `chipSet` is the trigger: new chips change the row's scroll width, and the effect reads it from the DOM.
  useLayoutEffect(() => {
    const element = bar.current;
    if (!element) return;
    const mark = (): void => {
      const edges = overflowEdges(element);
      if (edges) element.dataset.overflow = edges;
      else delete element.dataset.overflow;
    };
    mark();
    element.addEventListener('scroll', mark, { passive: true });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(mark) : null;
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', mark);
      observer?.disconnect();
    };
  }, [bar, chipSet]);
}

export interface BookshelfFiltersBarProps {
  readonly showShelves: boolean;
  /** One chip per shelf on the stage, keyed by slug, in stage order. */
  readonly shelfTabs: readonly ShelfTab[];
  /** The "All" chip's count: every book on the stage. */
  readonly allCount: number;
  /** The shelf the filter names, or null when it names none ("All"). */
  readonly activeShelf: ShelfTab | null;
  /** The chip the pill marks: the filtered shelf, else the shelf of the book on stage. */
  readonly locationShelfSlug: string;
  readonly shelfPill: ShelfPillState;
  /** Each shelf chip by its slug, for the stage to measure the pill from. */
  readonly chipRefs: RefObject<Map<string, HTMLButtonElement>>;
  /** A shelf's slug, or null for "All" (the reset). */
  readonly onSelectShelf: (slug: string | null) => void;
  readonly statusFilter: BookStatusFilter;
  readonly statusCounts: Readonly<Record<BookStatusFilter, number>>;
  readonly onSelectStatus: (status: BookStatusFilter) => void;
  readonly matchingFilterCount: number;
  readonly onResetFilters: () => void;
}

/**
 * Shelf filter chips, reading-status chips, the shelf shortcut and the empty-match banner. The
 * shelf chips are toggle buttons in a labelled group: "All" (the reset) or one shelf is pressed,
 * never two. The aria-hidden pill marks where the stage is (data-current): the filtered shelf,
 * else the shelf of the book on stage. Below 48rem the chips keep to one row that scrolls
 * sideways, fading over each end with chips past it.
 */
export function BookshelfFiltersBar({
  showShelves,
  shelfTabs,
  allCount,
  activeShelf,
  locationShelfSlug,
  shelfPill,
  chipRefs,
  onSelectShelf,
  statusFilter,
  statusCounts,
  onSelectStatus,
  matchingFilterCount,
  onResetFilters,
}: BookshelfFiltersBarProps): ReactElement {
  const barRef = useRef<HTMLDivElement>(null);
  useOverflowCue(barRef, shelfTabs.map((tab) => tab.slug).join(' '));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {showShelves && (
          // biome-ignore lint/a11y/useSemanticElements: Below 48rem the chip row is a sideways scroller, which a fieldset does not reliably become in every browser.
          <div ref={barRef} role="group" aria-label="Shelves" className={styles['track-bar']}>
            <span
              aria-hidden="true"
              className={cn(styles['track-pill'], !shelfPill.animate && styles['no-anim'])}
              style={pillStyle(shelfPill.clip)}
            />
            <button
              type="button"
              aria-pressed={activeShelf === null}
              onClick={() => onSelectShelf(null)}
              className={styles['track-chip']}
            >
              <span>All</span>
              <span className={styles['track-count']}>{allCount}</span>
            </button>
            {shelfTabs.map((tab) => (
              <button
                key={tab.slug}
                ref={(el) => {
                  if (el) chipRefs.current.set(tab.slug, el);
                  else chipRefs.current.delete(tab.slug);
                }}
                type="button"
                aria-pressed={activeShelf?.slug === tab.slug}
                data-current={locationShelfSlug === tab.slug ? 'true' : undefined}
                onClick={() => onSelectShelf(tab.slug)}
                className={styles['track-chip']}
              >
                <span>{tab.title}</span>
                <span className={styles['track-count']}>{tab.count}</span>
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

          {activeShelf && (
            <Link
              href={`/bookshelf/shelf/${activeShelf.slug}`}
              prefetch={false}
              className="inline-flex items-center gap-1 tile-meta text-brand-ink no-underline underline-offset-4 hover:text-foreground hover:underline"
            >
              Open {activeShelf.title} shelf
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
