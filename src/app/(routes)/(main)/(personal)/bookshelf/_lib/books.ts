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
 * helpers (status meta, the Live Console spine palette, ISBN registry links, the slim reading-map
 * and Previous/Next shapes, and covers sized to how they are drawn). It holds no catalog
 * content: books and shelves come only from Sanity, through the loader, and reach client islands
 * as props. Server- and client-safe.
 */

import { cdnImageLoader } from '@/lib/images/cdn-loader';
import { BOOK_STATUS_LABELS, type BookStatus, normalizeIsbn } from '@/sanity/bookshelf-rules';

export { BOOK_STATUSES, type BookStatus, normalizeIsbn } from '@/sanity/bookshelf-rules';

/** A resized cover's quality: the CDN loader's own default. */
const COVER_QUALITY = 75;

/**
 * One shelf filter chip on /bookshelf: the shelf's slug is its identity (`?shelf=<slug>`), its
 * title only the chip's label. "All" is no chip value: it is the reset, a null filter.
 */
export interface ShelfTab {
  readonly slug: string;
  readonly title: string;
  /** The shelf's books on the stage. */
  readonly count: number;
}

/** One chip per shelf on the stage, in stage order (shelf order), each with its book count. */
export function buildShelfTabs(books: readonly BookItem[]): readonly ShelfTab[] {
  const tabs = new Map<string, { readonly title: string; count: number }>();
  for (const book of books) {
    const tab = tabs.get(book.shelfSlug);
    if (tab) tab.count += 1;
    else tabs.set(book.shelfSlug, { title: book.track, count: 1 });
  }
  return [...tabs].map(([slug, { title, count }]) => ({ slug, title, count }));
}

/**
 * The shelf filter the URL names, as the slug of a shelf on the stage, or null for none ("All").
 * In order: `?shelf=<slug>` when that slug is on the stage; else a legacy `?track=<title>` link
 * (the filter before slugs) mapped to the slug of the one shelf with exactly that title; else a
 * slug typed into `?track=`. Anything else is no filter, a title two shelves share included: a
 * value from the URL is never used unless it names a shelf on the stage.
 */
export function resolveShelfFilter(
  shelfParam: string | null,
  trackParam: string | null,
  tabs: readonly ShelfTab[],
): string | null {
  if (shelfParam !== null && tabs.some((tab) => tab.slug === shelfParam)) return shelfParam;
  if (trackParam === null) return null;
  const titled = tabs.filter((tab) => tab.title === trackParam);
  if (titled.length === 1) return titled[0]?.slug ?? null;
  // A title two shelves share is ambiguous: no filter, even if one of them has it as its slug.
  if (titled.length > 1) return null;
  return tabs.some((tab) => tab.slug === trackParam) ? trackParam : null;
}

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
  /** The book's shelf title: its track label, never its identity (that is `shelfSlug`). */
  readonly track: string;
  /** The book's shelf slug (/bookshelf/shelf/<shelfSlug>, and the `?shelf=` filter). */
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

/**
 * One book as the reading map lists it: what the map draws and nothing more, so a page that
 * shows one book (/bookshelf/[slug]) maps the whole catalog for about a sixth of its bytes.
 */
export interface ReadingMapEntry {
  readonly slug: string;
  readonly title: string;
  readonly authors: string;
  readonly stageLabel: string;
  readonly status: BookStatus;
  readonly topicCount: number;
  /**
   * The number of the book's first topic, absent when it has none. A book's topics are numbered
   * in one run (buildBookshelfCatalog), so its last is `firstTopic + topicCount - 1`.
   */
  readonly firstTopic?: number;
}

/** A book's reading-map entry. */
export function toReadingMapEntry(book: BookItem): ReadingMapEntry {
  const firstTopic = book.topics[0]?.number;
  return {
    slug: book.slug,
    title: book.title,
    authors: book.authors,
    stageLabel: book.stageLabel,
    status: book.status,
    topicCount: book.topics.length,
    ...(firstTopic === undefined ? {} : { firstTopic }),
  };
}

/** The number of an entry's last topic, or undefined when it has none. */
export const lastTopicOf = (entry: ReadingMapEntry): number | undefined =>
  entry.firstTopic === undefined ? undefined : entry.firstTopic + entry.topicCount - 1;

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
export function neighborsOf<T>(
  books: readonly [T, ...T[]],
  index: number,
): { readonly prev: T; readonly next: T } {
  const count = books.length;
  const at = (offset: number): T => books[(((index + offset) % count) + count) % count] ?? books[0];
  return { prev: at(-1), next: at(1) };
}

/** Every cover's source size: the catalog crops each cover to 520 x 680 (load-bookshelf.ts). */
export const COVER_WIDTH = 520;
export const COVER_HEIGHT = 680;

/**
 * The cover `width` px wide, through the site's Sanity CDN loader: it keeps the crop window, so
 * the 520 x 680 shape, and never goes past the source width. At the source width or wider the
 * source URL comes back as it is, so the URL the stage has already loaded stays the cached one.
 */
export function coverAt(src: string, width: number): string {
  if (width >= COVER_WIDTH) return src;
  return cdnImageLoader({ src, width: Math.max(1, Math.round(width)), quality: COVER_QUALITY });
}
