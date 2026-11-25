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

import 'server-only';

/**
 * @file Dynamic server-side Bookshelf catalog loader.
 * Reads `book` and `bookshelf` documents from Sanity through the shared stale-on-error cache
 * (`loadBooks`, `loadBookshelves`), resolving Sanity image assets and continuous topic numbering.
 * Falls back cleanly to the built-in 14-book / 4-shelf engineering catalog when Sanity has no
 * published books yet or is unavailable, so `/bookshelf` always renders rich content immediately.
 */

import { urlFor } from '@/lib/sanity/client';
import {
  loadBooks,
  loadBookshelves,
  type SanityBook,
  type SanityBookshelf,
} from '@/lib/sanity/loaders';
import {
  BOOKS,
  type BookItem,
  type BookSpineTheme,
  type BookTrack,
  DEFAULT_SHELVES,
  normalizeBookStatus,
  type ShelfCollection,
  slugifyShelf,
} from './books';

export interface BookshelfCatalog {
  readonly source: 'sanity' | 'fallback';
  readonly books: readonly BookItem[];
  readonly shelves: readonly ShelfCollection[];
  readonly totalTopics: number;
}

const DEFAULT_SPINE_PALETTES: readonly [BookSpineTheme, ...BookSpineTheme[]] = [
  {
    capBg: '#3b82f6',
    capText: '#f8fafc',
    bodyBg: '#181c26',
    titleColor: '#f1f5f9',
    authorColor: '#94a3b8',
    borderTint: 'rgba(148, 163, 184, 0.22)',
  },
  {
    capBg: '#dc2626',
    capText: '#ffffff',
    bodyBg: '#f4f4f6',
    titleColor: '#111827',
    authorColor: '#4b5563',
    borderTint: 'rgba(17, 24, 39, 0.14)',
  },
  {
    capBg: '#84cc16',
    capText: '#14260a',
    bodyBg: '#273152',
    titleColor: '#f8fafc',
    authorColor: '#cbd5e1',
    borderTint: 'rgba(203, 213, 225, 0.2)',
  },
  {
    capBg: '#6b4c3b',
    capText: '#fef3c7',
    bodyBg: '#f4f4f6',
    titleColor: '#111827',
    authorColor: '#4b5563',
    borderTint: 'rgba(17, 24, 39, 0.14)',
  },
];

const TRACK_ACCENTS: Readonly<Record<string, string>> = {
  Foundations: '#3987e5',
  Backend: '#d95926',
  'Infra & Ops': '#199e70',
  AI: '#8884d5',
  'Reasoning & Systems': '#8884d5',
  'Mind & Society': '#d55181',
  'History & Economics': '#c98500',
  'Power & Institutions': '#3987e5',
  Startups: '#c98500',
  Design: '#d55181',
};

function resolveCoverSrc(doc: SanityBook): string {
  if (doc.coverImage?.asset?._ref) {
    try {
      return urlFor(doc.coverImage).width(520).height(680).fit('crop').auto('format').url();
    } catch {
      // Fall through to explicit coverUrl or local fallback path.
    }
  }
  if (doc.coverUrl?.trim()) return doc.coverUrl.trim();
  return `/assets/bookshelf/${doc.slug.current}.webp`;
}

function resolveSpine(doc: SanityBook, index: number): BookSpineTheme {
  const fallback =
    DEFAULT_SPINE_PALETTES[index % DEFAULT_SPINE_PALETTES.length] ?? DEFAULT_SPINE_PALETTES[0];
  return {
    capBg: doc.spine?.capBg?.trim() || fallback.capBg,
    capText: doc.spine?.capText?.trim() || fallback.capText,
    bodyBg: doc.spine?.bodyBg?.trim() || fallback.bodyBg,
    titleColor: doc.spine?.titleColor?.trim() || fallback.titleColor,
    authorColor: doc.spine?.authorColor?.trim() || fallback.authorColor,
    borderTint: fallback.borderTint,
  };
}

