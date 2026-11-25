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

export const freeBookFormatSchema = t.Union([
  t.Literal('PDF'),
  t.Literal('HTML'),
  t.Literal('EPUB'),
  t.Literal('Kindle'),
  t.Literal('Markdown'),
  t.Literal('AsciiDoc'),
]);

export const freeBookEntrySchema = t.Object({
  id: t.String(),
  title: t.String(),
  url: t.String(),
  host: t.String(),
  trustTier: t.Union([t.Literal('verified'), t.Literal('external')]),
  authors: t.String(),
  source: t.Union([t.Literal('langs'), t.Literal('subjects')]),
  category: t.String(),
  subcategory: t.Nullable(t.String()),
  formats: t.Array(freeBookFormatSchema),
  license: t.Nullable(t.String()),
  archived: t.Boolean(),
  inProcess: t.Boolean(),
  requiresAccount: t.Boolean(),
  insecureTransport: t.Boolean(),
  unavailable: t.Boolean(),
});

export const freeBookCategorySchema = t.Object({
  name: t.String(),
  source: t.Union([t.Literal('langs'), t.Literal('subjects')]),
  count: t.Number(),
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
  'books.free.query': t.Object({
    source: t.Optional(t.Union([t.Literal('all'), t.Literal('langs'), t.Literal('subjects')])),
    category: t.Optional(t.String()),
    format: t.Optional(t.Union([t.Literal('all'), freeBookFormatSchema])),
    q: t.Optional(t.String()),
    hideArchived: t.Optional(t.BooleanString()),
    hideInProcess: t.Optional(t.BooleanString()),
    hideUnavailable: t.Optional(t.BooleanString()),
    httpsOnly: t.Optional(t.BooleanString()),
    verifiedHostsOnly: t.Optional(t.BooleanString()),
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 200 })),
    offset: t.Optional(t.Numeric({ minimum: 0 })),
  }),
  'books.free.response': t.Object({
    fetchedAt: t.String(),
    repoUrl: t.String(),
    license: t.String(),
    totalCatalogBooks: t.Number(),
    totalMatched: t.Number(),
    quarantinedCount: t.Number(),
    unavailableCount: t.Number(),
    limit: t.Number(),
    offset: t.Number(),
    categories: t.Array(freeBookCategorySchema),
    items: t.Array(freeBookEntrySchema),
  }),
};
