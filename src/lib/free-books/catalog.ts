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
 * @file The catalog maths: builds the catalog and its category counts from parsed entries, and
 * answers one page of it (filter, sort, slice). Pure and isomorphic. free/page.tsx and
 * `GET /api/v1/books/free` (books/handlers.ts) call it with the catalog loader.ts returns. Guarded
 * by tests/unit/free-books/catalog.test.ts.
 */

import { DEFAULT_QUERY_MAX_LENGTH, normaliseQuery } from '@/lib/filters/normalise';
import {
  EBOOK_FOUNDATION_REPO_URL,
  FREE_BOOKS_DEFAULT_PAGE_SIZE,
  FREE_BOOKS_MAX_PAGE_SIZE,
  type FreeBookCategorySummary,
  type FreeBookEntry,
  type FreeBooksFilterOptions,
  type FreeBooksPageResponse,
  type FreeBooksSortDir,
  type FreeBooksSortField,
  type FreeProgrammingBooksCatalog,
  type ManifestSource,
} from './types';

export function buildFreeProgrammingBooksCatalog(
  langsBooks: readonly FreeBookEntry[],
  subjectsBooks: readonly FreeBookEntry[],
  fetchedAt = new Date().toISOString(),
  options: {
    readonly quarantinedCount?: number;
    readonly securityCheckedAt?: string | null;
    readonly manifestSource?: ManifestSource;
  } = {},
): FreeProgrammingBooksCatalog {
  const books = [...langsBooks, ...subjectsBooks];
  const categoryCounts = new Map<string, FreeBookCategorySummary>();

  for (const book of books) {
    const key = `${book.source}::${book.category}`;
    const existing = categoryCounts.get(key);
    if (existing) {
      categoryCounts.set(key, { ...existing, count: existing.count + 1 });
    } else {
      categoryCounts.set(key, { name: book.category, source: book.source, count: 1 });
    }
  }

  const categories = [...categoryCounts.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );

  return {
    fetchedAt,
    repoUrl: EBOOK_FOUNDATION_REPO_URL,
    license: 'CC BY 4.0',
    totalBooks: books.length,
    langsCount: langsBooks.length,
    subjectsCount: subjectsBooks.length,
    languageCategoriesCount: categories.filter((c) => c.source === 'langs').length,
    subjectCategoriesCount: categories.filter((c) => c.source === 'subjects').length,
    pdfCount: books.filter((b) => b.formats.includes('PDF')).length,
    quarantinedCount: options.quarantinedCount ?? 0,
    unavailableCount: books.filter((b) => b.unavailable).length,
    securityCheckedAt: options.securityCheckedAt ?? null,
    manifestSource: options.manifestSource ?? 'bundled',
    categories,
    books,
  };
}

/** Pre-indexed lowercase search haystacks keyed by entry object (zero JSON payload overhead). */
const bookSearchIndex = new WeakMap<FreeBookEntry, string>();

function getBookSearchHaystack(book: FreeBookEntry): string {
  const cached = bookSearchIndex.get(book);
  if (cached !== undefined) return cached;
  const indexed =
    `${book.title} ${book.authors} ${book.category} ${book.subcategory ?? ''} ${book.host}`.toLowerCase();
  bookSearchIndex.set(book, indexed);
  return indexed;
}

export function filterFreeProgrammingBooks(
  books: readonly FreeBookEntry[],
  options: FreeBooksFilterOptions,
): FreeBookEntry[] {
  const source = options.source ?? 'all';
  const category = normaliseQuery(options.category, DEFAULT_QUERY_MAX_LENGTH).toLowerCase();
  const format = options.format ?? 'all';
  const cleanQuery = normaliseQuery(options.q, DEFAULT_QUERY_MAX_LENGTH).toLowerCase();
  const queryTokens = cleanQuery ? cleanQuery.split(' ').filter(Boolean) : [];
  const hideArchived = options.hideArchived ?? false;
  const hideInProcess = options.hideInProcess ?? false;
  const hideUnavailable = options.hideUnavailable ?? false;
  const httpsOnly = options.httpsOnly ?? false;
  const verifiedHostsOnly = options.verifiedHostsOnly ?? false;

  return books.filter((book) => {
    if (source !== 'all' && book.source !== source) return false;
    if (category && category !== 'all' && book.category.toLowerCase() !== category) return false;
    if (format !== 'all' && !book.formats.includes(format)) return false;
    if (hideArchived && book.archived) return false;
    if (hideInProcess && book.inProcess) return false;
    if (hideUnavailable && book.unavailable) return false;
    if (httpsOnly && book.insecureTransport) return false;
    if (verifiedHostsOnly && book.trustTier !== 'verified') return false;
    if (queryTokens.length > 0) {
      const haystack = getBookSearchHaystack(book);
      for (const token of queryTokens) {
        if (!haystack.includes(token)) return false;
      }
    }
    return true;
  });
}

/** Sorts a copy by title, by category then title, or by host (verified hosts first) then title. */
function sortFreeProgrammingBooks(
  books: readonly FreeBookEntry[],
  sort: FreeBooksSortField = 'title',
  dir: FreeBooksSortDir = 'asc',
): FreeBookEntry[] {
  const mult = dir === 'asc' ? 1 : -1;
  return [...books].sort((a, b) => {
    let cmp = 0;
    if (sort === 'category') {
      cmp =
        a.category.localeCompare(b.category, undefined, { sensitivity: 'base' }) ||
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    } else if (sort === 'host') {
      cmp =
        (a.trustTier === b.trustTier ? 0 : a.trustTier === 'verified' ? -1 : 1) ||
        a.host.localeCompare(b.host, undefined, { sensitivity: 'base' }) ||
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    } else {
      cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    }
    return cmp * mult;
  });
}

/** Filters, sorts, and slices a single paginated response shared by SSR and `GET /api/v1/books/free`. */
export function buildFreeBooksPageResponse(
  catalog: FreeProgrammingBooksCatalog,
  options: FreeBooksFilterOptions & {
    readonly sort?: FreeBooksSortField;
    readonly dir?: FreeBooksSortDir;
    readonly limit?: number;
    readonly offset?: number;
  } = {},
): FreeBooksPageResponse {
  const filtered = filterFreeProgrammingBooks(catalog.books, options);
  const sorted = sortFreeProgrammingBooks(filtered, options.sort ?? 'title', options.dir ?? 'asc');
  const limit = Math.min(
    Math.max(1, options.limit ?? FREE_BOOKS_DEFAULT_PAGE_SIZE),
    FREE_BOOKS_MAX_PAGE_SIZE,
  );
  const offset = Math.max(0, options.offset ?? 0);
  const items = sorted.slice(offset, offset + limit).map((item) => ({
    ...item,
    formats: [...item.formats],
  }));

  return {
    fetchedAt: catalog.fetchedAt,
    repoUrl: catalog.repoUrl,
    license: catalog.license,
    totalCatalogBooks: catalog.totalBooks,
    langsCount: catalog.langsCount,
    subjectsCount: catalog.subjectsCount,
    languageCategoriesCount: catalog.languageCategoriesCount,
    subjectCategoriesCount: catalog.subjectCategoriesCount,
    pdfCount: catalog.pdfCount,
    totalMatched: sorted.length,
    quarantinedCount: catalog.quarantinedCount,
    unavailableCount: catalog.unavailableCount,
    securityCheckedAt: catalog.securityCheckedAt,
    manifestSource: catalog.manifestSource,
    limit,
    offset,
    categories: [...catalog.categories],
    items,
  };
}
