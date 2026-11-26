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
 * @file The Bookshelf UI model: the shapes the catalog loader (load-bookshelf.ts) builds from
 * Sanity's `book` and `bookshelf` documents and the client islands render, plus UI constants and
 * helpers (status meta, the Live Console spine palette, ISBN registry links). It holds no catalog
 * content: books and shelves come only from Sanity, through the loader, and reach client islands
 * as props. Server- and client-safe.
 */

import { BOOK_STATUS_LABELS, type BookStatus, normalizeIsbn } from '@/sanity/bookshelf-rules';

export { BOOK_STATUSES, type BookStatus, normalizeIsbn } from '@/sanity/bookshelf-rules';

/** A track filter value: 'All', or a shelf's title (each book's track label). */
export type BookCategory = 'All' | string;

export type BookStatusFilter = 'all' | BookStatus;

export interface BookStatusMeta {
  readonly label: string;
  readonly description: string;
  readonly accentColor: string;
  readonly isRead: boolean;
}

export const BOOK_STATUS_META: Readonly<Record<BookStatus, BookStatusMeta>> = {
  completed: {
    label: BOOK_STATUS_LABELS.completed,
    description: 'Finished books with distilled notes and key takeaways.',
    accentColor: 'var(--brand)',
    isRead: true,
  },
  reading: {
    label: BOOK_STATUS_LABELS.reading,
    description: 'Books currently on the desk and actively being annotated.',
    accentColor: 'var(--brand-ink)',
    isRead: false,
  },
  queued: {
    label: BOOK_STATUS_LABELS.queued,
    description: 'Queued on the reading list for upcoming deep dives.',
    accentColor: 'var(--hairline-strong)',
    isRead: false,
  },
};

/** One shelf section, in shelf order, with its books' slugs in global stage order. */
export interface ShelfCollection {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly bookSlugs: readonly string[];
  /** The shelf document's `_updatedAt` (ISO 8601). */
  readonly updatedAt: string;
}

export const slugifyShelf = (title: string): string =>
  title
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export interface IsbnRegistryLinks {
  readonly openLibrary: string;
  readonly worldCat: string;
  readonly isbnSearch: string;
}

/** Authoritative public bibliographic registry URLs for a published ISBN. */
export function getIsbnRegistryLinks(isbn?: string | null): IsbnRegistryLinks | null {
  const cleaned = normalizeIsbn(isbn);
  if (!cleaned) return null;
  return {
    openLibrary: `https://openlibrary.org/isbn/${cleaned}`,
    worldCat: `https://search.worldcat.org/isbn/${cleaned}`,
    isbnSearch: `https://isbnsearch.org/isbn/${cleaned}`,
  };
}

export interface BookTopic {
  readonly number: number;
  readonly title: string;
}

export interface BookSpineTheme {
  /** Publisher or accent band at the top of the spine holding the stage number. */
  readonly capBg: string;
  readonly capText: string;
  /** Main spine body fill, title color, and subtle author ink. */
  readonly bodyBg: string;
  readonly titleColor: string;
  readonly authorColor: string;
  /** Subtle sheen tint along the hinge and outer edge. */
  readonly borderTint: string;
}

/**
 * Curated Live Console archival book-binding themes built strictly from CSS palette tokens.
 * Keeps adjacent 3D spines tactile and distinct while letting real book covers provide the color.
 */
export const LIVE_CONSOLE_SPINE_THEMES: readonly [BookSpineTheme, ...BookSpineTheme[]] = [
  {
    capBg: 'var(--surface-3)',
    capText: 'var(--fg-muted)',
    bodyBg: 'var(--surface-1)',
    titleColor: 'var(--fg)',
    authorColor: 'var(--fg-faint)',
    borderTint: 'var(--hairline)',
  },
  {
    capBg: 'var(--brand-subtle)',
    capText: 'var(--brand-ink)',
    bodyBg: 'var(--surface-2)',
    titleColor: 'var(--fg)',
    authorColor: 'var(--fg-faint)',
    borderTint: 'var(--brand-edge)',
  },
  {
    capBg: 'var(--surface-2)',
    capText: 'var(--fg-faint)',
    bodyBg: 'var(--canvas)',
    titleColor: 'var(--fg)',
    authorColor: 'var(--fg-muted)',
    borderTint: 'var(--hairline-strong)',
  },
  {
    capBg: 'var(--brand-subtle)',
    capText: 'var(--fg)',
    bodyBg: 'var(--surface-1)',
    titleColor: 'var(--fg)',
    authorColor: 'var(--fg-muted)',
    borderTint: 'var(--hairline)',
  },
];

/** Deterministic Live Console spine binding theme for a zero-based book index. */
export function getLiveConsoleSpineTheme(index: number): BookSpineTheme {
  const len = LIVE_CONSOLE_SPINE_THEMES.length;
  return LIVE_CONSOLE_SPINE_THEMES[((index % len) + len) % len] ?? LIVE_CONSOLE_SPINE_THEMES[0];
}

/**
 * One book as the bookshelf renders it, built by the catalog loader from a Sanity `book` document
 * joined to its shelf. Optional facts are absent when Studio leaves them empty: the UI renders
 * them only when present, never a made-up default.
 */
export interface BookItem {
  readonly slug: string;
  /** 1-based position across all shelves (shelf order, then book order). */
  readonly stage: number;
  readonly stageLabel: string;
  readonly title: string;
  readonly spineTitle: string;
  readonly authors: string;
  readonly spineAuthor: string;
  readonly publisher?: string;
  readonly edition?: string;
  readonly year?: number;
  readonly isbn?: string;
  /** The book's shelf title: its track label. */
  readonly track: string;
  /** The book's shelf slug (/bookshelf/shelf/<shelfSlug>). */
  readonly shelfSlug: string;
  readonly status: BookStatus;
  readonly summary: string;
  readonly coverSrc: string;
  readonly coverAlt: string;
  readonly url?: string;
  readonly spine: BookSpineTheme;
  readonly topics: readonly BookTopic[];
  /** The book document's `_updatedAt` (ISO 8601). */
  readonly updatedAt: string;
}

/** The initially active book on /bookshelf: the first stage. */
export const DEFAULT_BOOK_INDEX = 0;
