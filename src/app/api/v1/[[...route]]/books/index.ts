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
 * @file The /api/v1/books routes; ./handlers.ts does the work and this file wires it.
 *
 * GET /books/lookup, book metadata for filling in a book document (the ISBN field in
 * src/sanity/schemaTypes/book.ts points here):
 * 1. the query schema (./schema.ts): q up to 120 characters, isbn up to 32, limit 1 to 10;
 * 2. a q that is not blank once normalised, or an isbn, else 400;
 * 3. lookupBooks, answered with the 24-hour edge cache headers.
 * GET /books/free, one page of the free programming books table on /bookshelf/free:
 * 1. the query schema: source, format, sort and dir from src/lib/free-books/types.ts, limit 1 to
 *    200, offset from 0;
 * 2. readFreeBooksPage, answered with the 1-hour edge cache headers.
 * A thrown error is logged and reported once (./middleware.ts, context 'looking up books') and
 * answered 500 with `{ error }`; both routes answer it with the 'books.lookup.error' model.
 */

import { Elysia, StatusMap } from 'elysia';
import { normaliseQuery } from '@/lib/filters/normalise';
import { BOOK_LOOKUP_QUERY_MAX_LENGTH, lookupBooks, readFreeBooksPage } from './handlers';
import { cacheHeaders, errorHandler, freeBooksCacheHeaders } from './middleware';
import { booksSchema } from './schema';

export const booksRoute = new Elysia({ prefix: '/books' })
  .model(booksSchema)
  .get(
    '/lookup',
    async ({ query, set }) => {
      try {
        const q = normaliseQuery(query.q, BOOK_LOOKUP_QUERY_MAX_LENGTH);
        const isbn = query.isbn?.trim();
        if (!q && !isbn) {
          set.status = StatusMap['Bad Request'];
          return { error: 'Provide either a `q` search query or an `isbn` parameter.' };
        }

        const result = await lookupBooks({ q, isbn, limit: query.limit });
        Object.assign(set.headers, cacheHeaders());
        return result;
      } catch (error) {
        const errorResponse = errorHandler(error);
        set.status = StatusMap['Internal Server Error'];
        return { error: errorResponse.error };
      }
    },
    {
      query: 'books.lookup.query',
      response: {
        200: 'books.lookup.response',
        400: 'books.lookup.error',
        500: 'books.lookup.error',
      },
    },
  )
  .get(
    '/free',
    async ({ query, set }) => {
      try {
        const page = await readFreeBooksPage(query);
        Object.assign(set.headers, freeBooksCacheHeaders());
        return page;
      } catch (error) {
        const errorResponse = errorHandler(error);
        set.status = StatusMap['Internal Server Error'];
        return { error: errorResponse.error };
      }
    },
    {
      query: 'books.free.query',
      response: {
        200: 'books.free.response',
        500: 'books.lookup.error',
      },
    },
  );
