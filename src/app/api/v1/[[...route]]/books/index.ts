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

import { Elysia, StatusMap } from 'elysia';
import { lookupBooks } from './handlers';
import { cacheHeaders, errorHandler } from './middleware';
import { booksSchema } from './schema';

export const booksRoute = new Elysia({ prefix: '/books' }).model(booksSchema).get(
  '/lookup',
  async ({ query, set }) => {
    try {
      const q = query.q?.trim();
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
);