function mapSanityBooks(docs: readonly SanityBook[]): BookItem[] {
  let topicCounter = 1;
  return docs.map((doc, index) => {
    const stage = index + 1;
    const rawTopics = (doc.topics ?? []).map((t) => t.trim()).filter(Boolean);
    const topics = rawTopics.map((title) => ({ number: topicCounter++, title }));
    const shortAuthor =
      doc.spineAuthor?.trim() ||
      doc.authors.split(/[,&]/)[0]?.trim().split(/\s+/).at(-1)?.toUpperCase() ||
      'AUTHOR';

    return {
      slug: doc.slug.current,
      stage,
      stageLabel: String(stage).padStart(2, '0'),
      title: doc.title,
      spineTitle: doc.spineTitle?.trim() || doc.title,
      authors: doc.authors,
      spineAuthor: shortAuthor,
      publisher: doc.publisher?.trim() || 'Independent',
      edition: doc.edition?.trim() || 'Standard Edition',
      year: doc.year ?? new Date().getUTCFullYear(),
      isbn: doc.isbn?.trim() || 'N/A',
      track: (doc.track.trim() || 'General') as BookTrack,
      status: normalizeBookStatus(doc.status),
      summary: doc.summary,
      coverSrc: resolveCoverSrc(doc),
      url: doc.url?.trim() || `https://openlibrary.org/search?q=${encodeURIComponent(doc.title)}`,
      spine: resolveSpine(doc, index),
      topics,
    };
  });
}

function buildShelvesFromTracks(books: readonly BookItem[]): ShelfCollection[] {
  const groups = new Map<string, BookItem[]>();
  for (const book of books) {
    const existing = groups.get(book.track);
    if (existing) existing.push(book);
    else groups.set(book.track, [book]);
  }
  return [...groups.entries()].map(([track, items]) => ({
    slug: slugifyShelf(track),
    title: track,
    description: `${items.length} curated ${items.length === 1 ? 'book' : 'books'} in ${track}.`,
    accentColor: TRACK_ACCENTS[track] ?? '#8884d5',
    bookSlugs: items.map((book) => book.slug),
  }));
}

function mapSanityShelves(
  docs: readonly SanityBookshelf[],
  booksBySlug: ReadonlyMap<string, BookItem>,
  allBooks: readonly BookItem[],
): ShelfCollection[] {
  const mapped: ShelfCollection[] = [];
  for (const shelf of docs) {
    const slugs = (shelf.books ?? [])
      .map((book) => book.slug.current)
      .filter((slug) => booksBySlug.has(slug));
    if (slugs.length === 0) continue;
    mapped.push({
      slug: shelf.slug.current,
      title: shelf.title,
      description:
        shelf.description?.trim() ||
        `${slugs.length} curated ${slugs.length === 1 ? 'book' : 'books'}.`,
      accentColor: shelf.accentColor?.trim() || TRACK_ACCENTS[shelf.title] || '#8884d5',
      bookSlugs: slugs,
    });
  }
  return mapped.length > 0 ? mapped : buildShelvesFromTracks(allBooks);
}

/**
 * Loads the dynamic Bookshelf catalog from Sanity, falling back to the built-in 14-book / 4-shelf
 * engineering catalog when Sanity has no published book documents yet.
 */
export async function loadBookshelfCatalog(): Promise<BookshelfCatalog> {
  try {
    const [rawBooks, rawShelves] = await Promise.all([loadBooks(), loadBookshelves()]);
    if (rawBooks.length > 0) {
      const books = mapSanityBooks(rawBooks);
      const bySlug = new Map(books.map((book) => [book.slug, book]));
      const shelves = mapSanityShelves(rawShelves, bySlug, books);
      const totalTopics = books.reduce((sum, book) => sum + book.topics.length, 0);
      return { source: 'sanity', books, shelves, totalTopics };
    }
  } catch {
    // Graceful fallback keeps /bookshelf operational if Sanity credentials or dataset docs are absent.
  }

  return {
    source: 'fallback',
    books: BOOKS,
    shelves: DEFAULT_SHELVES,
    totalTopics: BOOKS.reduce((sum, book) => sum + book.topics.length, 0),
  };
}

export async function loadCatalogBookBySlug(
  slug: string,
): Promise<{ readonly book: BookItem; readonly catalog: BookshelfCatalog } | null> {
  const catalog = await loadBookshelfCatalog();
  const book = catalog.books.find((item) => item.slug === slug);
  return book ? { book, catalog } : null;
}

export async function loadCatalogShelfBySlug(shelfSlug: string): Promise<{
  readonly shelf: ShelfCollection;
  readonly books: readonly BookItem[];
  readonly catalog: BookshelfCatalog;
} | null> {
  const catalog = await loadBookshelfCatalog();
  const shelf = catalog.shelves.find((item) => item.slug === shelfSlug);
  if (!shelf) return null;
  const bySlug = new Map(catalog.books.map((book) => [book.slug, book]));
  const books = shelf.bookSlugs
    .map((slug) => bySlug.get(slug))
    .filter((book): book is BookItem => Boolean(book));
  return { shelf, books, catalog };
}
