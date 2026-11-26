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
 * @file The work behind the two books routes (./index.ts wires them):
 * - lookupBooks: book metadata by ISBN or title/author, from Open Library first and Google Books
 *   when Open Library has no match, normalised into records Sanity Studio imports
 *   (src/sanity/schemaTypes/book.ts). Concurrent identical lookups share one request, and found
 *   results are cached in memory for 15 minutes.
 * - readFreeBooksPage: one page of the free programming books catalog (src/lib/free-books), from
 *   the parsed `GET /books/free` query, with unavailable books hidden unless the query says not to.
 */

import { sanitizeUrl } from '@resq-systems/security/sanitize';
import { normaliseQuery } from '@/lib/filters/normalise';
import { buildFreeBooksPageResponse } from '@/lib/free-books/catalog';
import { loadFreeProgrammingBooks } from '@/lib/free-books/loader';
import {
  FREE_BOOKS_DEFAULT_PAGE_SIZE,
  type FreeBookCategorySummary,
  type FreeBookEntry,
  type FreeBookFormat,
  type FreeBookSource,
  type FreeBooksPageResponse,
  type FreeBooksSortDir,
  type FreeBooksSortField,
} from '@/lib/free-books/types';

/** The longest lookup search read: the schema's limit, and the cut for the normalised query. */
export const BOOK_LOOKUP_QUERY_MAX_LENGTH = 120;

interface BookLookupItem {
  readonly title: string;
  readonly slug: string;
  readonly authors: string;
  readonly publisher: string;
  readonly year: number | null;
  readonly isbn: string | null;
  readonly description: string;
  readonly coverUrl: string | null;
  readonly url: string | null;
  readonly source: 'openlibrary' | 'googlebooks';
}

const LOOKUP_TIMEOUT_MS = 6_000;
const LOOKUP_CACHE_TTL_MS = 15 * 60 * 1000;
const LOOKUP_CACHE_MAX_ENTRIES = 200;

interface LookupResult {
  readonly query: string;
  readonly items: BookLookupItem[];
}

const lookupCache = new Map<string, { readonly value: LookupResult; readonly expiresAt: number }>();
const inflightLookups = new Map<string, Promise<LookupResult>>();

function sanitizeExternalUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const httpsUrl = raw.replace(/^http:\/\//, 'https://');
  const safe = sanitizeUrl(httpsUrl, ['https:']);
  return safe || null;
}

/** Clears the in-memory lookup cache and single-flight map (for tests). */
export function resetBookLookupCache(): void {
  lookupCache.clear();
  inflightLookups.clear();
}

export const toBookSlug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

export const cleanIsbn = (raw: string): string => raw.replace(/[^0-9Xx]/g, '').toUpperCase();

interface OpenLibrarySearchDoc {
  readonly key?: string;
  readonly title?: string;
  readonly author_name?: readonly string[];
  readonly publisher?: readonly string[];
  readonly first_publish_year?: number;
  readonly isbn?: readonly string[];
  readonly cover_i?: number;
  readonly first_sentence?: readonly string[] | string;
}

interface GoogleBooksVolume {
  readonly volumeInfo?: {
    readonly title?: string;
    readonly authors?: readonly string[];
    readonly publisher?: string;
    readonly publishedDate?: string;
    readonly description?: string;
    readonly infoLink?: string;
    readonly industryIdentifiers?: readonly {
      readonly type?: string;
      readonly identifier?: string;
    }[];
    readonly imageLinks?: {
      readonly large?: string;
      readonly medium?: string;
      readonly thumbnail?: string;
    };
  };
}

function parseYear(raw?: string | number | null): number | null {
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw !== 'string') return null;
  const match = /\b(1[4-9]\d{2}|20\d{2}|2100)\b/.exec(raw);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function pickIsbn13(isbns?: readonly string[]): string | null {
  if (!isbns || isbns.length === 0) return null;
  const normalized = isbns.map(cleanIsbn).filter((id) => id.length === 13 || id.length === 10);
  return normalized.find((id) => id.length === 13) ?? normalized[0] ?? null;
}

