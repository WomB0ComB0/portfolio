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
import { type CSSProperties, type ReactElement, useMemo, useState } from 'react';
import { FiArrowLeft, FiArrowRight, FiArrowUpRight, FiMap } from 'react-icons/fi';
import { PageShell } from '@/components/console/page-shell';
import { cn } from '@/lib/utils';
import {
  BOOKS,
  type BookItem,
  DEFAULT_SHELVES,
  getIsbnRegistryLinks,
  type ShelfCollection,
} from '../_lib/books';
import { BookCoverFrame } from './book-cover-frame';
import { BookStatusBadge } from './book-status-badge';
import styles from './bookshelf.module.css';
import { ReadingMapDialog } from './reading-map-dialog';

export interface BookDetailViewProps {
  readonly book: BookItem;
  readonly books?: readonly BookItem[];
  readonly shelves?: readonly ShelfCollection[];
  /** Provided when rendered in-page from `/bookshelf` so Back returns smoothly without reloading. */
  readonly onBack?: () => void;
  /** Provided when stepping between adjacent stages inside `/bookshelf`. */
  readonly onNavigateBook?: (book: BookItem) => void;
  /** Plays the staggered top-to-bottom wipe reveal when opened from the 3D shelf. */
  readonly entering?: boolean;
}

/**
 * Live Console book detail view — rendered inside `<PageShell>` so the site navigation rail,
 * typography, and page rhythm stay 100% consistent (used both in-page from `/bookshelf` and on
 * the canonical `/bookshelf/[slug]` route).
 */
export function BookDetailView({
  book,
  books = BOOKS,
  shelves = DEFAULT_SHELVES,
  onBack,
  onNavigateBook,
  entering = false,
}: BookDetailViewProps): ReactElement {
  const [mapOpen, setMapOpen] = useState(false);

  const { prev, next } = useMemo(() => {
    const list = books.length > 0 ? books : BOOKS;
    const idx = Math.max(
      0,
      list.findIndex((item) => item.slug === book.slug),
    );
    const prevItem = list[(idx - 1 + list.length) % list.length] ?? book;
    const nextItem = list[(idx + 1) % list.length] ?? book;
    return { prev: prevItem, next: nextItem };
  }, [books, book]);

  const topicRows = Math.max(1, Math.ceil(book.topics.length / 2));
  const isbnLinks = useMemo(() => getIsbnRegistryLinks(book.isbn), [book.isbn]);

  const backAction = onBack ? (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-hairline bg-surface-1 px-3 tile-label text-muted-foreground transition-colors hover:border-hairline-strong hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
    >
      <FiArrowLeft className="size-4" aria-hidden="true" />
      Back to Bookshelf
    </button>
  ) : (
    <Link
      href={`/bookshelf?book=${book.slug}`}
      prefetch={false}
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-hairline bg-surface-1 px-3 tile-label text-muted-foreground no-underline transition-colors hover:border-hairline-strong hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
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
          <span
            aria-hidden="true"
            className="inline-block size-2 rounded-xs"
            style={{ backgroundColor: book.spine.capBg }}
          />
          <span>Stage {book.stageLabel}</span>
          <span aria-hidden="true" className="text-faint">
            ·
          </span>
          <span>{book.track}</span>
          <span aria-hidden="true" className="text-faint">
            ·
          </span>
          <span className="text-faint">{book.edition}</span>
          <BookStatusBadge status={book.status} data-book-status={book.status} />
        </span>
      }
      title={book.title}
      description={book.summary}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {backAction}
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-hairline bg-surface-1 px-3 tile-label text-muted-foreground transition-colors hover:border-hairline-strong hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
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
            {book.authors} · {book.publisher} ({book.year}) ·{' '}
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
                      {String(topic.number).padStart(3, '0')}
                    </span>
                    <span>{topic.title}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div
            className={cn('flex flex-wrap items-center gap-x-5 gap-y-2', styles.rv)}
            style={{ '--d': '220ms' } as CSSProperties}
          >
            <a
              href={book.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 tile-label text-brand-ink underline-offset-4 hover:text-foreground hover:underline"
            >
              Explore {book.spineTitle}
              <FiArrowUpRight className="size-4" aria-hidden="true" />
            </a>
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

          {books.length > 1 && (
            <nav aria-label="Adjacent books" className="grid gap-3 pt-2 sm:grid-cols-2">
              {onNavigateBook ? (
                <button
                  type="button"
                  onClick={() => onNavigateBook(prev)}
                  className="group flex flex-col items-start gap-1 rounded-tile bg-surface-1 p-4 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="inline-flex items-center gap-1.5 tile-meta tabular-nums text-faint group-hover:text-brand-ink">
                    <FiArrowLeft className="size-3.5" aria-hidden="true" />
                    Stage {prev.stageLabel} · {prev.track}
                  </span>
                  <span className="tile-sub font-medium text-foreground">{prev.title}</span>
                </button>
              ) : (
                <Link
                  href={`/bookshelf/${prev.slug}`}
                  prefetch={false}
                  className="group flex flex-col items-start gap-1 rounded-tile bg-surface-1 p-4 no-underline transition-colors hover:bg-surface-2"
                >
                  <span className="inline-flex items-center gap-1.5 tile-meta tabular-nums text-faint group-hover:text-brand-ink">
                    <FiArrowLeft className="size-3.5" aria-hidden="true" />
                    Stage {prev.stageLabel} · {prev.track}
                  </span>
                  <span className="tile-sub font-medium text-foreground">{prev.title}</span>
                </Link>
              )}

              {onNavigateBook ? (
                <button
                  type="button"
                  onClick={() => onNavigateBook(next)}
                  className="group flex flex-col items-end gap-1 rounded-tile bg-surface-1 p-4 text-right transition-colors hover:bg-surface-2"
                >
                  <span className="inline-flex items-center gap-1.5 tile-meta tabular-nums text-faint group-hover:text-brand-ink">
                    Stage {next.stageLabel} · {next.track}
                    <FiArrowRight className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="tile-sub font-medium text-foreground">{next.title}</span>
                </button>
              ) : (
                <Link
                  href={`/bookshelf/${next.slug}`}
                  prefetch={false}
                  className="group flex flex-col items-end gap-1 rounded-tile bg-surface-1 p-4 text-right no-underline transition-colors hover:bg-surface-2"
                >
                  <span className="inline-flex items-center gap-1.5 tile-meta tabular-nums text-faint group-hover:text-brand-ink">
                    Stage {next.stageLabel} · {next.track}
                    <FiArrowRight className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="tile-sub font-medium text-foreground">{next.title}</span>
                </Link>
              )}
            </nav>
          )}
        </div>

        <div
          className={cn('lg:sticky lg:top-20', styles.rv)}
          style={{ '--d': '120ms', '--rd': '640ms' } as CSSProperties}
        >
          <BookCoverFrame book={book} priority />
        </div>
      </div>

      <ReadingMapDialog
        open={mapOpen}
        activeSlug={book.slug}
        books={books}
        shelves={shelves}
        onClose={() => setMapOpen(false)}
        onOpenBook={onNavigateBook}
      />
    </PageShell>
  );
}
