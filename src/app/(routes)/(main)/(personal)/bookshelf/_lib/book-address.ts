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
 * @file A book's address: its own page, /bookshelf/<slug> ([slug]/page.tsx), which a shared link
 * unfurls with the book's title and summary. The stage writes it when a book opens in place and
 * reads it back on Back and Forward (use-in-page-detail.ts, detail-history.ts), and book-link.tsx
 * links to it. An old shared link named the book by its stage number in the hash instead
 * (#/stage/NN): that form is only read, so the stage can open the book and rewrite the address.
 * Pure and isomorphic; guarded by tests/unit/bookshelf/book-address.test.ts.
 */

/** The whole shelf's path; a book's page and each shelf's page sit under it. */
const BOOKSHELF_PATH = '/bookshelf';
/** A book's page: one segment under /bookshelf, with or without a trailing slash. */
const BOOK_PATH = /^\/bookshelf\/([^/]+)\/?$/;
/** The segments under /bookshelf that are pages (or folders) of their own, never books. */
const NOT_BOOKS: ReadonlySet<string> = new Set(['free', 'shelf']);
/** An old link's hash: #/stage/ and the stage number. */
const LEGACY_STAGE_HASH = /^#\/stage\/(\d+)/;

/** A book's own page: /bookshelf/<slug>. */
export function bookPath(slug: string): string {
  return `${BOOKSHELF_PATH}/${encodeURIComponent(slug)}`;
}

/** The list a book opens over: the whole shelf, or one shelf's page when given its slug. */
export function listPath(shelfSlug?: string): string {
  return shelfSlug ? `${BOOKSHELF_PATH}/shelf/${encodeURIComponent(shelfSlug)}` : BOOKSHELF_PATH;
}

/** The slug a book's page path names, or null for any other path (or a malformed escape). */
export function slugFromBookPath(pathname: string): string | null {
  const segment = BOOK_PATH.exec(pathname)?.[1];
  if (!segment) return null;
  try {
    const slug = decodeURIComponent(segment);
    return NOT_BOOKS.has(slug) ? null : slug;
  } catch {
    return null;
  }
}

/** The stage number an old #/stage/NN link names, two digits wide ('7' reads '07'), or null. */
export function legacyStageLabel(hash: string): string | null {
  const digits = LEGACY_STAGE_HASH.exec(hash)?.[1];
  return digits ? digits.padStart(2, '0') : null;
}
