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
 * @file A book page's og:type 'book' tags (constructMetadata's `book` option): each author as
 * its own book:author, the ISBN as bare digits for book:isbn when it is a real one, and the shelf
 * as a book:tag. Pure; guarded by tests/unit/bookshelf/book-open-graph.test.ts.
 */

import { normalizeIsbn } from '@/sanity/bookshelf-rules';
import type { MetadataBook } from '@/utils/seo/meta';
import type { BookItem } from '../../_lib/books';

/** What joins two authors in Studio's one field: a comma, an ampersand or the word "and". */
const AUTHOR_SEPARATOR = /\s*(?:,|&|\band\b)\s*/;

/** Each author named in Studio's authors field, in order. */
const authorsOf = (authors: string): string[] =>
  authors
    .split(AUTHOR_SEPARATOR)
    .map((name) => name.trim())
    .filter(Boolean);

/** `book`'s og:type 'book' tags: its authors, its ISBN when real, and its shelf. */
export function bookOpenGraph(book: Pick<BookItem, 'authors' | 'isbn' | 'track'>): MetadataBook {
  const isbn = normalizeIsbn(book.isbn);
  return {
    authors: authorsOf(book.authors),
    ...(isbn && { isbn }),
    tags: [book.track],
  };
}
