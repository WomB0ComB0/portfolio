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
 * @file `GET /api/v1/books/free` (books/index.ts and readFreeBooksPage): the catalog loaded from
 * both upstream lists (fetch stubbed) and answered as one filtered page.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { booksRoute } from '@/app/api/v1/[[...route]]/books';
import { resetFreeProgrammingBooksCache } from '@/lib/free-books/loader';
import { SAMPLE_LANGS_MD, SAMPLE_SUBJECTS_MD } from './free-books-fixture';

describe('GET /api/v1/books/free', () => {
  beforeEach(() => {
    resetFreeProgrammingBooksCache();
  });

  it('serves paginated filtered results from GET /api/v1/books/free', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      fetchSpy
        .mockResolvedValueOnce(new Response(SAMPLE_LANGS_MD, { status: 200 }))
        .mockResolvedValueOnce(new Response(SAMPLE_SUBJECTS_MD, { status: 200 }));

      const res = await booksRoute.handle(
        new Request('http://localhost/books/free?source=langs&format=PDF&hideArchived=true'),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        totalCatalogBooks: number;
        totalMatched: number;
        items: Array<{ title: string }>;
      };
      expect(body.totalCatalogBooks).toBe(7);
      expect(body.totalMatched).toBe(2);
      expect(body.items.map((item) => item.title)).toEqual([
        'The Rust Programming Language',
        'TypeScript Deep Dive',
      ]);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
