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
import { FiArrowLeft, FiArrowRight, FiArrowUpRight } from 'react-icons/fi';
import { type BookItem, getAdjacentBooks } from '../_lib/books';
import { BookCoverFrame } from './book-cover-frame';
import styles from './bookshelf.module.css';
import { ReadingMapDialog } from './reading-map-dialog';

export interface BookDetailViewProps {
  readonly book: BookItem;
}

/**
 * Borderless standalone stage detail page (`/bookshelf/[slug]`): matches the shelf's
 * container-transform detail layout for direct links, SEO, and no-JS visitors.
 */
export function BookDetailView({ book }: BookDetailViewProps): ReactElement {
  const [mapOpen, setMapOpen] = useState(false);
  const { prev, next } = getAdjacentBooks(book.slug);
  const topicRows = Math.ceil(book.topics.length / 2);

  return (
    <div className="min-h-dvh pb-20">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between px-[clamp(20px,3vw,48px)] pt-6">
        <Link
          href={`/bookshelf?book=${book.slug}`}
          prefetch={false}
          className="inline-flex min-h-10 items-center gap-2 text-body-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground"
        >
          <FiArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to shelf
        </Link>

        <button type="button" onClick={() => setMapOpen(true)} className={styles['top-link']}>
          Reading map ↗
        </button>
      </div>

      <div className={styles['detail-grid']}>
        <div className={styles['detail-text']}>
          <p className={styles['detail-eyebrow']}>
            <span>
              Stage {book.stageLabel} · {book.spineTitle}
            </span>
          </p>

          <h1 className={styles['detail-heading']}>{book.title}</h1>
          <p className={styles['detail-desc']}>{book.summary}</p>

          <ol
            className={styles['detail-topics']}
            style={{ '--topic-rows': String(topicRows) } as CSSProperties}
          >
            {book.topics.map((topic) => (
              <li key={topic.number}>
                <span className={styles['detail-topic-num']}>{topic.number}</span>
                <span>{topic.title}</span>
              </li>
            ))}
          </ol>

          <div className="mt-7 flex flex-wrap items-center gap-5">
            <a
              href={book.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-body-sm font-semibold text-brand-ink underline underline-offset-4 hover:text-foreground"
            >
              Explore {book.spineTitle}
              <FiArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <span className="font-mono text-label text-faint">
              {book.authors} · {book.publisher} ({book.year})
            </span>
          </div>

          <nav aria-label="Adjacent books" className="mt-12 grid gap-4 sm:grid-cols-2">
            <Link
              href={`/bookshelf/${prev.slug}`}
              prefetch={false}
              className="group flex flex-col items-start gap-1 rounded-tile bg-surface-1 p-4 no-underline transition-colors hover:bg-surface-2"
            >
              <span className="inline-flex items-center gap-1.5 font-mono text-label tabular-nums text-faint group-hover:text-brand-ink">
                <FiArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Stage {prev.stageLabel}
              </span>
              <span className="text-body-sm font-semibold text-foreground">{prev.title}</span>
            </Link>

            <Link
              href={`/bookshelf/${next.slug}`}
              prefetch={false}
              className="group flex flex-col items-end gap-1 rounded-tile bg-surface-1 p-4 text-right no-underline transition-colors hover:bg-surface-2"
            >
              <span className="inline-flex items-center gap-1.5 font-mono text-label tabular-nums text-faint group-hover:text-brand-ink">
                Stage {next.stageLabel}
                <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="text-body-sm font-semibold text-foreground">{next.title}</span>
            </Link>
          </nav>
        </div>

        <BookCoverFrame book={book} priority />
      </div>

      <ReadingMapDialog open={mapOpen} activeSlug={book.slug} onClose={() => setMapOpen(false)} />
    </div>
  );
}
