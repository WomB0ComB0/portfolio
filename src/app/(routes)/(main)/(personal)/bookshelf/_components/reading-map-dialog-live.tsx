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
 * @file The open reading map: every shelf's books in stage order with their topics, on the site's
 * Radix dialog (src/components/ui/dialog.tsx). Focus starts on Close and is trapped, the page
 * behind is hidden from assistive technology and holds still, Escape or a click outside closes
 * it, and focus goes back to the button that opened it, except after Open stage: the book's
 * detail it opens takes focus on its heading. Each Open stage links to its book's own page; on
 * the stage or an in-place detail a plain click opens the book there instead (book-link.tsx).
 * reading-map-dialog.tsx fetches this module only when a visitor asks for the map. Guarded by
 * tests/unit/bookshelf/reading-map-dialog.test.tsx and scale-budgets.test.ts.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import Link from 'next/link';
import { type ReactElement, type RefObject, useMemo, useRef } from 'react';
import { FiArrowUpRight, FiX } from 'react-icons/fi';
import { countOf } from '@/components/console/folio/byline-items';
import { Dialog, DialogClose, DialogDescription, DialogPortal } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { bookPath } from '../_lib/book-address';
import {
  BOOK_NOUN,
  formatTopicNumber,
  NUMBERED_TOPIC_NOUN,
  SHELF_NOUN,
  TOPIC_NOUN,
} from '../_lib/book-labels';
import type { ShelfCollection } from '../_lib/books';
import { lastTopicOf, type ReadingMapEntry } from '../_lib/reading-map';
import { BookLink } from './book-link';
import { BookStatusBadge } from './book-status-badge';

/** The canvas behind the map, dimmed by opacity: the overlay the media player's dialog uses. */
const OVERLAY_CLASS =
  'fixed inset-0 z-50 bg-canvas opacity-90 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-(--motion-base) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-(--motion-fast) ease-effect';
/** Centres the panel in the window, a gutter from each edge; clicks through it land outside. */
const FRAME_CLASS =
  'pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6';
const PANEL_CLASS =
  'pointer-events-auto relative flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-tile border border-hairline bg-surface-1 shadow-raised focus:outline-none';
/** An entry's Open stage link, in place (BookLink) or on a book's page (next/link). */
const OPEN_STAGE_CLASS =
  'inline-flex min-h-9 items-center gap-1 rounded-md border border-brand-edge bg-brand-subtle px-2.5 text-label font-medium text-brand-ink no-underline transition-colors hover:border-brand-rim hover:text-foreground';
const CLOSE_CLASS =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus';

export interface ReadingMapDialogLiveProps {
  readonly activeSlug?: string;
  /** The books to map, in stage order, as slim entries (toReadingMapEntry). */
  readonly books: readonly ReadingMapEntry[];
  /** The shelves to map them under, in shelf order; a shelf with none of `books` is skipped. */
  readonly shelves: readonly ShelfCollection[];
  readonly onClose: () => void;
  /** The button that opened the map: focus goes back to it on close, except after Open stage. */
  readonly returnFocus: RefObject<HTMLElement | null>;
  /** Optional handler to focus a book on the 3D shelf before closing. */
  readonly onSelectBook?: (entry: ReadingMapEntry) => void;
  /** Optional handler to open a book's detail view directly; that detail takes focus. */
  readonly onOpenBook?: (entry: ReadingMapEntry) => void;
}

/**
 * Full-curriculum Reading Map modal showing all shelves/tracks, stages, and numbered topics.
 *
 * Every book is drawn, so the browser skips rendering a shelf section until it nears the
 * viewport (content-visibility: auto, sized at 900px until first drawn): opening the map at 300
 * books on a throttled phone measured 216-230 ms of style, layout and paint before, 96 ms after.
 * Skipped sections stay in the accessibility tree, and their buttons stay focusable.
 */