async function fetchJsonWithTimeout<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'mikeodnis-portfolio/1.0 (+https://mikeodnis.dev)',
      },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lookupOpenLibrary(
  query: string,
  limit: number,
  isIsbn: boolean,
): Promise<BookLookupItem[]> {
  const param = isIsbn ? `isbn=${encodeURIComponent(query)}` : `q=${encodeURIComponent(query)}`;
  const url = `https://openlibrary.org/search.json?${param}&limit=${limit}&fields=key,title,author_name,publisher,first_publish_year,isbn,cover_i,first_sentence`;
  const data = await fetchJsonWithTimeout<{ readonly docs?: readonly OpenLibrarySearchDoc[] }>(url);
  if (!data?.docs?.length) return [];

  return data.docs
    .filter((doc): doc is OpenLibrarySearchDoc & { title: string } => Boolean(doc.title?.trim()))
    .slice(0, limit)
    .map((doc) => {
      const isbn = isIsbn ? query : pickIsbn13(doc.isbn);
      const coverUrl = doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
        : isbn
          ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
          : null;
      const sentence = Array.isArray(doc.first_sentence)
        ? (doc.first_sentence[0] ?? '')
        : (doc.first_sentence ?? '');

      const title = normaliseQuery(doc.title, 200);
      return {
        title,
        slug: toBookSlug(title),
        authors: normaliseQuery(doc.author_name?.join(', '), 200) || 'Unknown Author',
        publisher: normaliseQuery(doc.publisher?.[0], 140),
        year: parseYear(doc.first_publish_year),
        isbn,
        description: normaliseQuery(sentence, 320),
        coverUrl: sanitizeExternalUrl(coverUrl),
        url: doc.key ? sanitizeExternalUrl(`https://openlibrary.org${doc.key}`) : null,
        source: 'openlibrary' as const,
      };
    });
}

