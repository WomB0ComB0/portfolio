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

/**
 * @file The stage's in-page book detail: which book is open, and the #/stage/NN hash that names
 * it. Opening a book moves the stage to it, pushes its hash and scrolls to the top; Back and
 * Forward (popstate) open the book the hash names, or close the detail when it names none; closing
 * drops the hash. While a book is open the stage (bookshelf-stage.tsx) renders BookDetailView in
 * place of its shell. Guarded by tests/unit/bookshelf/book-detail-view.test.tsx and
 * reading-map-dialog.test.tsx.
 */

import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { prefersReducedMotion } from '@/lib/design/motion';
import type { BookItem } from '../_lib/books';

export interface InPageDetailOptions {
  /** The books on the stage, in stage order. */
  readonly books: readonly BookItem[];
  /** Each book's index in `books`, by slug. */
  readonly indexBySlug: ReadonlyMap<string, number>;
  /** The book at a stage position, wrapped or clamped as the shelf is. */
  readonly bookAt: (index: number) => BookItem;
  /** Moves the stage, with no step: the detail covers it. */
  readonly setPos: Dispatch<SetStateAction<number>>;
  /** The stage's last slot positions: cleared on close, so every slot lands without a slide. */
  readonly slotPositionsRef: RefObject<Map<number, number>>;
}

export interface InPageDetail {
  /** The open book, or null while the stage shows. */
  readonly detailBook: BookItem | null;
  readonly setDetailBook: Dispatch<SetStateAction<BookItem | null>>;
  /** The index of the book the #/stage/NN hash names, or -1. */
  readonly stageIndexFromHash: () => number;
  /** Opens `book`, pushing its hash unless `push` is false. */
  readonly openDetail: (book: BookItem, options?: { push?: boolean }) => void;
  /** Opens the book with this slug (the detail's Previous/Next, the map's Open stage). */
  readonly openDetailBySlug: (slug: string) => void;
  /** Closes the detail, dropping the hash unless Back or Forward already moved it. */
  readonly closeDetail: (options?: { fromPop?: boolean }) => void;
}

/** The open book and its #/stage/NN hash, kept in step with Back and Forward. */
export function useInPageDetail({
  books,
  indexBySlug,
  bookAt,
  setPos,
  slotPositionsRef,
}: InPageDetailOptions): InPageDetail {
  const [detailBook, setDetailBook] = useState<BookItem | null>(null);

  const stageIndexFromHash = useCallback((): number => {
    if (typeof window === 'undefined') return -1;
    const match = /^#\/stage\/(\d+)/.exec(window.location.hash);
    if (!match?.[1]) return -1;
    const label = match[1].padStart(2, '0');
    return books.findIndex((book) => book.stageLabel === label);
  }, [books]);

  const openDetail = useCallback(
    (book: BookItem, { push = true } = {}): void => {
      const idx = books.findIndex((item) => item.slug === book.slug);
      if (idx >= 0) setPos(idx);
      setDetailBook(book);
      if (push && typeof window !== 'undefined') {
        const nextHash = `#/stage/${book.stageLabel}`;
        if (window.location.hash !== nextHash) {
          window.history.pushState(
            { stage: book.stageLabel },
            '',
            `${window.location.pathname}${window.location.search}${nextHash}`,
          );
        }
      }
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
    },
    [books, setPos],
  );

  const openDetailBySlug = useCallback(
    (slug: string): void => {
      const idx = indexBySlug.get(slug);
      const book = idx === undefined ? undefined : books[idx];
      if (book) openDetail(book);
    },
    [indexBySlug, books, openDetail],
  );

  const closeDetail = useCallback(
    ({ fromPop = false } = {}): void => {
      if (!fromPop && typeof window !== 'undefined' && window.location.hash) {
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${window.location.search}`,
        );
      }
      slotPositionsRef.current.clear();
      setDetailBook(null);
    },
    [slotPositionsRef],
  );

  useEffect(() => {
    const onPopState = (): void => {
      const idx = stageIndexFromHash();
      if (idx < 0) {
        closeDetail({ fromPop: true });
      } else {
        setPos(idx);
        setDetailBook(bookAt(idx));
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [closeDetail, stageIndexFromHash, bookAt, setPos]);

  return {
    detailBook,
    setDetailBook,
    stageIndexFromHash,
    openDetail,
    openDetailBySlug,
    closeDetail,
  };
}
