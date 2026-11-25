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
 * @file Book metadata lookup via Open Library (primary) with Google Books fallback.
 * Normalizes ISBN or title/author search queries into ready-to-import book records for Sanity
 * Studio and dynamic shelf previews.
 */

export interface BookLookupItem {
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

      return {
        title: doc.title.trim(),
        slug: toBookSlug(doc.title),
        authors: doc.author_name?.join(', ') || 'Unknown Author',
        publisher: doc.publisher?.[0] ?? '',
        year: parseYear(doc.first_publish_year),
        isbn,
        description: sentence.trim(),
        coverUrl,
        url: doc.key ? `https://openlibrary.org${doc.key}` : null,
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
        ? rawThumb.replace(/^http:\/\//, 'https://').replace('&edge=curl', '')
        : isbn
          ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
          : null;

      return {
        title: info.title.trim(),
        slug: toBookSlug(info.title),
        authors: info.authors?.join(', ') || 'Unknown Author',
        publisher: info.publisher ?? '',
        year: parseYear(info.publishedDate),
        isbn,
        description: (info.description ?? '').trim().slice(0, 320),
        coverUrl,
        url: info.infoLink?.replace(/^http:\/\//, 'https://') ?? null,
        source: 'googlebooks' as const,
      };
    });
}

/**
 * Looks up books by ISBN or free-text query, trying Open Library first and falling back to
 * Google Books when Open Library returns no matches.
 */
export async function lookupBooks(options: {
  readonly q?: string;
  readonly isbn?: string;
  readonly limit?: number;
}): Promise<{ readonly query: string; readonly items: BookLookupItem[] }> {
  const limit = Math.max(1, Math.min(10, options.limit ?? 5));
  const rawIsbn = options.isbn ? cleanIsbn(options.isbn) : '';
  const rawQuery = options.q?.trim() ?? '';

  const isIsbn = rawIsbn.length >= 10;
  const query = isIsbn ? rawIsbn : rawQuery;
  if (!query) {
    return { query: '', items: [] };
  }

  const fromOpenLibrary = await lookupOpenLibrary(query, limit, isIsbn);
  if (fromOpenLibrary.length > 0) {
    return { query, items: fromOpenLibrary };
  }

  const fromGoogle = await lookupGoogleBooks(query, limit, isIsbn);
  return { query, items: fromGoogle };
}
