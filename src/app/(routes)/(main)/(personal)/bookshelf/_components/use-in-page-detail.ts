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
 * @file The stage's in-page book detail: which book is open, and the address that names it, the
 * book's own page /bookshelf/<slug> (_lib/book-address.ts), so a copied or shared address opens
 * and unfurls as that book. Opening a book moves the stage to it, scrolls to the top and pushes
 * its address over the list's, the list's query kept; another book opened from the detail
 * (Previous, Next, the map's Open stage) replaces it, so one Back returns to the list. Closing
 * goes Back to the list's entry, or writes the list's address over a page entered on a book's
 * address (_lib/detail-history.ts). Back and Forward (popstate) open the book the address names,
 * or close the detail when it names none. A stage that mounts on a book's address (Back from
 * another page) opens that book; one on an old #/stage/NN link opens its book and rewrites the
 * address to the book's page. While a book is open the stage (bookshelf-stage.tsx) renders
 * BookDetailView in place of its shell. Guarded by tests/unit/bookshelf/use-in-page-detail.test.tsx,
 * book-detail-view.test.tsx and reading-map-dialog.test.tsx.
 */

import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { prefersReducedMotion } from '@/lib/design/motion';
import { legacyStageLabel, slugFromBookPath } from '../_lib/book-address';
import type { BookItem } from '../_lib/books';
import { leaveBookAddress, pushBookAddress, replaceBookAddress } from '../_lib/detail-history';

export interface InPageDetailOptions {
  /** The books on the stage, in stage order. */
  readonly books: readonly BookItem[];
  /** Each book's index in `books`, by slug. */
  readonly indexBySlug: ReadonlyMap<string, number>;
  /** Moves the stage, with no step: the detail covers it. */
  readonly setPos: Dispatch<SetStateAction<number>>;
  /** The stage's last slot positions: cleared on close, so every slot lands without a slide. */
  readonly slotPositionsRef: RefObject<Map<number, number>>;
  /** The list's own path, which closing returns to: /bookshelf, or a shelf's page. */
  readonly listPath: string;
}

export interface InPageDetail {
  /** The open book, or null while the stage shows. */
  readonly detailBook: BookItem | null;
  /** Opens `book`: pushes its address from the stage, replaces it from another book's detail. */
  readonly openDetail: (book: BookItem) => void;
  /** Opens the book with this slug (the detail's Previous/Next, the map's Open stage). */
  readonly openDetailBySlug: (slug: string) => void;
  /** Closes the detail and returns the address to the list's. */
  readonly closeDetail: () => void;
}

/** The book the address names on the stage, and whether an old #/stage/NN link named it. */
interface AddressedBook {
  readonly index: number;
  readonly isLegacy: boolean;
}

/** The book the address names: its page's path, or an old #/stage/NN link; null for none. */
function addressedBook(
  books: readonly BookItem[],
  indexBySlug: ReadonlyMap<string, number>,
): AddressedBook | null {
  const slug = slugFromBookPath(window.location.pathname);
  if (slug !== null) {
    const index = indexBySlug.get(slug);
    return index === undefined ? null : { index, isLegacy: false };
  }
  const label = legacyStageLabel(window.location.hash);
  const index = label === null ? -1 : books.findIndex((book) => book.stageLabel === label);
  return index < 0 ? null : { index, isLegacy: true };
}

/** The open book and its address, /bookshelf/<slug>, kept in step with Back and Forward. */
export function useInPageDetail({
  books,
  indexBySlug,
  setPos,
  slotPositionsRef,
  listPath,
}: InPageDetailOptions): InPageDetail {
  const [detailBook, setDetailBook] = useState<BookItem | null>(null);
  // The handlers read it between renders: whether a book is open decides push or replace.
  const detailBookRef = useRef<BookItem | null>(null);

  const show = useCallback((book: BookItem | null): void => {
    detailBookRef.current = book;
    setDetailBook(book);
  }, []);

  /** Closes the detail, writing no address; every slot then lands without a slide. */
  const hide = useCallback((): void => {
    if (detailBookRef.current === null) return;
    slotPositionsRef.current.clear();
    show(null);
  }, [slotPositionsRef, show]);

  /**
   * Opens the book the address names, writing no new entry; an old #/stage/NN link is rewritten
   * to the book's page. False when the address names no book on the stage.
   */
  const openFromAddress = useCallback((): boolean => {
    const hit = addressedBook(books, indexBySlug);
    const book = hit ? books[hit.index] : undefined;
    if (!hit || !book) return false;
    setPos(hit.index);
    show(book);
    if (hit.isLegacy) replaceBookAddress(book.slug);
    return true;
  }, [books, indexBySlug, setPos, show]);

  const openDetail = useCallback(
    (book: BookItem): void => {
      const idx = indexBySlug.get(book.slug);
      if (idx !== undefined) setPos(idx);
      const fromDetail = detailBookRef.current !== null;
      show(book);
      if (fromDetail) replaceBookAddress(book.slug);
      else pushBookAddress(book.slug);
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    },
    [indexBySlug, setPos, show],
  );

  const openDetailBySlug = useCallback(
    (slug: string): void => {
      const idx = indexBySlug.get(slug);
      const book = idx === undefined ? undefined : books[idx];
      if (book) openDetail(book);
    },
    [indexBySlug, books, openDetail],
  );

  const closeDetail = useCallback((): void => {
    hide();
    leaveBookAddress(listPath);
  }, [hide, listPath]);

  useFollowAddress(openFromAddress, hide);

  return { detailBook, openDetail, openDetailBySlug, closeDetail };
}

/**
 * Follows the address: once on mount, a book's address (Back from another page) or an old link
 * opens that book; on Back and Forward the address names the book to show, or none.
 */
function useFollowAddress(openFromAddress: () => boolean, hide: () => void): void {
  useEffect(() => {
    const onPopState = (): void => {
      if (!openFromAddress()) hide();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [openFromAddress, hide]);

  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    openFromAddress();
  }, [openFromAddress]);
}
