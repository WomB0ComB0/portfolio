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
 * @file The free-books vocabulary: the catalog entry, page and filter shapes, the security
 * manifest the weekly sweep writes, and the `as const` tuples each union is derived from. The
 * books API schema, the /bookshelf/free URL parsers and the parser all read these tuples, so a
 * format or sort field is spelled once. Pure and isomorphic, with no imports: the /bookshelf/free
 * island imports it, and tests/unit/bookshelf/island-imports.test.ts keeps the loader, the Redis
 * store, the threat-intel clients and the manifest JSON out of that island.
 */

export const EBOOK_FOUNDATION_REPO_URL =
  'https://github.com/EbookFoundation/free-programming-books';

/** The two upstream lists: books by programming language and books by subject. */
export const FREE_BOOK_SOURCES = ['langs', 'subjects'] as const;
export type FreeBookSource = (typeof FREE_BOOK_SOURCES)[number];

/** The formats the parser recognises in an entry's annotations. */
export const FREE_BOOK_FORMATS = ['PDF', 'HTML', 'EPUB', 'Kindle', 'Markdown', 'AsciiDoc'] as const;
export type FreeBookFormat = (typeof FREE_BOOK_FORMATS)[number];

/** The table's sortable columns. */
export const FREE_BOOKS_SORT_FIELDS = ['title', 'category', 'host'] as const;
export type FreeBooksSortField = (typeof FREE_BOOKS_SORT_FIELDS)[number];

/** Ascending or descending, for any sort field. */
export const FREE_BOOKS_SORT_DIRS = ['asc', 'desc'] as const;
export type FreeBooksSortDir = (typeof FREE_BOOKS_SORT_DIRS)[number];

/** 'verified' for a known publisher, git host or academic domain (url-screen.ts), or 'external'. */
export const HOST_TRUST_TIERS = ['verified', 'external'] as const;
export type HostTrustTier = (typeof HOST_TRUST_TIERS)[number];

/** The manifest in use: the Redis overlay merged in, or the committed JSON alone. */
export const MANIFEST_SOURCES = ['redis', 'bundled'] as const;
export type ManifestSource = (typeof MANIFEST_SOURCES)[number];

/** Rows on a page when a request names no size: the first page free/page.tsx renders. */
export const FREE_BOOKS_DEFAULT_PAGE_SIZE = 50;
/** The most rows one page returns, whatever a request asks for. */
export const FREE_BOOKS_MAX_PAGE_SIZE = 200;

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
  readonly manifestSource: ManifestSource;
  readonly categories: readonly FreeBookCategorySummary[];
  readonly books: readonly FreeBookEntry[];
}

/** One page of the catalog: the server-rendered first page and `GET /api/v1/books/free`. */
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
  readonly manifestSource: ManifestSource;
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

/** `fetch`'s shape, so the network clients and the Redis store can take a stub. */
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface UrlBaselineFingerprint {
  readonly finalHost: string;
  readonly contentType: string;
  readonly rdapRegisteredAt?: string | null;
  readonly checkedAt: string;
}

export interface DeltaDetonationRecord {
  readonly provider: 'urlscan.io' | 'cloudflare-url-scanner';
  readonly verdict: 'submitted' | 'clean' | 'malicious';
  readonly reportUrl: string | null;
  readonly scannedAt: string;
}

/**
 * How many weekly sweeps in a row checked each automated flag and found it clean: a block or
 * quarantine is lifted at 2. Kept only in the sweep's drift state, never in what the site reads.
 */
export interface FlagCleanStreaks {
  readonly hosts: Readonly<Record<string, number>>;
  readonly urls: Readonly<Record<string, number>>;
}

export interface FreeBooksSecurityManifest {
  readonly generatedAt: string;
  readonly checkedHosts: number;
  readonly checkedUrls: number;
  /** Hostnames blocked by Cloudflare 1.1.1.2, Quad9, a threat feed, or Safe Browsing. */
  readonly blockedHosts: Readonly<Record<string, string>>;
  /** Specific URLs quarantined for drive-by payloads, PDF exploits, ClickFix, parking, or drift. */
  readonly quarantinedUrls: Readonly<Record<string, string>>;
  /** Specific URLs confirmed unavailable (404/410) across two passes. */
  readonly unavailableUrls: Readonly<Record<string, string>>;
  /** Baseline host/MIME/RDAP fingerprints used to detect silent domain takeover or PDF->HTML flips. */
  readonly urlFingerprints?: Readonly<Record<string, UrlBaselineFingerprint>>;
  /** Outsourced sandbox detonation submissions for newly added / drifted external domains. */
  readonly deltaDetonations?: Readonly<Record<string, DeltaDetonationRecord>>;
  /** The sweep's clean-run counts per flag (drift state only). */
  readonly cleanStreaks?: FlagCleanStreaks;
}
