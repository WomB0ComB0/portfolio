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
import { type CSSProperties, type ReactElement, useState } from 'react';
import { FiArrowUpRight, FiCheck } from 'react-icons/fi';
import { cn } from '@/lib/utils';
import {
  BOOK_STATUS_META,
  BOOK_STATUSES,
  type BookItem,
  type BookStatus,
  type BookStatusFilter,
  type ShelfCollection,
} from '../_lib/books';
import { BookStatusBadge } from './book-status-badge';
import styles from './bookshelf.module.css';

export interface ShelfCardsGridProps {
  readonly shelves: readonly ShelfCollection[];
  readonly books: readonly BookItem[];
  /** Currently highlighted section title on the unified shelf, if any. */
  readonly highlightedSection?: string | null;
  /** Active reading status filter on the unified shelf. */
  readonly activeStatus?: BookStatusFilter;
  /** Controlled grouping mode synced to the URL via `nuqs` (`?group=topic|status`). */
  readonly groupBy?: GroupingMode;
  /** Called when the user switches between topic shelves and reading-status stacks. */
  readonly onGroupByChange?: (mode: GroupingMode) => void;
  /** Called when a user selects a reading status card in "By status" mode. */
  readonly onSelectStatus?: (status: BookStatus) => void;
}

type GroupingMode = 'topic' | 'status';

const MAX_FAN_COVERS = 5;

