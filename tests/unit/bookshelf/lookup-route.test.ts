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
 * @file The /api/v1/books/lookup route (books/handlers.ts), which the Studio book form calls to
 * fill a book's fields: slug and ISBN normalising, a 400 without a query, Open Library results
 * with a Google Books fallback behind an in-memory cache, and markup and unsafe URLs stripped
 * from the query and the upstream answers. fetch is stubbed, so nothing leaves the process, and
 * every test starts with an empty lookup cache.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { booksRoute } from '@/app/api/v1/[[...route]]/books';
import {
  cleanIsbn,
  lookupBooks,
  resetBookLookupCache,
  toBookSlug,
} from '@/app/api/v1/[[...route]]/books/handlers';

describe('Books Lookup API (/api/v1/books/lookup)', () => {
  beforeEach(() => {
    resetBookLookupCache();
  });

  it('normalizes slugs and ISBN strings cleanly', () => {
    expect(toBookSlug('Designing Data-Intensive Applications!')).toBe(
      'designing-data-intensive-applications',
    );
    expect(cleanIsbn('978-1-09-816630-4')).toBe('9781098166304');
  });

  it('answers 400 when neither q nor isbn is provided', async () => {
    const response = await booksRoute.handle(new Request('http://localhost/books/lookup'));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain('isbn');
  });

  it('normalizes Open Library results and falls back to Google Books when empty', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            docs: [
              {
                key: '/works/OL123W',
                title: 'AI Engineering',
                author_name: ['Chip Huyen'],
                publisher: ["O'Reilly Media"],
                first_publish_year: 2025,
                isbn: ['9781098166304'],
                cover_i: 14625765,
              },
            ],
          }),
          { status: 200 },
        ),
      );

      const olResult = await lookupBooks({ isbn: '978-1098166304' });
      expect(olResult.query).toBe('9781098166304');
      expect(olResult.items).toHaveLength(1);
      expect(olResult.items[0]).toMatchObject({
        title: 'AI Engineering',
        slug: 'ai-engineering',
        authors: 'Chip Huyen',
        coverUrl: 'https://covers.openlibrary.org/b/id/14625765-L.jpg',
        source: 'openlibrary',
      });

      fetchSpy
        .mockResolvedValueOnce(new Response(JSON.stringify({ docs: [] }), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              items: [
                {
                  volumeInfo: {
                    title: 'Designing Data-Intensive Applications',
                    authors: ['Martin Kleppmann'],
                    publisher: "O'Reilly Media",
                    publishedDate: '2017-03-16',
                    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9781449373320' }],
                    imageLinks: { thumbnail: 'http://books.google.com/cover.jpg&edge=curl' },
                    infoLink: 'http://books.google.com/ddia',
                  },
                },
              ],
            }),
            { status: 200 },
          ),
        );

      const gbResult = await lookupBooks({ q: 'Designing Data-Intensive Applications' });
      expect(gbResult.items).toHaveLength(1);
      expect(gbResult.items[0]).toMatchObject({
        title: 'Designing Data-Intensive Applications',
        slug: 'designing-data-intensive-applications',
        authors: 'Martin Kleppmann',
        year: 2017,
        isbn: '9781449373320',
        coverUrl: 'https://books.google.com/cover.jpg',
        source: 'googlebooks',
      });

      // Second identical lookup hits the in-memory cache with zero additional upstream fetches
      const callsBefore = fetchSpy.mock.calls.length;
      const cached = await lookupBooks({ q: 'Designing Data-Intensive Applications' });
      expect(cached.items[0]?.slug).toBe('designing-data-intensive-applications');
      expect(fetchSpy.mock.calls.length).toBe(callsBefore);
    } finally {
      resetBookLookupCache();
      fetchSpy.mockRestore();
    }
  });

  it('sanitizes XSS/HTML and unsafe URLs in book lookup inputs and upstream responses', async () => {
    resetBookLookupCache();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            docs: [
              {
                key: '/works/OL999W',
                title: '<b>Rust</b> in Action\u202E',
                author_name: ['Tim <script>alert(1)</script>McNamara'],
                publisher: ['Manning'],
                first_publish_year: 2021,
                first_sentence: 'A <img src=x onerror=alert(1)>practical guide.',
              },
            ],
          }),
          { status: 200 },
        ),
      );

      const res = await lookupBooks({ q: '<script>alert(1)</script>Rust in Action' });
      expect(res.query).toBe('alert(1)Rust in Action');
      expect(res.items[0]).toMatchObject({
        title: 'Rust in Action',
        authors: 'Tim alert(1)McNamara',
        description: 'A practical guide.',
      });
    } finally {
      resetBookLookupCache();
      fetchSpy.mockRestore();
    }
  });
});
