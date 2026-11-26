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
 * @file The /bookshelf/free URL contract and its mapping to `GET /api/v1/books/free`, on
 * nuqs/server parsers so they are safe to import on the server. The explorer's query hook
 * (../_components/use-free-books-query.ts) reads and writes it with the parent route's
 * BOOKSHELF_URL_OPTIONS (../../_lib/bookshelf-filters.ts):
 * - ?q: the search, '' by default; ?source ('all', 'langs', 'subjects'), ?category ('all' or a
 *   category name) and ?format ('all' or one format) narrow the table.
 * - ?sort ('title', 'category', 'host') and ?dir ('asc', 'desc'), title ascending by default.
 * - ?page from 1, and ?perPage, read as 25, 50 or 100 rows (normalizeFreeBooksPageSize).
 * - ?archived=true and ?unavailable=true reveal entries hidden by default; ?hideWip=true hides
 *   in-progress books; ?https=true and ?verified=true keep only HTTPS links or verified hosts.
 * The source, format, sort and dir values are the tuples in src/lib/free-books/types.ts, the same
 * ones the API schema accepts. Pure and isomorphic.
 */

import { parseAsBoolean, parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs/server';
import {
  FREE_BOOK_FORMATS,
  FREE_BOOK_SOURCES,
  FREE_BOOKS_DEFAULT_PAGE_SIZE,
  FREE_BOOKS_SORT_DIRS,
  FREE_BOOKS_SORT_FIELDS,
  type FreeBookFormat,
  type FreeBookSource,
  type FreeBooksSortDir,
  type FreeBooksSortField,
} from '@/lib/free-books/types';

/** ?source values: both lists, or one. */
const FREE_BOOKS_SOURCE_VALUES = ['all', ...FREE_BOOK_SOURCES] as const;
/** ?format values: any format, or one. */
const FREE_BOOKS_FORMAT_VALUES = ['all', ...FREE_BOOK_FORMATS] as const;
/** The page sizes the table offers. */
export const FREE_BOOKS_PAGE_SIZES = [25, 50, 100] as const;

/** URL state for `/bookshelf/free` table explorer (filters, sorting, pagination). */
export const freeBooksSearchParsers = {
  q: parseAsString.withDefault(''),
  source: parseAsStringLiteral(FREE_BOOKS_SOURCE_VALUES).withDefault('all'),
  category: parseAsString.withDefault('all'),
  format: parseAsStringLiteral(FREE_BOOKS_FORMAT_VALUES).withDefault('all'),
  sort: parseAsStringLiteral(FREE_BOOKS_SORT_FIELDS).withDefault('title'),
  dir: parseAsStringLiteral(FREE_BOOKS_SORT_DIRS).withDefault('asc'),
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(FREE_BOOKS_DEFAULT_PAGE_SIZE),
  /** Default hides archived entries; `?archived=true` reveals them. */
  archived: parseAsBoolean.withDefault(false),
  /** Default hides confirmed-unavailable entries; `?unavailable=true` reveals them. */
  unavailable: parseAsBoolean.withDefault(false),
  /** Default shows in-progress entries; `?hideWip=true` hides them. */
  hideWip: parseAsBoolean.withDefault(false),
  https: parseAsBoolean.withDefault(false),
  verified: parseAsBoolean.withDefault(false),
};

/** Clamps arbitrary `?perPage=` query input to one of the supported table page sizes. */
export function normalizeFreeBooksPageSize(raw: number): (typeof FREE_BOOKS_PAGE_SIZES)[number] {
  if (raw <= 25) return 25;
  if (raw >= 100) return 100;
  return FREE_BOOKS_DEFAULT_PAGE_SIZE;
}

/** What the explorer asks `GET /api/v1/books/free` for, resolved from the URL state. */
export interface FreeBooksApiParams {
  readonly source: 'all' | FreeBookSource;
  readonly category: string;
  readonly format: 'all' | FreeBookFormat;
  readonly q: string;
  readonly sort: FreeBooksSortField;
  readonly dir: FreeBooksSortDir;
  readonly page: number;
  readonly pageSize: number;
  readonly hideArchived: boolean;
  readonly hideUnavailable: boolean;
  readonly hideInProcess: boolean;
  readonly httpsOnly: boolean;
  readonly verifiedHostsOnly: boolean;
}

/** The API URL for those params; 'all' and false filters are left out, sort and paging never. */
export function buildFreeBooksApiUrl(params: FreeBooksApiParams): string {
  const qs = new URLSearchParams();
  if (params.source !== 'all') qs.set('source', params.source);
  if (params.category !== 'all') qs.set('category', params.category);
  if (params.format !== 'all') qs.set('format', params.format);
  if (params.q.trim()) qs.set('q', params.q.trim());
  qs.set('sort', params.sort);
  qs.set('dir', params.dir);
  qs.set('hideArchived', String(params.hideArchived));
  qs.set('hideUnavailable', String(params.hideUnavailable));
  if (params.hideInProcess) qs.set('hideInProcess', 'true');
  if (params.httpsOnly) qs.set('httpsOnly', 'true');
  if (params.verifiedHostsOnly) qs.set('verifiedHostsOnly', 'true');
  qs.set('limit', String(params.pageSize));
  qs.set('offset', String((Math.max(1, params.page) - 1) * params.pageSize));
  return `/api/v1/books/free?${qs.toString()}`;
}
