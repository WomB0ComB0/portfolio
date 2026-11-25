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

import { motion } from 'motion/react';
import Link from 'next/link';
import {
  type ReactElement,
  type TouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FiArrowLeft, FiArrowRight, FiArrowUpRight, FiMap } from 'react-icons/fi';
import { SPRING } from '@/lib/design/motion';
import { cn } from '@/lib/utils';
import {
  BOOK_CATEGORIES,
  BOOKS,
  type BookCategory,
  type BookItem,
  DEFAULT_BOOK_INDEX,
  getBookAt,
  getBookIndexBySlug,
  getTrackStartIndex,
  TOTAL_TOPICS,
} from '../_lib/books';
import styles from './bookshelf.module.css';
import { ReadingMapDialog } from './reading-map-dialog';

export interface BookshelfStageProps {
  /** Optional initial book slug (e.g. from `?book=<slug>` when returning from a detail route). */
  readonly initialSlug?: string;
}

/** Number of neighbor spines rendered on each side of the active 3D book. */
const SIDE_SPINE_COUNT = 5;

const wrapIndex = (index: number, length: number): number => ((index % length) + length) % length;

interface VisibleSlot {
  readonly offset: number;
  readonly book: BookItem;
  readonly index: number;
}

/**
 * Interactive 3D Engineering Bookshelf: cyclic spine-to-cover carousel with real-time track
 * highlighting, keyboard and touch navigation, Reading Map curriculum overlay, and direct links
 * to each stage's dedicated `/bookshelf/[slug]` detail page.
 */
