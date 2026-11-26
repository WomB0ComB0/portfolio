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
 * @file The one way the site reads the bookshelf. The /bookshelf list, a book's page, a shelf's
 * page, their metadata, the sitemap and the link-health catalog all read through
 * loadBookshelfCatalog, which wraps the shared Sanity cache's one bookshelf snapshot
 * (loadBookshelf: every book and every shelf from one query) and adds no request.
 *
 * It joins each `book` document to its `bookshelf` (by `shelfId`), orders the books by shelf order
 * and then book order, numbers stages and topics continuously across shelves, builds each cover's
 * Sanity CDN URL and gives each book a Live Console spine by its position.
 *
 * There is no built-in catalog to fall back to: Sanity is the only source. When Sanity fails with
 * nothing cached the load rejects, and src/app/(routes)/error.tsx shows the error inside the
 * shell; an empty dataset gives an empty catalog, which /bookshelf renders as its empty state; an
 * unknown slug is a 404 (notFound()).
 */

import { cache } from 'react';
import { ensureBaseError } from '@/classes/error';
import { reportApiFailure } from '@/lib/observability/report';
import { urlFor } from '@/lib/sanity/client';
import { loadBookshelf, type SanityBook, type SanityBookshelf } from '@/lib/sanity/loaders';
import {
  type BookItem,
  type BookNeighbor,
  COVER_HEIGHT,
  COVER_WIDTH,
  getLiveConsoleSpineTheme,
  neighborsOf,
  type ShelfCollection,
  toBookNeighbor,
} from './books';

export interface BookshelfCatalog {
  /** Every book on a published shelf, in stage order (shelf order, then book order). */
  readonly books: readonly BookItem[];
  /** Every shelf with at least one book, in shelf order. */
  readonly shelves: readonly ShelfCollection[];
  readonly totalTopics: number;
}

/** A list with at least one book: what the bookshelf's client islands take. */
export type NonEmptyBooks = readonly [BookItem, ...BookItem[]];

/** True when `books` holds at least one book, narrowing it for the client islands. */
export const hasBooks = (books: readonly BookItem[]): books is NonEmptyBooks => books.length > 0;

/** Groups the orphaned-book warning in Sentry (one event per cooldown window). */
const REPORT_CONTEXT = 'bookshelf catalog';

/** A trimmed optional Studio text, or undefined when it is missing or blank. */
const optionalText = (value: string | null | undefined): string | undefined =>
  value?.trim() || undefined;

/** The spine's short author: Studio's spineAuthor, else the first author's surname in capitals. */
const spineAuthorOf = (doc: SanityBook): string =>
  doc.spineAuthor?.trim() ||
  doc.authors.split(/[,&]/)[0]?.trim().split(/\s+/).at(-1)?.toUpperCase() ||
  'AUTHOR';

/**
 * The cover on Sanity's CDN at its source size (COVER_WIDTH x COVER_HEIGHT), in the best format
 * the browser accepts; the islands draw smaller copies of it with coverAt. The covers are 520x680
 * portraits, so for them the crop is a no-op resize; a cover of another shape is cropped to it
 * around its hotspot. The URL builder throws on a reference that is not an image asset;
 * BookSchema drops such a book when it is decoded (isBookCoverRef), so one bad cover never
 * reaches here to fail the whole catalog.
 */
const coverSrcOf = (doc: SanityBook): string =>
  urlFor(doc.coverImage).width(COVER_WIDTH).height(COVER_HEIGHT).fit('crop').auto('format').url();

/**
 * One book as the bookshelf renders it, at zero-based `index` in stage order, with its topics
 * numbered from `firstTopic`. Optional facts Studio leaves empty stay undefined: the UI renders
 * them only when present.
 */
function toBookItem(
  doc: SanityBook,
  shelf: SanityBookshelf,
  index: number,
  firstTopic: number,
): BookItem {
  const stage = index + 1;
  const topicTitles = (doc.topics ?? []).map((title) => title.trim()).filter(Boolean);
  return {
    slug: doc.slug.current,
    stage,
    stageLabel: String(stage).padStart(2, '0'),
    title: doc.title,
    spineTitle: doc.spineTitle?.trim() || doc.title,
    authors: doc.authors,
    spineAuthor: spineAuthorOf(doc),
    publisher: optionalText(doc.publisher),
    edition: optionalText(doc.edition),
    year: doc.year ?? undefined,
    isbn: optionalText(doc.isbn),
    track: shelf.title,
    shelfSlug: shelf.slug.current,
    status: doc.status,
    summary: doc.summary,
    coverSrc: coverSrcOf(doc),
    coverAlt: doc.coverImage.alt?.trim() || `${doc.title} by ${doc.authors}`,
    url: optionalText(doc.url),
    spine: getLiveConsoleSpineTheme(index),
    topics: topicTitles.map((title, offset) => ({ number: firstTopic + offset, title })),
    updatedAt: doc._updatedAt,
  };
}

