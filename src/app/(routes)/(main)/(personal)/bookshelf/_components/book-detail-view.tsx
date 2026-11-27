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
 * @file A book's detail inside PageShell: its summary, authors and ISBN links, numbered topics,
 * Previous and Next books and its cover, with the reading map. The stage (bookshelf-stage.tsx)
 * renders it in place while a book is open there, at the book's own address (/bookshelf/<slug>),
 * and [slug]/page.tsx renders it as its own island at that address. Previous and Next link to
 * their books' pages either way: in place a plain click opens the book there (book-link.tsx), on
 * a book's page it is a client navigation. In place, focus moves to its heading when it opens and
 * when the map's Open stage brings another book here; Previous and Next keep focus where it is.
 * Guarded by tests/unit/bookshelf/book-detail-view.test.tsx, reading-map-dialog.test.tsx and
 * scale-budgets.test.ts, and kept free of server modules by island-imports.test.ts.
 */

import Link from 'next/link';
import { type CSSProperties, type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { FiArrowLeft, FiArrowRight, FiArrowUpRight, FiMap } from 'react-icons/fi';
import { PageShell } from '@/components/console/page-shell';
import { LinkHealthBadge } from '@/components/link-health/link-health-badge';
import { cn } from '@/lib/utils';
import { bookPath } from '../_lib/book-address';
import { formatTopicNumber } from '../_lib/book-labels';
import type { BookNeighbor } from '../_lib/book-neighbors';
import { type BookItem, getIsbnRegistryLinks, type ShelfCollection } from '../_lib/books';
import type { ReadingMapEntry } from '../_lib/reading-map';
import { BookCoverFrame } from './book-cover-frame';
import styles from './book-detail-view.module.css';
import { BookLink } from './book-link';
import { BookStatusBadge } from './book-status-badge';
import { headerActionClass } from './bookshelf-classes';
import { preloadReadingMap, ReadingMapDialog } from './reading-map-dialog';

export interface BookDetailViewProps {
  readonly book: BookItem;
  /**
   * The books before and after `book` in stage order, wrapping round both ends, as the Previous
   * and Next links name them. With one book on the shelf both are `book`, and there are no links.
   */
  readonly prev: BookNeighbor;
  readonly next: BookNeighbor;
  /** The reading map's books in stage order (`book` among them): slim entries, never whole books. */
  readonly mapBooks: readonly ReadingMapEntry[];
  /** The shelves to map them under, in shelf order. */
  readonly shelves: readonly ShelfCollection[];
  /** Provided when rendered in-page from `/bookshelf` so Back returns smoothly without reloading. */
  readonly onBack?: () => void;
  /** Provided when stepping between stages inside `/bookshelf`: opens the book with this slug. */
  readonly onNavigateBook?: (slug: string) => void;
  /** Plays the staggered top-to-bottom wipe reveal when opened from the 3D shelf. */
  readonly entering?: boolean;
  /**
   * Moves focus to the heading when the detail first shows. The stage sets it: whatever opened the
   * book (the stage itself, its Open notes button, the reading map) is gone once the detail takes
   * its place, and focus would fall back to the start of the page.
   */
  readonly focusOnOpen?: boolean;
}

/**
 * Focuses the detail's heading: PageShell's one h1, in the header that also holds `action` (the
 * Reading map button), made focusable by script only. It never scrolls: opening a book in place
 * already scrolls to the top.
 */
function focusHeading(action: HTMLElement | null): void {
  const heading = action?.closest('header')?.querySelector<HTMLElement>('h1');
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

/** A Previous or Next card: Previous reads from the left, Next from the right. */
const NEIGHBOR_CLASS =
  'group flex flex-col gap-1 rounded-tile bg-surface-1 p-4 no-underline transition-colors hover:bg-surface-2';

interface NeighborLinkProps {
  readonly neighbor: BookNeighbor;
  readonly direction: 'prev' | 'next';
  /** In place: opens the neighbour on the stage on a plain click, instead of following the link. */
  readonly onNavigateBook?: (slug: string) => void;
}

/** A Previous or Next card, linking to the neighbour's own page. */
function NeighborLink({ neighbor, direction, onNavigateBook }: NeighborLinkProps): ReactElement {
  const isNext = direction === 'next';
  const className = cn(NEIGHBOR_CLASS, isNext ? 'items-end text-right' : 'items-start');
  const content = (
    <>
      <span className="inline-flex items-center gap-1.5 tile-meta tabular-nums text-faint group-hover:text-brand-ink">
        {!isNext && <FiArrowLeft className="size-3.5" aria-hidden="true" />}
        Stage {neighbor.stageLabel} · {neighbor.track}
        {isNext && <FiArrowRight className="size-3.5" aria-hidden="true" />}
      </span>
      <span className="tile-sub font-medium text-foreground">{neighbor.title}</span>
    </>
  );

  return onNavigateBook ? (
    <BookLink
      slug={neighbor.slug}
      onOpen={() => onNavigateBook(neighbor.slug)}
      className={className}
    >
      {content}
    </BookLink>
  ) : (
    <Link href={bookPath(neighbor.slug)} prefetch={false} className={className}>
      {content}
    </Link>
  );
}

/**
 * One book's detail, in PageShell like every page: in-page on `/bookshelf` (with onBack and
 * onNavigateBook, so nothing reloads) or on its own `/bookshelf/[slug]` route (with links).
 */
export function BookDetailView({
  book,
  prev,
  next,
  mapBooks,
  shelves,
  onBack,
  onNavigateBook,
  entering = false,
  focusOnOpen = false,
}: BookDetailViewProps): ReactElement {
  const [mapOpen, setMapOpen] = useState(false);
  const mapButtonRef = useRef<HTMLButtonElement>(null);
  // The heading takes focus once this render is on screen: on the first, when the detail opens in
  // place, and after the map's Open stage brings a book here. Previous and Next keep their focus.
  const [headingFocusPending, setHeadingFocusPending] = useState(focusOnOpen);
  useEffect(() => {
    if (!headingFocusPending) return;
    setHeadingFocusPending(false);
    focusHeading(mapButtonRef.current);
  }, [headingFocusPending]);
  const hasNeighbors = prev.slug !== book.slug;

  const topicRows = Math.max(1, Math.ceil(book.topics.length / 2));
  const isbnLinks = useMemo(() => getIsbnRegistryLinks(book.isbn), [book.isbn]);
  // Publisher and year read "Publisher (2020)", or whichever of the two Studio has.
  const imprint =
    book.publisher && book.year !== undefined
      ? `${book.publisher} (${book.year})`
      : (book.publisher ?? (book.year === undefined ? undefined : String(book.year)));
  const hasLinks = Boolean(book.url) || isbnLinks !== null;

  const backAction = onBack ? (
    <button type="button" onClick={onBack} className={headerActionClass('wide', false)}>
      <FiArrowLeft className="size-4" aria-hidden="true" />
      Back to Bookshelf
    </button>
  ) : (
    <Link
      href={`/bookshelf?book=${book.slug}`}
      prefetch={false}
      className={headerActionClass('wide', true)}
    >
      <FiArrowLeft className="size-4" aria-hidden="true" />
      Back to Bookshelf
    </Link>
  );

  return (
    <PageShell
      sizing="container"
      className={cn('pb-12', styles['detail-panel'], entering && styles['detail-entering'])}
      eyebrow={
        <span className="inline-flex flex-wrap items-center gap-2 tabular-nums">
          <span>Stage {book.stageLabel}</span>
          <span aria-hidden="true" className="text-faint">
            ·
          </span>
          <span>{book.track}</span>
          {book.edition && (
            <>
              <span aria-hidden="true" className="text-faint">
                ·
              </span>
              <span className="text-faint">{book.edition}</span>
            </>
          )}
          <BookStatusBadge status={book.status} data-book-status={book.status} />
        </span>
      }
      title={book.title}
      description={book.summary}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {backAction}
          <button
            ref={mapButtonRef}
            type="button"
            onClick={() => setMapOpen(true)}
            onPointerEnter={preloadReadingMap}
            onFocus={preloadReadingMap}
            className={headerActionClass('tight', false)}
          >
            <FiMap className="size-3.5" aria-hidden="true" />
            Reading map
          </button>
        </div>
      }
    >
      <div className={styles['detail-grid']}>
        <div className="min-w-0 space-y-8">
          <p
            className={cn('tile-meta text-faint', styles.rv)}
            style={{ '--d': '80ms' } as CSSProperties}
          >
            {book.authors}
            {imprint && ` · ${imprint}`}
            {book.isbn && (
              <>
                {' · '}
                {isbnLinks ? (
                  <a
                    href={isbnLinks.openLibrary}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tabular-nums text-muted-foreground underline-offset-4 hover:text-brand-ink hover:underline"
                  >
                    ISBN {book.isbn}
                  </a>
                ) : (
                  <span>ISBN {book.isbn}</span>
                )}
              </>
            )}
          </p>

          {book.topics.length > 0 && (
            <section
              aria-label="Core topics"
              className={styles.rv}
              style={{ '--d': '140ms' } as CSSProperties}
            >
              <ol
                className={styles['detail-topics']}
                style={{ '--topic-rows': String(topicRows) } as CSSProperties}
              >
                {book.topics.map((topic) => (
                  <li key={topic.number}>
                    <span className={styles['detail-topic-num']}>
                      {formatTopicNumber(topic.number)}
                    </span>
                    <span>{topic.title}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {hasLinks && (
            <div
              className={cn('flex flex-wrap items-center gap-x-5 gap-y-2', styles.rv)}
              style={{ '--d': '220ms' } as CSSProperties}
            >
              {book.url && (
                <>
                  <a
                    href={book.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 tile-label text-brand-ink underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Explore {book.spineTitle}
                    <FiArrowUpRight className="size-4" aria-hidden="true" />
                  </a>
                  <LinkHealthBadge href={book.url} scope="bookshelf" />
                </>
              )}
              {isbnLinks && (
                <>
                  <a
                    href={isbnLinks.openLibrary}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 tile-meta text-muted-foreground no-underline underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Open Library
                    <FiArrowUpRight className="size-3.5" aria-hidden="true" />
                  </a>
                  <a
                    href={isbnLinks.worldCat}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 tile-meta text-muted-foreground no-underline underline-offset-4 hover:text-foreground hover:underline"
                  >
                    WorldCat
                    <FiArrowUpRight className="size-3.5" aria-hidden="true" />
                  </a>
                  <a
                    href={isbnLinks.isbnSearch}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 tile-meta text-muted-foreground no-underline underline-offset-4 hover:text-foreground hover:underline"
                  >
                    ISBN Search
                    <FiArrowUpRight className="size-3.5" aria-hidden="true" />
                  </a>
                </>
              )}
            </div>
          )}

          {hasNeighbors && (
            <nav aria-label="Adjacent books" className="grid gap-3 pt-2 sm:grid-cols-2">
              <NeighborLink neighbor={prev} direction="prev" onNavigateBook={onNavigateBook} />
              <NeighborLink neighbor={next} direction="next" onNavigateBook={onNavigateBook} />
            </nav>
          )}
        </div>

        <div
          className={cn(styles['detail-cover-slot'], 'lg:sticky lg:top-20', styles.rv)}
          style={{ '--d': '120ms', '--rd': '640ms' } as CSSProperties}
        >
          <BookCoverFrame book={book} priority />
        </div>
      </div>

      <ReadingMapDialog
        open={mapOpen}
        activeSlug={book.slug}
        books={mapBooks}
        shelves={shelves}
        onClose={() => setMapOpen(false)}
        returnFocus={mapButtonRef}
        onOpenBook={
          onNavigateBook &&
          ((entry) => {
            onNavigateBook(entry.slug);
            setHeadingFocusPending(true);
          })
        }
      />
    </PageShell>
  );
}