export function BookshelfStage({ initialSlug }: BookshelfStageProps): ReactElement {
  const initialIndex = useMemo(() => {
    if (!initialSlug) return DEFAULT_BOOK_INDEX;
    const found = getBookIndexBySlug(initialSlug);
    return found >= 0 ? found : DEFAULT_BOOK_INDEX;
  }, [initialSlug]);

  const [activeIndex, setActiveIndex] = useState<number>(initialIndex);
  const [filterMode, setFilterMode] = useState<BookCategory>('All');
  const [mapOpen, setMapOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const activeBook = getBookAt(activeIndex);

  const step = useCallback(
    (delta: number): void => {
      setActiveIndex((current) => {
        if (filterMode === 'All') return wrapIndex(current + delta, BOOKS.length);
        const matching = BOOKS.map((book, idx) => ({ book, idx })).filter(
          ({ book }) => book.track === filterMode,
        );
        if (matching.length === 0) return current;
        const pos = matching.findIndex(({ idx }) => idx === current);
        const nextPos = wrapIndex(Math.max(pos, 0) + delta, matching.length);
        return matching[nextPos]?.idx ?? current;
      });
    },
    [filterMode],
  );

  const selectCategory = useCallback((category: BookCategory): void => {
    setFilterMode(category);
    if (category !== 'All') {
      setActiveIndex(getTrackStartIndex(category));
    }
  }, []);

  const focusBook = useCallback((book: BookItem): void => {
    const idx = getBookIndexBySlug(book.slug);
    if (idx >= 0) {
      setActiveIndex(idx);
      setFilterMode('All');
    }
  }, []);

  // Keyboard navigation while viewing the shelf.
  useEffect(() => {
    if (mapOpen) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mapOpen, step]);

  const visibleSlots = useMemo<readonly VisibleSlot[]>(() => {
    const slots: VisibleSlot[] = [];
    for (let offset = -SIDE_SPINE_COUNT; offset <= SIDE_SPINE_COUNT; offset += 1) {
      const index = wrapIndex(activeIndex + offset, BOOKS.length);
      const book = BOOKS[index];
      if (book) slots.push({ offset, book, index });
    }
    return slots;
  }, [activeIndex]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>): void => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>): void => {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) >= 42) {
      step(delta < 0 ? 1 : -1);
    }
  };

  return (
    <section
      aria-label="Engineering bookshelf"
      className="flex flex-col gap-6 px-(--page-gutter) pb-20"
    >
      {/* Shelf top bar: title, category track pills, and Reading map */}
      <header className="flex flex-col gap-4 border-b border-hairline pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="tile-label text-muted-foreground">Personal</p>
          <h1 className="page-title text-foreground">Engineering shelf</h1>
        </div>

        {/* Track pills: highlights active book's track in All mode, or locks to a track */}
        <div
          role="tablist"
          aria-label="Bookshelf tracks"
          className="flex flex-wrap items-center gap-1 rounded-full border border-hairline bg-surface-1 p-1"
        >
          {BOOK_CATEGORIES.map((category) => {
            const isTrackHighlighted =
              category === 'All'
                ? filterMode === 'All'
                : filterMode === category ||
                  (filterMode === 'All' && activeBook.track === category);
            const isSolidActive =
              category === 'All'
                ? false
                : filterMode === category ||
                  (filterMode === 'All' && activeBook.track === category);

            return (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={category === 'All' ? filterMode === 'All' : filterMode === category}
                onClick={() => selectCategory(category)}
                className={cn(
                  'relative rounded-full px-3.5 py-1.5 text-body-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-focus',
                  isSolidActive
                    ? 'bg-brand text-canvas shadow-xs'
                    : isTrackHighlighted
                      ? 'bg-surface-2 text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {category}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-md border border-hairline bg-surface-1 px-3.5 text-body-sm font-medium text-muted-foreground transition-colors hover:border-hairline-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus lg:self-auto"
        >
          <FiMap className="h-3.5 w-3.5" aria-hidden="true" />
          Reading map
          <FiArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </header>

      {/* 3D Spine-to-Cover Shelf Stage */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={cn(
          'relative overflow-hidden rounded-tile border border-hairline bg-surface-1/50 px-2 py-10 sm:px-4 sm:py-14',
          styles['stage-viewport'],
        )}
      >
        {/* Ambient periwinkle glow under the centered book */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-72 w-[78%] -translate-y-1/2 blur-2xl',
            styles['shelf-floor-glow'],
          )}
        />

        {/* Grounded shelf contact shadow */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-x-10 bottom-7 h-7 sm:bottom-11',
            styles['floor-shadow'],
          )}
        />

        {/* Horizontal 3D Books Row */}
        <div className="relative z-10 flex min-h-[340px] items-end justify-center gap-2 sm:min-h-[410px] sm:gap-2.5 md:gap-3">
          {visibleSlots.map(({ offset, book, index }) => {
            const isActive = offset === 0;
            const absOffset = Math.abs(offset);
            const dimmedByFilter = filterMode !== 'All' && book.track !== filterMode;

            // Hide outer spines cleanly on narrower viewports so the row stays balanced.
            const responsiveVisibility =
              absOffset >= 5
                ? 'hidden xl:flex'
                : absOffset === 4
                  ? 'hidden lg:flex'
                  : absOffset === 3
                    ? 'hidden md:flex'
                    : absOffset === 2
                      ? 'hidden sm:flex'
                      : 'flex';

            if (isActive) {
              return (
                <motion.div
                  key={book.slug}
                  layout
                  transition={SPRING}
                  className={cn(
                    'relative z-20 mx-1 flex shrink-0 items-stretch sm:mx-3',
                    styles['book-3d'],
                  )}
                >
                  <div
                    className={cn(
                      'group relative flex items-stretch',
                      styles['active-book-assembly'],
                    )}
                  >
                    {/* Angled 3D left spine attached to the front cover */}
                    <div
                      aria-hidden="true"
                      className={cn(
                        'relative flex h-[320px] w-[40px] shrink-0 flex-col justify-between overflow-hidden rounded-l-[5px] border-y border-l sm:h-[396px] sm:w-[48px]',
                        styles['active-spine-wing'],
                      )}
                      style={{
                        backgroundColor: book.spine.bodyBg,
                        borderColor: book.spine.borderTint,
                      }}
                    >
                      <div
                        className="flex h-12 items-center justify-center font-mono text-meta font-semibold tabular-nums sm:h-14"
                        style={{
                          backgroundColor: book.spine.capBg,
                          color: book.spine.capText,
                        }}
                      >
                        {book.stageLabel}
                      </div>
                      <div className="flex flex-1 items-center justify-center overflow-hidden py-3">
                        <span
                          className={cn(
                            'max-h-[190px] overflow-hidden text-label leading-none font-medium tracking-tight whitespace-nowrap sm:max-h-[240px] sm:text-meta',
                            styles['spine-text'],
                          )}
                          style={{ color: book.spine.titleColor }}
                        >
                          {book.spineTitle}
                        </span>
                      </div>
                      <div className="flex h-20 items-center justify-center pb-3">
                        <span
                          className={cn(
                            'font-mono text-[9px] leading-none tracking-[0.14em] uppercase whitespace-nowrap',
                            styles['spine-text'],
                          )}
                          style={{ color: book.spine.authorColor }}
                        >
                          {book.spineAuthor}
                        </span>
                      </div>
                    </div>

                    {/* Open Front Cover */}
                    <Link
                      href={`/bookshelf/${book.slug}`}
                      aria-label={`Open ${book.title} (Stage ${book.stageLabel})`}
                      className="relative flex items-stretch no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
                    >
                      <div
                        className={cn(
                          'relative h-[320px] w-[244px] overflow-hidden rounded-[2px_8px_8px_2px] border border-hairline-strong/80 bg-surface-2 sm:h-[396px] sm:w-[302px]',
                          styles['cover-face'],
                        )}
                      >
                        {/* biome-ignore lint/performance/noImgElement: Local WebP asset served directly from public/assets/bookshelf (next.config disables /_next/image). */}
                        <img
                          src={book.coverSrc}
                          alt={`${book.title} by ${book.authors}`}
                          width={520}
                          height={680}
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                        <div
                          aria-hidden="true"
                          className={cn(
                            'pointer-events-none absolute inset-0',
                            styles['cover-crease'],
                          )}
                        />

                        {/* Floating circular Open badge on hover/focus (matches video 0:11) */}
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-canvas/0 transition-colors duration-200 group-hover:bg-canvas/20 group-focus-within:bg-canvas/20">
                          <span className="inline-flex h-16 w-16 scale-90 items-center justify-center rounded-full border border-hairline-strong bg-canvas/90 text-body-sm font-medium text-foreground opacity-0 shadow-raised backdrop-blur-md transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100">
                            Open
                          </span>
                        </div>
                      </div>

                      {/* Right-hand paper page thickness */}
                      <div
                        aria-hidden="true"
                        className={cn(
                          'my-[4px] w-[7px] shrink-0 rounded-r-[3px] border-y border-r border-black/30',
                          styles['page-block-edge'],
                        )}
                      />
                    </Link>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.button
                key={book.slug}
                type="button"
                layout="position"
                transition={SPRING}
                onClick={() => {
                  setActiveIndex(index);
                  if (filterMode !== 'All' && book.track !== filterMode) {
                    setFilterMode('All');
                  }
                }}
                aria-label={`Select Stage ${book.stageLabel}: ${book.title}`}
                className={cn(
                  responsiveVisibility,
                  'group relative h-[320px] w-[46px] shrink-0 cursor-pointer flex-col justify-between overflow-hidden rounded-[4px] border text-left transition-transform duration-200 hover:-translate-y-2 focus-visible:-translate-y-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:h-[396px] sm:w-[56px]',
                  styles['spine-surface'],
                  dimmedByFilter && 'opacity-35 hover:opacity-85',
                )}
                style={{
                  backgroundColor: book.spine.bodyBg,
                  borderColor: book.spine.borderTint,
                }}
              >
                {/* Top publisher color band with stage index */}
                <div
                  className="flex h-12 w-full shrink-0 items-center justify-center font-mono text-meta font-semibold tabular-nums sm:h-14"
                  style={{
                    backgroundColor: book.spine.capBg,
                    color: book.spine.capText,
                  }}
                >
                  {book.stageLabel}
                </div>

                {/* Vertical rotated title */}
                <div className="flex flex-1 items-center justify-center overflow-hidden px-1 py-4">
                  <span
                    className={cn(
                      'max-h-[185px] overflow-hidden text-body-sm leading-none font-medium tracking-tight whitespace-nowrap sm:max-h-[235px]',
                      styles['spine-text'],
                    )}
                    style={{ color: book.spine.titleColor }}
                  >
                    {book.spineTitle}
                  </span>
                </div>

                {/* Bottom author imprint */}
                <div className="flex h-24 w-full shrink-0 items-center justify-center pb-3">
                  <span
                    className={cn(
                      'font-mono text-[10px] leading-none tracking-[0.14em] uppercase whitespace-nowrap',
                      styles['spine-text'],
                    )}
                    style={{ color: book.spine.authorColor }}
                  >
                    {book.spineAuthor}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Centered prev/next arrow buttons (matching video) + active book caption */}
        <div className="relative z-20 mt-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous book"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface-1 text-muted-foreground shadow-tile transition-colors hover:border-hairline-strong hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
            >
              <FiArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next book"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface-1 text-muted-foreground shadow-tile transition-colors hover:border-hairline-strong hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
            >
              <FiArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Live stage summary & mobile-friendly Open trigger */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center">
            <span className="font-mono text-meta tabular-nums text-brand-ink">
              {activeBook.stageLabel} / {String(BOOKS.length).padStart(2, '0')}
            </span>
            <span aria-hidden="true" className="text-hairline-strong">
              ·
            </span>
            <span className="text-body-sm font-medium text-foreground">{activeBook.title}</span>
            <span aria-hidden="true" className="text-hairline-strong">
              ·
            </span>
            <Link
              href={`/bookshelf/${activeBook.slug}`}
              className="inline-flex items-center gap-1 font-mono text-meta text-brand-ink no-underline underline-offset-4 hover:text-foreground hover:underline"
            >
              Open notes ({activeBook.topics.length} topics)
              <FiArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      {/* Quiet footer telemetry strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-meta text-faint">
        <p>
          Use{' '}
          <kbd className="rounded border border-hairline bg-surface-1 px-1.5 py-0.5 font-mono text-label text-muted-foreground">
            ←
          </kbd>{' '}
          <kbd className="rounded border border-hairline bg-surface-1 px-1.5 py-0.5 font-mono text-label text-muted-foreground">
            →
          </kbd>{' '}
          or click any spine to browse. Click the open cover to read the stage outline.
        </p>
        <span className="font-mono tabular-nums">
          {BOOKS.length} books · {TOTAL_TOPICS} topics
        </span>
      </div>

      <ReadingMapDialog
        open={mapOpen}
        activeSlug={activeBook.slug}
        onClose={() => setMapOpen(false)}
        onSelectBook={focusBook}
      />
    </section>
  );
}