async function lookupGoogleBooks(
  query: string,
  limit: number,
  isIsbn: boolean,
): Promise<BookLookupItem[]> {
  const qParam = isIsbn ? `isbn:${query}` : query;
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(qParam)}&maxResults=${limit}`;
  const data = await fetchJsonWithTimeout<{ readonly items?: readonly GoogleBooksVolume[] }>(url);
  if (!data?.items?.length) return [];

  return data.items
    .map((item) => item.volumeInfo)
    .filter((info): info is NonNullable<GoogleBooksVolume['volumeInfo']> & { title: string } =>
      Boolean(info?.title?.trim()),
    )
    .slice(0, limit)
    .map((info) => {
      const ids = info.industryIdentifiers ?? [];
      const isbn13 = ids.find((id) => id.type === 'ISBN_13')?.identifier;
      const isbn10 = ids.find((id) => id.type === 'ISBN_10')?.identifier;
      const isbn = isIsbn ? query : (isbn13 ?? isbn10 ?? null);
      const rawThumb =
        info.imageLinks?.large ?? info.imageLinks?.medium ?? info.imageLinks?.thumbnail ?? null;
      const coverUrl = rawThumb
        ? sanitizeExternalUrl(rawThumb.replace('&edge=curl', ''))
        : isbn
          ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
          : null;
      const title = normaliseQuery(info.title, 200);

      return {
        title,
        slug: toBookSlug(title),
        authors: normaliseQuery(info.authors?.join(', '), 200) || 'Unknown Author',
        publisher: normaliseQuery(info.publisher, 140),
        year: parseYear(info.publishedDate),
        isbn,
        description: normaliseQuery(info.description, 320),
        coverUrl,
        url: sanitizeExternalUrl(info.infoLink),
        source: 'googlebooks' as const,
      };
    });
}

/**
 * Looks up books by ISBN or free-text query, trying Open Library first and falling back to
 * Google Books when Open Library returns no matches. Deduplicates concurrent in-flight queries
 * and caches results for 15 minutes in a bounded LRU-like map.
 */
export async function lookupBooks(options: {
  readonly q?: string;
  readonly isbn?: string;
  readonly limit?: number;
}): Promise<LookupResult> {
  const limit = Math.max(1, Math.min(10, options.limit ?? 5));
  const rawIsbn = options.isbn ? cleanIsbn(options.isbn) : '';
  const rawQuery = normaliseQuery(options.q, BOOK_LOOKUP_QUERY_MAX_LENGTH);

  const isIsbn = rawIsbn.length >= 10;
  const query = isIsbn ? rawIsbn : rawQuery;
  if (!query) {
    return { query: '', items: [] };
  }

  const cacheKey = `${isIsbn ? 'isbn' : 'q'}:${query.toLowerCase()}:${limit}`;
  const now = Date.now();
  const cached = lookupCache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    return cached.value;
  }

  const inflight = inflightLookups.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const task = (async (): Promise<LookupResult> => {
    try {
      const fromOpenLibrary = await lookupOpenLibrary(query, limit, isIsbn);
      const result: LookupResult =
        fromOpenLibrary.length > 0
          ? { query, items: fromOpenLibrary }
          : { query, items: await lookupGoogleBooks(query, limit, isIsbn) };

      if (result.items.length > 0) {
        if (lookupCache.size >= LOOKUP_CACHE_MAX_ENTRIES) {
          const oldestKey = lookupCache.keys().next().value;
          if (oldestKey !== undefined) lookupCache.delete(oldestKey);
        }
        lookupCache.set(cacheKey, { value: result, expiresAt: Date.now() + LOOKUP_CACHE_TTL_MS });
      }
      return result;
    } finally {
      inflightLookups.delete(cacheKey);
    }
  })();

  inflightLookups.set(cacheKey, task);
  return task;
}

/** The parsed `GET /books/free` query (booksSchema's 'books.free.query'). */
interface FreeBooksPageQuery {
  readonly source?: 'all' | FreeBookSource;
  readonly category?: string;
  readonly format?: 'all' | FreeBookFormat;
  readonly q?: string;
  readonly sort?: FreeBooksSortField;
  readonly dir?: FreeBooksSortDir;
  readonly hideArchived?: boolean;
  readonly hideInProcess?: boolean;
  readonly hideUnavailable?: boolean;
  readonly httpsOnly?: boolean;
  readonly verifiedHostsOnly?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

/** A page as the route sends it: the same fields, with the mutable arrays Elysia's types expect. */
type FreeBooksPageBody = Omit<FreeBooksPageResponse, 'categories' | 'items'> & {
  readonly categories: FreeBookCategorySummary[];
  readonly items: (Omit<FreeBookEntry, 'formats'> & { readonly formats: FreeBookFormat[] })[];
};

/**
 * One page of the free books catalog for `GET /books/free`. Unavailable books are hidden unless
 * `hideUnavailable=false`; with no limit the page has FREE_BOOKS_DEFAULT_PAGE_SIZE rows.
 */
export async function readFreeBooksPage(query: FreeBooksPageQuery): Promise<FreeBooksPageBody> {
  const catalog = await loadFreeProgrammingBooks();
  const page = buildFreeBooksPageResponse(catalog, {
    source: query.source,
    category: query.category,
    format: query.format,
    q: query.q,
    sort: query.sort,
    dir: query.dir,
    hideArchived: query.hideArchived,
    hideInProcess: query.hideInProcess,
    hideUnavailable: query.hideUnavailable ?? true,
    httpsOnly: query.httpsOnly,
    verifiedHostsOnly: query.verifiedHostsOnly,
    limit: query.limit ?? FREE_BOOKS_DEFAULT_PAGE_SIZE,
    offset: query.offset ?? 0,
  });
  return {
    ...page,
    categories: [...page.categories],
    items: page.items.map((item) => ({ ...item, formats: [...item.formats] })),
  };
}