/** One shelf section with its books (already in stage order). */
function toShelfCollection(shelf: SanityBookshelf, books: readonly BookItem[]): ShelfCollection {
  const count = books.length;
  return {
    slug: shelf.slug.current,
    title: shelf.title,
    description: shelf.description?.trim() || `${count} curated ${count === 1 ? 'book' : 'books'}.`,
    bookSlugs: books.map((book) => book.slug),
    updatedAt: shelf._updatedAt,
  };
}

/**
 * One warning for the books whose shelf is not among the published shelves (deleted, or never
 * published). They are left off the bookshelf: without its shelf a book has no place in the
 * order and no track label.
 */
function reportOrphans(orphans: readonly SanityBook[]): void {
  if (orphans.length === 0) return;
  const count = orphans.length;
  const summary = `${count} ${count === 1 ? 'book references' : 'books reference'} no published shelf`;
  reportApiFailure(
    ensureBaseError(new Error(summary), 'bookshelf:catalog', {
      books: orphans.map((doc) => doc.slug.current),
    }),
    { context: REPORT_CONTEXT, level: 'warning' },
  );
}

/**
 * The bookshelf from Sanity's decoded `book` and `bookshelf` documents, in the order the queries
 * answer them (shelves by order, then creation; books by order, then creation).
 *
 * - A book whose `shelfId` names no loaded shelf is dropped, and the drops are reported in one
 *   warning.
 * - Books are ordered by their shelf's position (a stable sort, so each shelf keeps its books'
 *   order), then numbered: stage = position + 1, and topics continuously from 1.
 * - A shelf with no books is left out.
 */
export function buildBookshelfCatalog(
  bookDocs: readonly SanityBook[],
  shelfDocs: readonly SanityBookshelf[],
): BookshelfCatalog {
  const rankById = new Map(shelfDocs.map((shelf, rank) => [shelf._id, rank]));
  const placed = bookDocs.flatMap((doc) => {
    const rank = rankById.get(doc.shelfId);
    const shelf = rank === undefined ? undefined : shelfDocs[rank];
    return shelf === undefined || rank === undefined ? [] : [{ doc, shelf, rank }];
  });
  reportOrphans(bookDocs.filter((doc) => !rankById.has(doc.shelfId)));

  const ordered = [...placed].sort((a, b) => a.rank - b.rank);
  let nextTopic = 1;
  const entries = ordered.map(({ doc, shelf }, index) => {
    const book = toBookItem(doc, shelf, index, nextTopic);
    nextTopic += book.topics.length;
    return { shelfId: shelf._id, book };
  });

  const books = entries.map((entry) => entry.book);
  const shelves = shelfDocs.flatMap((shelf) => {
    const shelfBooks = entries
      .filter((entry) => entry.shelfId === shelf._id)
      .map((entry) => entry.book);
    return shelfBooks.length === 0 ? [] : [toShelfCollection(shelf, shelfBooks)];
  });

  return { books, shelves, totalTopics: nextTopic - 1 };
}

/**
 * The bookshelf catalog, built from one snapshot: the books and the shelves come from the same
 * query and the same cache entry, so a book moved to a newly published shelf always arrives with
 * that shelf, and while a reload fails both lists are the last good snapshot. React-cache()d per
 * request, so a page's metadata and its render share one load and one mapping pass. Rejects when
 * the snapshot does (Sanity down with nothing cached).
 */
export const loadBookshelfCatalog = cache(async (): Promise<BookshelfCatalog> => {
  const { books, shelves } = await loadBookshelf();
  return buildBookshelfCatalog(books, shelves);
});

/** A book found by its slug: the book, its stage neighbours and the catalog it sits in. */
export interface CatalogBookHit {
  readonly book: BookItem;
  /**
   * The books before and after it in stage order, wrapping round both ends (the first book's
   * previous is the last), as only the Previous and Next links name them.
   */
  readonly prev: BookNeighbor;
  readonly next: BookNeighbor;
  readonly catalog: BookshelfCatalog;
}

/** The book with this slug, its neighbours and its catalog, or null when no book has the slug. */
export async function loadCatalogBookBySlug(slug: string): Promise<CatalogBookHit | null> {
  const catalog = await loadBookshelfCatalog();
  const index = catalog.books.findIndex((item) => item.slug === slug);
  const book = catalog.books[index];
  if (!book || !hasBooks(catalog.books)) return null;
  const { prev, next } = neighborsOf(catalog.books, index);
  return { book, prev: toBookNeighbor(prev), next: toBookNeighbor(next), catalog };
}

/** The shelf with this slug, its books in stage order and the catalog, or null when none has it. */
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
