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

import { t } from 'elysia';

export const bookLookupItemSchema = t.Object({
  title: t.String(),
  slug: t.String(),
  authors: t.String(),
  publisher: t.String(),
  year: t.Nullable(t.Number()),
  isbn: t.Nullable(t.String()),
  description: t.String(),
  coverUrl: t.Nullable(t.String()),
  url: t.Nullable(t.String()),
  source: t.Union([t.Literal('openlibrary'), t.Literal('googlebooks')]),
});

export const booksSchema = {
  'books.lookup.query': t.Object({
    q: t.Optional(t.String()),
    isbn: t.Optional(t.String()),
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 10 })),
  }),
  'books.lookup.response': t.Object({
    query: t.String(),
    items: t.Array(bookLookupItemSchema),
  }),
  'books.lookup.error': t.Object({
    error: t.String(),
  }),
};
