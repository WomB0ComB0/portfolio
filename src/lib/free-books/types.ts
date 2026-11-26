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
 * @file Isomorphic types and constants for EbookFoundation's free-programming-books catalog.
 * Kept strictly free of server loaders, Upstash Redis clients, and the security manifest JSON
 * so `'use client'` islands can import from here without risking server code leakage.
 */

import type { HostTrustTier } from './url-screen';

export const EBOOK_FOUNDATION_REPO_URL =
  'https://github.com/EbookFoundation/free-programming-books';

export type FreeBookSource = 'langs' | 'subjects';
export type FreeBookFormat = 'PDF' | 'HTML' | 'EPUB' | 'Kindle' | 'Markdown' | 'AsciiDoc';

export interface FreeBookEntry {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly host: string;
  readonly trustTier: HostTrustTier;
  readonly authors: string;
  readonly source: FreeBookSource;
  readonly category: string;
  readonly subcategory: string | null;
  readonly formats: readonly FreeBookFormat[];
  readonly license: string | null;
  readonly archived: boolean;
  readonly inProcess: boolean;
  readonly requiresAccount: boolean;
  readonly insecureTransport: boolean;
  readonly unavailable: boolean;
}

export interface FreeBookCategorySummary {
  readonly name: string;
  readonly source: FreeBookSource;
  readonly count: number;
}

export interface FreeProgrammingBooksCatalog {
  readonly fetchedAt: string;
  readonly repoUrl: string;
  readonly license: string;
  readonly totalBooks: number;
  readonly langsCount: number;
  readonly subjectsCount: number;
  readonly languageCategoriesCount: number;
  readonly subjectCategoriesCount: number;
  readonly pdfCount: number;
  readonly quarantinedCount: number;
  readonly unavailableCount: number;
  readonly securityCheckedAt: string | null;
  readonly manifestSource: 'redis' | 'bundled';
  readonly categories: readonly FreeBookCategorySummary[];
  readonly books: readonly FreeBookEntry[];
}

/** Compact paginated slice shared between SSR initialPage and `GET /api/v1/books/free`. */
export interface FreeBooksPageResponse {
  readonly fetchedAt: string;
  readonly repoUrl: string;
  readonly license: string;
  readonly totalCatalogBooks: number;
  readonly langsCount: number;
  readonly subjectsCount: number;
  readonly languageCategoriesCount: number;
  readonly subjectCategoriesCount: number;
  readonly pdfCount: number;
  readonly totalMatched: number;
  readonly quarantinedCount: number;
  readonly unavailableCount: number;
  readonly securityCheckedAt: string | null;
  readonly manifestSource: 'redis' | 'bundled';
  readonly limit: number;
  readonly offset: number;
  readonly categories: readonly FreeBookCategorySummary[];
  readonly items: readonly FreeBookEntry[];
}

export interface FreeBooksFilterOptions {
  readonly source?: 'all' | FreeBookSource;
  readonly category?: string;
  readonly format?: 'all' | FreeBookFormat;
  readonly q?: string;
  readonly hideArchived?: boolean;
  readonly hideInProcess?: boolean;
  readonly hideUnavailable?: boolean;
  readonly httpsOnly?: boolean;
  readonly verifiedHostsOnly?: boolean;
}
