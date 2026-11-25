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
import { type ReactElement, useState } from 'react';
import { FiArrowLeft, FiArrowRight, FiArrowUpRight, FiMap } from 'react-icons/fi';
import { EASE, SPRING } from '@/lib/design/motion';
import { type BookItem, getAdjacentBooks } from '../_lib/books';
import { BookCoverFrame } from './book-cover-frame';
import { ReadingMapDialog } from './reading-map-dialog';

export interface BookDetailViewProps {
  readonly book: BookItem;
}

/**
 * Editorial book detail screen (`/bookshelf/[slug]`): stage eyebrow, large display title, concise
 * thesis, a 2-column numbered topic curriculum grid on the left, and the tactile upright book
 * cover on the right.
 */
export function BookDetailView({ book }: BookDetailViewProps): ReactElement {
  const [mapOpen, setMapOpen] = useState(false);
  const { prev, next } = getAdjacentBooks(book.slug);
  const midpoint = Math.ceil(book.topics.length / 2);
  const leftTopics = book.topics.slice(0, midpoint);
  const rightTopics = book.topics.slice(midpoint);

  return (
    <div className="px-(--page-gutter) pb-20">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Top utility bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
          <Link
            href={`/bookshelf?book=${book.slug}`}
            prefetch={false}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-hairline bg-surface-1 px-3 text-body-sm font-medium text-muted-foreground no-underline transition-colors hover:border-hairline-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
          >
            <FiArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to shelf
          </Link>

          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-hairline bg-surface-1 px-3 text-body-sm text-muted-foreground transition-colors hover:border-hairline-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
          >
            <FiMap className="h-3.5 w-3.5" aria-hidden="true" />
            Reading map
            <FiArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Main 2-column split matching the video's editorial book detail screen */}
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,360px)] lg:gap-14">
          <motion.div
            key={book.slug}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: EASE.outExpo }}
            className="min-w-0 space-y-8"
          >
            <header className="space-y-4">
              <div className="flex flex-wrap items-center gap-2.5 font-mono text-meta tabular-nums">
                <span className="inline-flex items-center gap-2 text-brand-ink">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 rounded-xs"
                    style={{ backgroundColor: book.spine.capBg }}
                  />
                  Stage {book.stageLabel}
                </span>
                <span aria-hidden="true" className="text-hairline-strong">
                  ·
                </span>
                <span className="text-muted-foreground">{book.track}</span>
                <span aria-hidden="true" className="text-hairline-strong">
                  ·
                </span>
                <span className="text-faint">{book.edition}</span>
              </div>

              <h1 className="text-[clamp(1.85rem,1.2rem+2.2vw,2.75rem)] leading-[1.1] font-semibold tracking-tight text-foreground">
                {book.title}
              </h1>

              <p className="max-w-[58ch] text-body text-muted-foreground">{book.summary}</p>

              <p className="font-mono text-meta text-faint">
                {book.authors} · {book.publisher} ({book.year})
              </p>
            </header>

            {/* 2-column numbered curriculum topics */}
            <section aria-label="Core topics" className="border-t border-hairline pt-6">
              <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                <ol className="space-y-3">
                  {leftTopics.map((topic) => (
                    <li
                      key={topic.number}
                      className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-baseline gap-2 text-body-sm"
                    >
                      <span className="font-mono text-meta tabular-nums text-faint">
                        {String(topic.number).padStart(3, '0')}
                      </span>
                      <span className="text-foreground/95">{topic.title}</span>
                    </li>
                  ))}
                </ol>
                <ol className="space-y-3">
                  {rightTopics.map((topic) => (
                    <li
                      key={topic.number}
                      className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-baseline gap-2 text-body-sm"
                    >
                      <span className="font-mono text-meta tabular-nums text-faint">
                        {String(topic.number).padStart(3, '0')}
                      </span>
                      <span className="text-foreground/95">{topic.title}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            {/* Bottom action links */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <a
                href={book.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 text-body-sm font-medium text-brand-ink underline-offset-4 hover:text-foreground hover:underline"
              >
                Explore {book.spineTitle}
                <FiArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <span aria-hidden="true" className="text-hairline-strong">
                ·
              </span>
              <span className="font-mono text-label tabular-nums text-faint">ISBN {book.isbn}</span>
            </div>
          </motion.div>

          {/* Right sticky upright cover */}
          <motion.div
            initial={false}
            animate={{ opacity: 1, scale: 1 }}
            transition={SPRING}
            className="flex justify-center lg:sticky lg:top-24 lg:justify-end"
          >
            <BookCoverFrame book={book} priority />
          </motion.div>
        </div>

        {/* Previous / Next stage navigation */}
        <nav
          aria-label="Adjacent books"
          className="grid gap-3 border-t border-hairline pt-6 sm:grid-cols-2"
        >
          <Link
            href={`/bookshelf/${prev.slug}`}
            prefetch={false}
            className="group flex flex-col items-start gap-1 rounded-tile border border-hairline bg-surface-1 p-4 no-underline transition-colors hover:border-hairline-strong hover:bg-surface-2"
          >
            <span className="inline-flex items-center gap-1.5 font-mono text-label tabular-nums text-faint group-hover:text-brand-ink">
              <FiArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Stage {prev.stageLabel} · {prev.track}
            </span>
            <span className="text-body-sm font-semibold text-foreground">{prev.title}</span>
          </Link>

          <Link
            href={`/bookshelf/${next.slug}`}
            prefetch={false}
            className="group flex flex-col items-end gap-1 rounded-tile border border-hairline bg-surface-1 p-4 text-right no-underline transition-colors hover:border-hairline-strong hover:bg-surface-2"
          >
            <span className="inline-flex items-center gap-1.5 font-mono text-label tabular-nums text-faint group-hover:text-brand-ink">
              Stage {next.stageLabel} · {next.track}
              <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="text-body-sm font-semibold text-foreground">{next.title}</span>
          </Link>
        </nav>
      </div>

      <ReadingMapDialog open={mapOpen} activeSlug={book.slug} onClose={() => setMapOpen(false)} />
    </div>
  );
}
