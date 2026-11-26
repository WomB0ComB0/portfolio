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
 * @file The books API models. The free-books unions are built from the tuples in
 * src/lib/free-books/types.ts (one `t.Literal` per value, in tuple order), so the API accepts and
 * returns exactly the values the catalog uses; the limits come from the lib and ./handlers.ts.
 * Only booksSchema is exported, for ./index.ts.
 */

import { t } from 'elysia';
import {
  FREE_BOOK_FORMATS,
  FREE_BOOK_SOURCES,
  FREE_BOOKS_MAX_PAGE_SIZE,
  FREE_BOOKS_SORT_DIRS,
  FREE_BOOKS_SORT_FIELDS,
  HOST_TRUST_TIERS,
  MANIFEST_SOURCES,
} from '@/lib/free-books/types';
import { BOOK_LOOKUP_QUERY_MAX_LENGTH } from './handlers';

/** One `t.Literal` per tuple value, each keeping its literal type. */
type LiteralSchemas<T extends readonly string[]> = {
  -readonly [K in keyof T]: ReturnType<typeof t.Literal<T[K]>>;
};
/** The union of those literals, typed as `t.Union` types a tuple of them. */
type LiteralUnion<T extends readonly string[]> = ReturnType<typeof t.Union<LiteralSchemas<T>>>;

/**
 * A `t.Union` of one `t.Literal` per tuple value, in tuple order: the same schema as the literals
 * written out. TypeScript cannot follow `map` over a tuple, hence the cast.
 */
const literalUnion = <const T extends readonly string[]>(values: T): LiteralUnion<T> =>
  t.Union(values.map((value) => t.Literal(value))) as unknown as LiteralUnion<T>;

const bookLookupItemSchema = t.Object({
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

const freeBookFormatSchema = literalUnion(FREE_BOOK_FORMATS);
const freeBookSourceSchema = literalUnion(FREE_BOOK_SOURCES);

const freeBookEntrySchema = t.Object({
  id: t.String(),
  title: t.String(),
  url: t.String(),
  host: t.String(),
  trustTier: literalUnion(HOST_TRUST_TIERS),
  authors: t.String(),
  source: freeBookSourceSchema,
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

const freeBookCategorySchema = t.Object({
  name: t.String(),
  source: freeBookSourceSchema,
  count: t.Number(),
});

export const booksSchema = {
  'books.lookup.query': t.Object({
    q: t.Optional(t.String({ maxLength: BOOK_LOOKUP_QUERY_MAX_LENGTH })),
    isbn: t.Optional(t.String({ maxLength: 32 })),
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
    source: t.Optional(literalUnion(['all', ...FREE_BOOK_SOURCES])),
    category: t.Optional(t.String({ maxLength: 100 })),
    format: t.Optional(t.Union([t.Literal('all'), freeBookFormatSchema])),
    q: t.Optional(t.String({ maxLength: 100 })),
    sort: t.Optional(literalUnion(FREE_BOOKS_SORT_FIELDS)),
    dir: t.Optional(literalUnion(FREE_BOOKS_SORT_DIRS)),
    hideArchived: t.Optional(t.BooleanString()),
    hideInProcess: t.Optional(t.BooleanString()),
    hideUnavailable: t.Optional(t.BooleanString()),
    httpsOnly: t.Optional(t.BooleanString()),
    verifiedHostsOnly: t.Optional(t.BooleanString()),
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: FREE_BOOKS_MAX_PAGE_SIZE })),
    offset: t.Optional(t.Numeric({ minimum: 0 })),
  }),
  'books.free.response': t.Object({
    fetchedAt: t.String(),
    repoUrl: t.String(),
    license: t.String(),
    totalCatalogBooks: t.Number(),
    langsCount: t.Number(),
    subjectsCount: t.Number(),
    languageCategoriesCount: t.Number(),
    subjectCategoriesCount: t.Number(),
    pdfCount: t.Number(),
    totalMatched: t.Number(),
    quarantinedCount: t.Number(),
    unavailableCount: t.Number(),
    securityCheckedAt: t.Nullable(t.String()),
    manifestSource: literalUnion(MANIFEST_SOURCES),
    limit: t.Number(),
    offset: t.Number(),
    categories: t.Array(freeBookCategorySchema),
    items: t.Array(freeBookEntrySchema),
  }),
};
