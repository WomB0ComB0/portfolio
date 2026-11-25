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
import { type ReactElement, useEffect, useMemo, useRef } from 'react';
import { FiArrowUpRight, FiX } from 'react-icons/fi';
import { cn } from '@/lib/utils';
import { BOOKS, type BookItem, DEFAULT_SHELVES, type ShelfCollection } from '../_lib/books';
import { BookStatusBadge } from './book-status-badge';

export interface ReadingMapDialogProps {
  readonly open: boolean;
  readonly activeSlug?: string;
  readonly books?: readonly BookItem[];
  readonly shelves?: readonly ShelfCollection[];
  readonly onClose: () => void;
  /** Optional handler to focus a book on the 3D shelf before closing. */
  readonly onSelectBook?: (book: BookItem) => void;
  /** Optional handler to open a book's detail view directly. */
  readonly onOpenBook?: (book: BookItem) => void;
}

const formatTopicNumber = (num: number): string => String(num).padStart(3, '0');

/**
 * Full-curriculum Reading Map modal showing all shelves/tracks, stages, and numbered topics.
 */
export function ReadingMapDialog({
  open,
  activeSlug,
  books = BOOKS,
  shelves = DEFAULT_SHELVES,
  onClose,
  onSelectBook,
  onOpenBook,
}: ReadingMapDialogProps): ReactElement | null {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const bySlug = useMemo(() => new Map(books.map((book) => [book.slug, book])), [books]);
  const totalTopics = useMemo(
    () => books.reduce((sum, book) => sum + book.topics.length, 0),
    [books],
  );

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close reading map backdrop"
        onClick={onClose}
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-canvas/80 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reading-map-heading"
        className="relative z-10 flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-tile border border-hairline bg-surface-1 shadow-raised"
      >
        <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6">
          <div className="min-w-0 space-y-1">
            <p className="label-mono text-faint">Engineering curriculum</p>
            <h2 id="reading-map-heading" className="text-title font-semibold text-foreground">
              Reading map
            </h2>
            <p className="text-body-sm text-muted-foreground">
              {books.length} books across {shelves.length}{' '}
              {shelves.length === 1 ? 'shelf' : 'shelves'}, covering {totalTopics} numbered topics.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close reading map"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
          >
            <FiX className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 sm:px-6">
          {shelves.map((shelf) => {
            const shelfBooks = shelf.bookSlugs
              .map((slug) => bySlug.get(slug))
              .filter((book): book is BookItem => Boolean(book));
            if (shelfBooks.length === 0) return null;

            const firstTopic = shelfBooks[0]?.topics[0]?.number;
            const lastBook = shelfBooks.at(-1);
            const lastTopic = lastBook?.topics.at(-1)?.number;

            return (
              <section key={shelf.slug} className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2 pb-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-body font-semibold text-foreground">{shelf.title}</h3>
                    <Link
                      href={`/bookshelf/shelf/${shelf.slug}`}
                      prefetch={false}
                      onClick={onClose}
                      className="inline-flex items-center gap-1 tile-meta text-brand-ink no-underline hover:text-foreground"
                    >
                      Open shelf
                      <FiArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                  <span className="font-mono text-meta tabular-nums text-faint">
                    {shelfBooks.filter((b) => b.status === 'completed').length}/{shelfBooks.length}{' '}
                    read
                    {firstTopic !== undefined && lastTopic !== undefined
                      ? ` · topics ${formatTopicNumber(firstTopic)}–${formatTopicNumber(lastTopic)}`
                      : ''}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {shelfBooks.map((book) => {
                    const isActive = book.slug === activeSlug;
                    return (
                      <div
                        key={book.slug}
                        className={cn(
                          'flex flex-col justify-between gap-3 rounded-lg border p-4 transition-colors',
                          isActive
                            ? 'border-brand-rim bg-brand-subtle/45'
                            : 'border-hairline bg-canvas/65 hover:border-hairline-strong hover:bg-canvas/90',
                        )}
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-2 font-mono text-label tabular-nums text-brand-ink">
                              <span
                                aria-hidden="true"
                                className="inline-block h-2.5 w-2.5 rounded-xs"
                                style={{ backgroundColor: book.spine.capBg }}
                              />
                              Stage {book.stageLabel}
                            </span>
                            <div className="inline-flex items-center gap-2">
                              <BookStatusBadge status={book.status} />
                              <span className="font-mono text-label tabular-nums text-faint">
                                {book.topics.length} topics
                              </span>
                            </div>
                          </div>
                          <h4 className="text-body-sm font-semibold text-foreground">
                            {book.title}
                          </h4>
                          <p className="text-meta text-muted-foreground">{book.authors}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {onSelectBook && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectBook(book);
                                onClose();
                              }}
                              className="inline-flex min-h-9 items-center rounded-md bg-surface-1 px-2.5 text-label text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                            >
                              Focus on shelf
                            </button>
                          )}
                          {onOpenBook ? (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenBook(book);
                                onClose();
                              }}
                              className="inline-flex min-h-9 items-center gap-1 rounded-md bg-brand-subtle px-2.5 text-label font-medium text-brand-ink transition-colors hover:bg-brand/25 hover:text-foreground"
                            >
                              Open stage
                              <FiArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          ) : (
                            <Link
                              href={`/bookshelf/${book.slug}`}
                              prefetch={false}
                              onClick={onClose}
                              className="inline-flex min-h-9 items-center gap-1 rounded-md bg-brand-subtle px-2.5 text-label font-medium text-brand-ink no-underline transition-colors hover:bg-brand/25 hover:text-foreground"
                            >
                              Open stage
                              <FiArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