export function ReadingMapDialogLive({
  activeSlug,
  books,
  shelves,
  onClose,
  returnFocus,
  onSelectBook,
  onOpenBook,
}: ReadingMapDialogLiveProps): ReactElement {
  // Set by Open stage: the detail it opens takes focus, so closing gives none back to the button.
  const openedBookRef = useRef(false);
  const bySlug = useMemo(() => new Map(books.map((book) => [book.slug, book])), [books]);
  const totalTopics = useMemo(() => books.reduce((sum, book) => sum + book.topicCount, 0), [books]);
  // "18 books across 3 shelves, covering 72 numbered topics.", each noun singular for one.
  const summary = [
    countOf(books.length, BOOK_NOUN),
    'across',
    `${countOf(shelves.length, SHELF_NOUN)},`,
    'covering',
    `${countOf(totalTopics, NUMBERED_TOPIC_NOUN)}.`,
  ].join(' ');

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogPrimitive.Overlay className={OVERLAY_CLASS} />
        <div className={FRAME_CLASS}>
          <DialogPrimitive.Content
            aria-modal="true"
            className={PANEL_CLASS}
            onCloseAutoFocus={(event) => {
              // The opener is no Dialog.Trigger, so Radix can't find it: give focus back by ref,
              // unless Open stage closed the map, when the opened book's detail has taken it.
              event.preventDefault();
              if (openedBookRef.current) return;
              if (returnFocus.current?.isConnected) {
                returnFocus.current.focus({ preventScroll: true });
              }
            }}
          >
            <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6">
              <div className="min-w-0 space-y-1">
                <p className="label-mono text-faint">Reading curriculum</p>
                {/* The primitive: the site's DialogTitle adds tracking that would undo the heading's own. */}
                <DialogPrimitive.Title className="text-title font-semibold text-foreground">
                  Reading map
                </DialogPrimitive.Title>
                <DialogDescription className="text-body-sm text-muted-foreground">
                  {summary}
                </DialogDescription>
              </div>
              <DialogClose aria-label="Close reading map" className={CLOSE_CLASS}>
                <FiX className="h-4 w-4" aria-hidden="true" />
              </DialogClose>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 sm:px-6">
              {shelves.map((shelf) => {
                const shelfBooks = shelf.bookSlugs
                  .map((slug) => bySlug.get(slug))
                  .filter((book): book is ReadingMapEntry => Boolean(book));
                if (shelfBooks.length === 0) return null;

                const firstTopic = shelfBooks[0]?.firstTopic;
                const lastBook = shelfBooks.at(-1);
                const lastTopic = lastBook && lastTopicOf(lastBook);

                return (
                  <section
                    key={shelf.slug}
                    className="space-y-3 [contain-intrinsic-size:auto_900px] [content-visibility:auto]"
                  >
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
                        {shelfBooks.filter((b) => b.status === 'completed').length}/
                        {shelfBooks.length} read
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
                                ? 'border-brand-rim bg-brand-subtle'
                                : 'border-hairline bg-canvas hover:border-hairline-strong hover:bg-surface-2',
                            )}
                          >
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-2 font-mono text-label tabular-nums text-brand-ink">
                                  Stage {book.stageLabel}
                                </span>
                                <div className="inline-flex items-center gap-2">
                                  <BookStatusBadge status={book.status} />
                                  <span className="font-mono text-label tabular-nums text-faint">
                                    {countOf(book.topicCount, TOPIC_NOUN)}
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
                                <BookLink
                                  slug={book.slug}
                                  onOpen={() => {
                                    openedBookRef.current = true;
                                    onOpenBook(book);
                                    onClose();
                                  }}
                                  className={OPEN_STAGE_CLASS}
                                >
                                  Open stage
                                  <FiArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                                </BookLink>
                              ) : (
                                <Link
                                  href={bookPath(book.slug)}
                                  prefetch={false}
                                  onClick={onClose}
                                  className={OPEN_STAGE_CLASS}
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
          </DialogPrimitive.Content>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
