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
import type { CSSProperties, ReactElement } from 'react';
import { FiArrowUpRight } from 'react-icons/fi';
import { cn } from '@/lib/utils';
import type { BookItem, ShelfCollection } from '../_lib/books';
import styles from './bookshelf.module.css';

export interface ShelfCardsGridProps {
  readonly shelves: readonly ShelfCollection[];
  readonly books: readonly BookItem[];
  /** Currently highlighted section title on the unified shelf, if any. */
  readonly highlightedSection?: string | null;
}

const MAX_FAN_COVERS = 5;

/**
 * `seathru.app`-inspired fanned cover-stack collection cards, styled natively as Live Console
 * surface tiles. Clicking any shelf opens its focused 3D view at `/bookshelf/shelf/[shelfSlug]`.
 */
export function ShelfCardsGrid({
  shelves,
  books,
  highlightedSection,
}: ShelfCardsGridProps): ReactElement {
  const bySlug = new Map(books.map((book) => [book.slug, book]));

  return (
    <section aria-labelledby="shelves-heading" className="space-y-4 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="space-y-1">
          <h2 id="shelves-heading" className="tile-title text-foreground">
            Shelves
          </h2>
          <p className="tile-sub text-muted-foreground">
            Curated collections separated by topic. Open any shelf for a focused 3D view.
          </p>
        </div>
        <span className="tile-meta tabular-nums text-faint">
          {shelves.length} {shelves.length === 1 ? 'shelf' : 'shelves'}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {shelves.map((shelf) => {
          const shelfBooks = shelf.bookSlugs
            .map((slug) => bySlug.get(slug))
            .filter((book): book is BookItem => Boolean(book));
          const previewBooks = shelfBooks.slice(0, MAX_FAN_COVERS);
          const centerIndex = Math.floor(previewBooks.length / 2);
          const isHighlighted = highlightedSection === shelf.title;

          return (
            <Link
              key={shelf.slug}
              href={`/bookshelf/shelf/${shelf.slug}`}
              prefetch={false}
              className={cn(
                styles['shelf-card'],
                isHighlighted && styles['shelf-card-active'],
                'group flex flex-col justify-between gap-4 rounded-tile bg-surface-1 p-5 no-underline transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus',
              )}
            >
              {/* Top metadata */}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 tile-meta text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: shelf.accentColor }}
                  />
                  {shelf.title}
                </span>
                <span className="tile-meta tabular-nums text-faint">
                  {shelfBooks.length} {shelfBooks.length === 1 ? 'book' : 'books'}
                </span>
              </div>

              {/* Fanned cover stack */}
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

              {/* Bottom title + accent line */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="tile-title text-foreground">{shelf.title}</span>
                  <FiArrowUpRight
                    className="size-4 text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-ink"
                    aria-hidden="true"
                  />
                </div>
                <p className="line-clamp-2 tile-meta text-muted-foreground">{shelf.description}</p>
                <div
                  aria-hidden="true"
                  className="h-[2px] w-10 rounded-full opacity-75 transition-all duration-300 group-hover:w-16 group-hover:opacity-100"
                  style={{ backgroundColor: shelf.accentColor }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
