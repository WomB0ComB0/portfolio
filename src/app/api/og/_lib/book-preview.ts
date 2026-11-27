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
 * @file A book's link-preview card: what it draws (the title, stage, authors, shelf, reading
 * status and the catalog's own cover), the title as the card sets it, and the image a book page's
 * metadata names for it. The image is /api/og/book/<slug>?v=<version>: keyed by the slug, so the
 * card route (src/app/api/og/book/[slug]/route.tsx) looks the book up in the catalog and only
 * ever fetches that book's own Sanity cover, never a URL from the query. The version changes with
 * anything the card draws (card-version.ts). Pure and isomorphic; guarded by
 * tests/unit/seo/bookshelf-previews.test.ts.
 */

import type { BookItem, BookStatus } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/books';
import { OG_CONTENT_TYPE, OG_IMAGE_SIZE } from '@/lib/og/constants';
import { clipText } from '@/lib/og/text';
import { BOOK_STATUS_LABELS } from '@/sanity/bookshelf-rules';
import type { MetadataImage } from '@/utils/seo/meta';
import { cardVersion } from './card-version';

/** Where a book's card is drawn: /api/og/book/<slug>. */
export const BOOK_CARD_PATH = '/api/og/book';

/** The longest title a book card sets: three lines at its smallest size beside the cover. */
export const BOOK_CARD_TITLE_MAX = 84;

/** The longest alt text: X keeps 420 characters of an image description. */
const ALT_MAX = 420;

/** Where a subtitle starts, as in "Clean Code: A Handbook of Agile Software Craftsmanship". */
const SUBTITLE_MARK = ': ';

/** What a book's card draws. Its version is the card URL's `?v=`. */
export interface BookPreview {
  readonly title: string;
  readonly stageLabel: string;
  readonly authors: string;
  /** The shelf's title. */
  readonly shelf: string;
  readonly status: BookStatus;
  /** The catalog's cover URL on Sanity's CDN (load-bookshelf.ts builds it). */
  readonly coverSrc: string;
}

/** What `book`'s card draws. */
export const bookPreviewOf = (book: BookItem): BookPreview => ({
  title: book.title,
  stageLabel: book.stageLabel,
  authors: book.authors,
  shelf: book.track,
  status: book.status,
  coverSrc: book.coverSrc,
});

/**
 * The title as the card sets it: whole when it fits; otherwise its main title, the part before
 * the subtitle's colon; either way clipped at a word to BOOK_CARD_TITLE_MAX. The longest title
 * on the shelf has a 61-character subtitle the card has no room for.
 */
export function bookCardTitle(title: string): string {
  if (title.length <= BOOK_CARD_TITLE_MAX) return title;
  const [main = title] = title.split(SUBTITLE_MARK);
  return clipText(main, BOOK_CARD_TITLE_MAX);
}

/** The card's alt text: whose cover it shows, its reading status and its shelf. */
const bookPreviewAlt = (preview: BookPreview): string =>
  clipText(
    `Cover of ${preview.title} by ${preview.authors}, ${BOOK_STATUS_LABELS[preview.status].toLowerCase()}, on the ${preview.shelf} shelf`,
    ALT_MAX,
  );

/**
 * The preview image for `book`'s page: its card's slug-keyed URL with the version of what it
 * draws, the 1200x630 PNG size and type it is drawn at, and alt text describing the cover.
 */
export function bookPreviewImage(book: BookItem): MetadataImage {
  const preview = bookPreviewOf(book);
  return {
    url: `${BOOK_CARD_PATH}/${encodeURIComponent(book.slug)}?v=${cardVersion(preview)}`,
    ...OG_IMAGE_SIZE,
    type: OG_CONTENT_TYPE,
    alt: bookPreviewAlt(preview),
  };
}
