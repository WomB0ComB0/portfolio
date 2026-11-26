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
 * @file The bookshelf's rules, in one place for every side that applies them: the Studio schemas
 * (src/sanity/schemaTypes/book.ts and bookshelf.ts) check them before Publish, the site's decoder
 * (src/hooks/sanity/schemas.ts) checks them on every read, and the bookshelf UI model
 * (src/app/(routes)/(main)/(personal)/bookshelf/_lib/books.ts) re-exports them. So Studio refuses
 * what the site would drop, and a status label reads the same in Studio and on the page.
 *
 * No imports: the Studio's own build loads this by a relative path (it does not resolve the app's
 * '@/' alias), and the decoder and client islands load it wherever the site runs.
 */

/** A book's reading status, in the order Studio lists them. */
export const BOOK_STATUSES = ['completed', 'reading', 'queued'] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];

/** The short label for each status, shown in Studio's list preview and on the site. */
export const BOOK_STATUS_LABELS: Readonly<Record<BookStatus, string>> = {
  completed: 'Read',
  reading: 'Reading',
  queued: 'Unread',
};

/** The status a new book starts with in Studio. */
export const BOOK_DEFAULT_STATUS: BookStatus = 'queued';

/** True for one of {@link BOOK_STATUSES}. */
export const isBookStatus = (value: unknown): value is BookStatus =>
  typeof value === 'string' && (BOOK_STATUSES as readonly string[]).includes(value);

/**
 * A book's URL slug: lowercase letters and digits in words joined by single hyphens, so it is a
 * clean /bookshelf/<slug> path segment and a cover file name.
 */
export const BOOK_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Slugs no book may take: fixed pages under /bookshelf whose route wins over a book's
 * /bookshelf/<slug> page (`free` is the Free Library, /bookshelf/free).
 */
export const RESERVED_BOOK_SLUGS = ['free'] as const;

/** What Studio says about a slug {@link isBookSlug} refuses for its shape. */
export const BOOK_SLUG_MESSAGE =
  'Use lowercase letters and digits joined by single hyphens, e.g. "clean-code"';

/** What Studio says about an ISBN {@link isIsbn} refuses. */
export const BOOK_ISBN_MESSAGE =
  'Enter a valid ISBN-13 or ISBN-10 (digits, optional hyphens or spaces, check digit included)';

/** True for one of {@link RESERVED_BOOK_SLUGS}. */
export const isReservedBookSlug = (value: string): boolean =>
  (RESERVED_BOOK_SLUGS as readonly string[]).includes(value);

/** What Studio says about a slug {@link isReservedBookSlug} refuses. */
export const reservedBookSlugMessage = (slug: string): string =>
  `"${slug}" is reserved: /bookshelf/${slug} is a fixed page of the site. Choose another slug`;

/**
 * True for a slug the site uses: one {@link BOOK_SLUG_PATTERN} matches that is not one of
 * {@link RESERVED_BOOK_SLUGS}.
 */
export const isBookSlug = (value: string): boolean =>
  BOOK_SLUG_PATTERN.test(value) && !isReservedBookSlug(value);

/**
 * A cover's asset reference as Sanity names an image asset, `image-<id>-<width>x<height>-<format>`:
 * the shape the image URL builder parses. It throws on anything else, such as a file asset
 * (`file-<id>-pdf`), so the decoder drops a book whose cover is not one rather than lose the
 * whole catalog to one cover URL.
 */
export const BOOK_COVER_REF_PATTERN = /^image-[A-Za-z0-9]+-[1-9]\d*x[1-9]\d*-[a-z0-9]+$/;

/** True for a cover asset reference the image URL builder can draw: {@link BOOK_COVER_REF_PATTERN}. */
export const isBookCoverRef = (ref: string): boolean => BOOK_COVER_REF_PATTERN.test(ref);

/**
 * The label of the /bookshelf filter chip that shows every shelf: the reset, which is no shelf.
 * The filter tells shelves apart by slug (`?shelf=<slug>`), and each other chip is labelled with
 * its shelf's title, so no shelf may take this label: its chip would read as the reset.
 */
export const ALL_SHELVES_TAB = 'All';

/** A shelf title as Studio compares two of them: trimmed and lower-cased. */
export const shelfTitleKey = (title: string): string => title.trim().toLowerCase();

/** True for a shelf title that would read as the {@link ALL_SHELVES_TAB} chip, in any case. */
export const isReservedShelfTitle = (title: string): boolean =>
  shelfTitleKey(title) === shelfTitleKey(ALL_SHELVES_TAB);

/** What Studio says about a shelf title {@link isReservedShelfTitle} refuses. */
export const SHELF_TITLE_RESERVED_MESSAGE = `"${ALL_SHELVES_TAB}" labels the /bookshelf filter chip that shows every shelf. Choose another title`;

/**
 * What Studio says about a shelf title another shelf already has. The slug tells the shelves'
 * filters apart, but the title labels each chip, and old shared links (`?track=<title>`) find
 * their shelf by its title alone.
 */
export const SHELF_TITLE_DUPLICATE_MESSAGE =
  'Another shelf has this title. Each shelf title labels its own /bookshelf filter chip and old shared links find a shelf by its title, so titles must be unique';

/**
 * Strips everything but digits and X from an ISBN, returning it when it has the length of an
 * ISBN-10 or ISBN-13, else null. Lenient on purpose: it only shapes registry links, which a wrong
 * check digit does not break. {@link isIsbn} is the strict check Studio applies.
 */
export function normalizeIsbn(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  return cleaned.length === 10 || cleaned.length === 13 ? cleaned : null;
}

/** ISBN-10: nine digits and a check digit (0-9 or X); weights 10 down to 1 sum to 0 mod 11. */
function isIsbn10(digits: string): boolean {
  if (!/^\d{9}[\dX]$/.test(digits)) return false;
  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    const char = digits.charAt(index);
    sum += (10 - index) * (char === 'X' ? 10 : Number(char));
  }
  return sum % 11 === 0;
}

/** ISBN-13: thirteen digits; alternating weights 1 and 3 sum to 0 mod 10. */
function isIsbn13(digits: string): boolean {
  if (!/^\d{13}$/.test(digits)) return false;
  let sum = 0;
  for (let index = 0; index < 13; index += 1) {
    sum += Number(digits.charAt(index)) * (index % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

/**
 * True for a valid ISBN-10 or ISBN-13: only digits (and a final X for ISBN-10), optionally grouped
 * with hyphens or spaces, with a correct check digit.
 */
export function isIsbn(value: string): boolean {
  const trimmed = value.trim();
  if (!/^[0-9Xx\s-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/[\s-]/g, '').toUpperCase();
  return isIsbn10(digits) || isIsbn13(digits);
}