function FanCoverStack({ books }: { readonly books: readonly BookItem[] }): ReactElement {
  const previewBooks = books.slice(0, MAX_FAN_COVERS);
  const centerIndex = Math.floor(previewBooks.length / 2);

  if (previewBooks.length === 0) {
    return (
      <div className={styles['fan-stage']} aria-hidden="true">
        <div className="flex h-32 w-24 items-center justify-center rounded-sm border border-dashed border-hairline bg-surface-2 px-2 text-center font-mono text-[11px] text-faint">
          Empty
        </div>
      </div>
    );
  }

  return (
    <div className={styles['fan-stage']} aria-hidden="true">
      {previewBooks.map((book, idx) => {
        const delta = idx - centerIndex;
        const dist = Math.abs(delta);
        return (
          <div
            key={book.slug}
            className={styles['fan-card']}
            style={
              {
                '--fan-rot': `${delta * 5.5}deg`,
                '--fan-rot-hover': `${delta * 9.5}deg`,
                '--fan-x': `${delta * 20}px`,
                '--fan-x-hover': `${delta * 30}px`,
                '--fan-y': `${dist * 4}px`,
                '--fan-scale': `${(1 - dist * 0.06).toFixed(2)}`,
                zIndex: MAX_FAN_COVERS - dist,
              } as CSSProperties
            }
          >
            {/* biome-ignore lint/performance/noImgElement: Local or CDN cover asset served directly without Next optimizer. */}
            <img
              src={book.coverSrc}
              alt=""
              width={260}
              height={340}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="h-full w-full object-cover"
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * `seathru.app`-inspired fanned cover-stack collection cards with smooth translucent borders.
 * Supports grouping by topic shelf (`/bookshelf/shelf/[shelfSlug]`) or by reading status
 * (`Read`, `Reading`, `Unread`).
 */
export function ShelfCardsGrid({
  shelves,
  books,
  highlightedSection,
  activeStatus = 'all',
  groupBy: controlledGroupBy,
  onGroupByChange,
  onSelectStatus,
}: ShelfCardsGridProps): ReactElement {
  const [uncontrolledGroupBy, setUncontrolledGroupBy] = useState<GroupingMode>('topic');
  const groupBy = controlledGroupBy ?? uncontrolledGroupBy;
  const setGroupBy = (next: GroupingMode): void => {
    if (onGroupByChange) {
      onGroupByChange(next);
    } else {
      setUncontrolledGroupBy(next);
    }
  };
  const bySlug = new Map(books.map((book) => [book.slug, book]));

  return (
    <section aria-labelledby="shelves-heading" className="space-y-4 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 id="shelves-heading" className="tile-title text-foreground">
            Shelves
          </h2>
          <p className="tile-sub text-muted-foreground">
            {groupBy === 'topic'
              ? 'Curated collections separated by topic. Open any shelf for a focused 3D view.'
              : 'Grouped by reading progress. Select any stack to spotlight those books on the shelf.'}
          </p>
        </div>

        <fieldset className={styles['status-bar']} aria-label="Group shelves">
          <button
            type="button"
            aria-pressed={groupBy === 'topic'}
            onClick={() => setGroupBy('topic')}
            className={styles['status-chip']}
          >
            By topic
          </button>
          <button
            type="button"
            aria-pressed={groupBy === 'status'}
            onClick={() => setGroupBy('status')}
            className={styles['status-chip']}
          >
            By reading status
          </button>
        </fieldset>
      </div>

      {groupBy === 'topic' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {shelves.map((shelf) => {
            const shelfBooks = shelf.bookSlugs
              .map((slug) => bySlug.get(slug))
              .filter((book): book is BookItem => Boolean(book));
            const readCount = shelfBooks.filter((book) => book.status === 'completed').length;
            const readPct =
              shelfBooks.length > 0 ? Math.round((readCount / shelfBooks.length) * 100) : 0;
            const allRead = shelfBooks.length > 0 && readCount === shelfBooks.length;
            const isHighlighted = highlightedSection === shelf.title;

            return (
              <Link
                key={shelf.slug}
                href={`/bookshelf/shelf/${shelf.slug}`}
                prefetch={false}
                className={cn(
                  styles['shelf-card'],
                  isHighlighted && styles['shelf-card-active'],
                  'group flex flex-col justify-between gap-4 rounded-tile p-5 no-underline focus-visible:outline-2 focus-visible:outline-focus',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 tile-meta text-muted-foreground">
                    <span
                      aria-hidden="true"
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: shelf.accentColor }}
                    />
                    {shelf.title}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 tile-meta tabular-nums',
                      allRead ? 'text-[var(--live)]' : 'text-faint',
                    )}
                  >
                    {allRead && <FiCheck className="size-3 stroke-[2.75]" aria-hidden="true" />}
                    {readCount}/{shelfBooks.length} read
                  </span>
                </div>

                <FanCoverStack books={shelfBooks} />

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="tile-title text-foreground">{shelf.title}</span>
                    <FiArrowUpRight
                      className="size-4 text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-ink"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="line-clamp-2 tile-meta text-muted-foreground">
                    {shelf.description}
                  </p>
                  <div
                    aria-hidden="true"
                    className="h-[3px] w-full overflow-hidden rounded-full bg-surface-3"
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${readPct}%`,
                        backgroundColor: shelf.accentColor,
                      }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {BOOK_STATUSES.map((status) => {
            const meta = BOOK_STATUS_META[status];
            const bucketBooks = books.filter((book) => book.status === status);
            const isActive = activeStatus === status;

            return (
              <button
                key={status}
                type="button"
                onClick={() => onSelectStatus?.(status)}
                className={cn(
                  styles['shelf-card'],
                  isActive && styles['shelf-card-active'],
                  'group flex flex-col justify-between gap-4 rounded-tile p-5 text-left focus-visible:outline-2 focus-visible:outline-focus',
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <BookStatusBadge status={status} />
                  <span className="tile-meta tabular-nums text-faint">
                    {bucketBooks.length} {bucketBooks.length === 1 ? 'book' : 'books'}
                  </span>
                </div>

                <FanCoverStack books={bucketBooks} />

                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="tile-title text-foreground">{meta.label}</span>
                    <FiArrowUpRight
                      className="size-4 text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-ink"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="line-clamp-2 tile-meta text-muted-foreground">{meta.description}</p>
                  <div
                    aria-hidden="true"
                    className="h-[2px] w-10 rounded-full opacity-75 transition-all duration-300 group-hover:w-16 group-hover:opacity-100"
                    style={{ backgroundColor: meta.accentColor }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
