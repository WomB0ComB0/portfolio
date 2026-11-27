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
 * @file A shelf's link-preview card: what it draws (the shelf's title and description, how many
 * books it holds and how many are read, and the covers of its first few books) and the image a
 * shelf page's metadata names for it, /api/og/shelf/<shelfSlug>?v=<version>. Keyed by the slug,
 * like a book's card (book-preview.ts): the card route looks the shelf up and fetches only its
 * books' own Sanity covers. Pure and isomorphic; guarded by
 * tests/unit/seo/bookshelf-previews.test.ts.
 */

import { BOOK_NOUN, listTitles } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/book-labels';
import type {
  BookItem,
  ShelfCollection,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/books';
import { OG_CONTENT_TYPE, OG_IMAGE_SIZE } from '@/lib/og/constants';
import { clipText } from '@/lib/og/text';
import type { MetadataImage } from '@/utils/seo/meta';
import { cardVersion } from './card-version';

/** Where a shelf's card is drawn: /api/og/shelf/<shelfSlug>. */
export const SHELF_CARD_PATH = '/api/og/shelf';

/** How many of the shelf's books the card shows the covers of, first in stage order. */
export const SHELF_CARD_COVERS = 4;

/** The longest alt text: X keeps 420 characters of an image description. */
const ALT_MAX = 420;

/** One cover on a shelf's card: the book's title (for the alt text) and its catalog cover. */
export interface ShelfCover {
  readonly title: string;
  readonly coverSrc: string;
}

/** What a shelf's card draws. Its version is the card URL's `?v=`. */
export interface ShelfPreview {
  readonly title: string;
  readonly description: string;
  readonly bookCount: number;
  readonly readCount: number;
  readonly covers: readonly ShelfCover[];
}

/** What `shelf`'s card draws, from its books in stage order. */
export const shelfPreviewOf = (
  shelf: ShelfCollection,
  books: readonly BookItem[],
): ShelfPreview => ({
  title: shelf.title,
  description: shelf.description,
  bookCount: books.length,
  readCount: books.filter((book) => book.status === 'completed').length,
  covers: books
    .slice(0, SHELF_CARD_COVERS)
    .map((book) => ({ title: book.title, coverSrc: book.coverSrc })),
});

/** "7 books", "1 book". */
export const bookCount = (count: number): string =>
  `${count} ${count === 1 ? BOOK_NOUN.one : BOOK_NOUN.many}`;

/** The card's alt text: whose covers it shows, on which shelf, and how many books it holds. */
function shelfPreviewAlt(preview: ShelfPreview): string {
  const covers = preview.covers.length === 1 ? 'Cover' : 'Covers';
  const titles = listTitles(preview.covers.map((cover) => cover.title));
  return clipText(
    `${covers} of ${titles} on the ${preview.title} shelf (${bookCount(preview.bookCount)})`,
    ALT_MAX,
  );
}

/**
 * The preview image for `shelf`'s page: its card's slug-keyed URL with the version of what it
 * draws, the 1200x630 PNG size and type it is drawn at, and alt text naming the covers.
 */
export function shelfPreviewImage(
  shelf: ShelfCollection,
  books: readonly BookItem[],
): MetadataImage {
  const preview = shelfPreviewOf(shelf, books);
  return {
    url: `${SHELF_CARD_PATH}/${encodeURIComponent(shelf.slug)}?v=${cardVersion(preview)}`,
    ...OG_IMAGE_SIZE,
    type: OG_CONTENT_TYPE,
    alt: shelfPreviewAlt(preview),
  };
}
