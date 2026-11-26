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
 * @file A book's Previous and Next neighbours in stage order, wrapping round both ends, and the
 * few fields their links show. The catalog loader (load-bookshelf.ts) finds them for
 * /bookshelf/[slug], and the stage for its in-page detail. Pure and isomorphic; guarded by
 * tests/unit/bookshelf/slim-shapes.test.ts.
 */

import type { BookItem, NonEmptyBooks } from './books';

/** A book as the Previous and Next links beside its neighbour name it. */
export type BookNeighbor = Pick<BookItem, 'slug' | 'title' | 'stageLabel' | 'track'>;

/** A book's Previous/Next link fields alone, so a link never carries the whole book. */
export function toBookNeighbor(book: BookItem): BookNeighbor {
  return { slug: book.slug, title: book.title, stageLabel: book.stageLabel, track: book.track };
}

/**
 * The books before and after the one at `index`, wrapping round both ends (the first book's
 * previous is the last). With one book, both are that book.
 */
export function neighborsOf(
  books: NonEmptyBooks,
  index: number,
): { readonly prev: BookItem; readonly next: BookItem } {
  const count = books.length;
  const at = (offset: number): BookItem =>
    books[(((index + offset) % count) + count) % count] ?? books[0];
  return { prev: at(-1), next: at(1) };
}
