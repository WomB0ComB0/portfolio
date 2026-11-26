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
 * @file Parser and stale-while-revalidate loader for EbookFoundation/free-programming-books
 * (`books/free-programming-books-langs.md` and `books/free-programming-books-subjects.md`).
 * Follows EbookFoundation's upstream `fpb-lint` Markdown conventions:
 *   - Skips `### Index` TOC anchors
 *   - Tracks `### Category` and optional `#### Subcategory`
 *   - Parses `* [Title](https://...) - Author (PDF, HTML) (:card_file_box: archived) (:construction: in process) (CC BY)`
 *   - Rejects non-http(s) URLs for safety
 */

import type {
  FreeBooksSortDir,
  FreeBooksSortField,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/bookshelf-filters';
import { DEFAULT_QUERY_MAX_LENGTH, normaliseQuery } from '@/lib/filters/normalise';
import { loadLiveSecurityManifestFromRedis, mergeSecurityManifests } from './manifest-store';
import securityManifest from './security-manifest.json';
import type { FreeBooksSecurityManifest } from './threat-intel';
import {
  EBOOK_FOUNDATION_REPO_URL,
  type FreeBookCategorySummary,
  type FreeBookEntry,
  type FreeBookFormat,
  type FreeBookSource,
  type FreeBooksFilterOptions,
  type FreeBooksPageResponse,
  type FreeProgrammingBooksCatalog,
} from './types';
import { screenExternalBookUrl } from './url-screen';

const RAW_SOURCES: Readonly<Record<FreeBookSource, string>> = {
  langs:
    'https://raw.githubusercontent.com/EbookFoundation/free-programming-books/main/books/free-programming-books-langs.md',
  subjects:
    'https://raw.githubusercontent.com/EbookFoundation/free-programming-books/main/books/free-programming-books-subjects.md',
};

const KNOWN_FORMATS: readonly { readonly pattern: RegExp; readonly label: FreeBookFormat }[] = [
  { pattern: /\bpdf\b/i, label: 'PDF' },
  { pattern: /\bhtml\b/i, label: 'HTML' },
  { pattern: /\bepub\b/i, label: 'EPUB' },
  { pattern: /\bkindle\b|\bmobi\b/i, label: 'Kindle' },
  { pattern: /\bmarkdown\b|\bmd\b/i, label: 'Markdown' },
  { pattern: /\basciidoc\b/i, label: 'AsciiDoc' },
];

const LICENSE_PATTERN =
  /\b(CC\s+BY(?:-[A-Z]{2,3})*(?:\s+\d\.\d)?|GFDL|MIT|GPL(?:\s+v?\d)?|Apache(?:\s+2\.0)?)\b/i;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h in-memory TTL so live Upstash Redis patches apply promptly
const FETCH_TIMEOUT_MS = 10_000;

interface CacheEntry {
  readonly catalog: FreeProgrammingBooksCatalog;
  readonly expiresAt: number;
}

let cachedCatalog: CacheEntry | null = null;
let inflightLoad: Promise<FreeProgrammingBooksCatalog> | null = null;

function parseEntryLine(
  line: string,
  source: FreeBookSource,
  category: string,
  subcategory: string | null,
  index: number,
  manifest?: FreeBooksSecurityManifest,
): { readonly entry: FreeBookEntry | null; readonly quarantined: boolean } {
  // Match `* [Title](https://...)` with balanced-ish URL handling (no spaces in URL).
  const match = /^\s*\*\s+\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)(.*)$/.exec(line);
  if (!match?.[1] || !match[2]) return { entry: null, quarantined: false };

  const title = cleanInlineMarkdown(match[1]);
  const rawUrl = match[2].trim();
  if (!title) return { entry: null, quarantined: false };

  // Fail-closed synchronous URL security gate (SSRF, credentials, executables, homographs, abuse TLDs).
  const verdict = screenExternalBookUrl(rawUrl);
  if (!verdict.safe || !verdict.normalizedUrl || !verdict.hostname) {
    return { entry: null, quarantined: true };
  }
  const url = verdict.normalizedUrl;

  // Fail-closed manifest quarantine (DNSBL-blocked hosts, parked domains, drive-by MIME payloads).
  if (
    manifest &&
    (Object.hasOwn(manifest.blockedHosts, verdict.hostname) ||
      Object.hasOwn(manifest.quarantinedUrls, url))
  ) {
    return { entry: null, quarantined: true };
  }

  const unavailable = Boolean(manifest && Object.hasOwn(manifest.unavailableUrls, url));

  const trailing = (match[3] ?? '').trim();
  const formatsSet = new Set<FreeBookFormat>();
  let license: string | null = null;
  let archived = false;
  let inProcess = false;
  let requiresAccount = false;

  // Inspect all parenthesized annotations following the link (per fpb-lint rules).
  const parenGroups = [...trailing.matchAll(/\(([^)]+)\)/g)];
  let strippedTrailing = trailing;

  for (const group of parenGroups) {
    const inner = group[1] ?? '';
    const full = group[0];
    let isMetaTag = false;

    if (/:card_file_box:|\barchived\b/i.test(inner)) {
      archived = true;
      isMetaTag = true;
    }
    if (/:construction:|\bin process\b|\bin progress\b|\bwip\b/i.test(inner)) {
      inProcess = true;
      isMetaTag = true;
    }
    if (/:email:|\bemail\b|\baccount\b|\bregistration\b|\blogin\b|\bsign[- ]?up\b/i.test(inner)) {
      requiresAccount = true;
      isMetaTag = true;
    }

    for (const fmt of KNOWN_FORMATS) {
      if (fmt.pattern.test(inner)) {
        formatsSet.add(fmt.label);
        isMetaTag = true;
      }
    }

    const licMatch = LICENSE_PATTERN.exec(inner);
    if (licMatch?.[1]) {
      license = licMatch[1].toUpperCase().replace(/\s+/g, ' ');
      isMetaTag = true;
    }

    if (isMetaTag) {
      strippedTrailing = strippedTrailing.replace(full, '');
    }
  }

  // Also infer PDF from direct `.pdf` link URLs when not explicitly annotated.
  if (formatsSet.size === 0 && /\.pdf(?:$|[?#])/i.test(url)) {
    formatsSet.add('PDF');
  }

  // Clean author/description after leading ` - ` or ` — ` separator.
  const authors = cleanInlineMarkdown(
    strippedTrailing
      .replace(/^\s*[-–—:]\s*/, '')
      .replace(/\*?\s*:card_file_box:\s*\*?/gi, '')
      .replace(/\*?\s*:construction:\s*\*?/gi, '')
      .replace(/\*?\s*:email:\s*\*?/gi, '')
      .replace(/\s*,\s*$/, ''),
  );

  const slugKey = category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return {
    entry: {
      id: `${source}-${slugKey}-${index}`,
      title,
      url,
      host: verdict.hostname,
      trustTier: verdict.trustTier,
      authors,
      source,
      category,
      subcategory,
      formats: [...formatsSet],
      license,
      archived,
      inProcess,
      requiresAccount,
      insecureTransport: verdict.insecureTransport,
      unavailable,
    },
    quarantined: false,
  };
}

function cleanInlineMarkdown(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pure parser for an EbookFoundation `free-programming-books` Markdown list.
 * Skips the `### Index` section, runs the synchronous URL security gate, and quarantines
 * blocked/malicious/parked entries when a security manifest is provided.
 */
export function parseFreeProgrammingBooksMarkdown(
  markdown: string,
  source: FreeBookSource,
  manifest?: FreeBooksSecurityManifest,
): FreeBookEntry[] {
  return parseFreeProgrammingBooksWithStats(markdown, source, manifest).entries;
}

export function parseFreeProgrammingBooksWithStats(
  markdown: string,
  source: FreeBookSource,
  manifest?: FreeBooksSecurityManifest,
): { readonly entries: FreeBookEntry[]; readonly quarantinedCount: number } {
  const entries: FreeBookEntry[] = [];
  const lines = markdown.split(/\r?\n/);

  let currentCategory: string | null = null;
  let currentSubcategory: string | null = null;
  let inIndex = false;
  let seq = 0;
  let quarantinedCount = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('### ')) {
      const heading = cleanInlineMarkdown(line.slice(4));
      if (heading.toLowerCase() === 'index') {
        inIndex = true;
        currentCategory = null;
        currentSubcategory = null;
        continue;
      }
      inIndex = false;
      currentCategory = heading;
      currentSubcategory = null;
      continue;
    }

    if (line.startsWith('#### ')) {
      if (!inIndex && currentCategory) {
        currentSubcategory = cleanInlineMarkdown(line.slice(5));
      }
      continue;
    }

    if (inIndex || !currentCategory || !line.startsWith('*')) continue;

    const { entry, quarantined } = parseEntryLine(
      line,
      source,
      currentCategory,
      currentSubcategory,
      seq,
      manifest,
    );
    if (quarantined) {
      quarantinedCount += 1;
    } else if (entry) {
      entries.push(entry);
      seq += 1;
    }
  }

  return { entries, quarantinedCount };
}

export function buildFreeProgrammingBooksCatalog(
  langsBooks: readonly FreeBookEntry[],
  subjectsBooks: readonly FreeBookEntry[],
  fetchedAt = new Date().toISOString(),
  options: {
    readonly quarantinedCount?: number;
    readonly securityCheckedAt?: string | null;
    readonly manifestSource?: 'redis' | 'bundled';
  } = {},
): FreeProgrammingBooksCatalog {
  const books = [...langsBooks, ...subjectsBooks];
  const categoryCounts = new Map<string, FreeBookCategorySummary>();

  for (const book of books) {
    const key = `${book.source}::${book.category}`;
    const existing = categoryCounts.get(key);
    if (existing) {
      categoryCounts.set(key, { ...existing, count: existing.count + 1 });
    } else {
      categoryCounts.set(key, { name: book.category, source: book.source, count: 1 });
    }
  }

  const categories = [...categoryCounts.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );

  return {
    fetchedAt,
    repoUrl: EBOOK_FOUNDATION_REPO_URL,
    license: 'CC BY 4.0',
    totalBooks: books.length,
    langsCount: langsBooks.length,
    subjectsCount: subjectsBooks.length,
    languageCategoriesCount: categories.filter((c) => c.source === 'langs').length,
    subjectCategoriesCount: categories.filter((c) => c.source === 'subjects').length,
    pdfCount: books.filter((b) => b.formats.includes('PDF')).length,
    quarantinedCount: options.quarantinedCount ?? 0,
    unavailableCount: books.filter((b) => b.unavailable).length,
    securityCheckedAt: options.securityCheckedAt ?? null,
    manifestSource: options.manifestSource ?? 'bundled',
    categories,
    books,
  };
}

/** Pre-indexed lowercase search haystacks keyed by entry object (zero JSON payload overhead). */
const bookSearchIndex = new WeakMap<FreeBookEntry, string>();

function getBookSearchHaystack(book: FreeBookEntry): string {
  const cached = bookSearchIndex.get(book);
  if (cached !== undefined) return cached;
  const indexed =
    `${book.title} ${book.authors} ${book.category} ${book.subcategory ?? ''} ${book.host}`.toLowerCase();
  bookSearchIndex.set(book, indexed);
  return indexed;
}

export function filterFreeProgrammingBooks(
  books: readonly FreeBookEntry[],
  options: FreeBooksFilterOptions,
): FreeBookEntry[] {
  const source = options.source ?? 'all';
  const category = normaliseQuery(options.category, DEFAULT_QUERY_MAX_LENGTH).toLowerCase();
  const format = options.format ?? 'all';
  const cleanQuery = normaliseQuery(options.q, DEFAULT_QUERY_MAX_LENGTH).toLowerCase();
  const queryTokens = cleanQuery ? cleanQuery.split(' ').filter(Boolean) : [];
  const hideArchived = options.hideArchived ?? false;
  const hideInProcess = options.hideInProcess ?? false;
  const hideUnavailable = options.hideUnavailable ?? false;
  const httpsOnly = options.httpsOnly ?? false;
  const verifiedHostsOnly = options.verifiedHostsOnly ?? false;

  return books.filter((book) => {
    if (source !== 'all' && book.source !== source) return false;
    if (category && category !== 'all' && book.category.toLowerCase() !== category) return false;
    if (format !== 'all' && !book.formats.includes(format)) return false;
    if (hideArchived && book.archived) return false;
    if (hideInProcess && book.inProcess) return false;
    if (hideUnavailable && book.unavailable) return false;
    if (httpsOnly && book.insecureTransport) return false;
    if (verifiedHostsOnly && book.trustTier !== 'verified') return false;
    if (queryTokens.length > 0) {
      const haystack = getBookSearchHaystack(book);
      for (const token of queryTokens) {
        if (!haystack.includes(token)) return false;
      }
    }
    return true;
  });
}

/** Deterministic sort shared by SSR initial page, `/api/v1/books/free`, and tests. */
function sortFreeProgrammingBooks(
  books: readonly FreeBookEntry[],
  sort: FreeBooksSortField = 'title',
  dir: FreeBooksSortDir = 'asc',
): FreeBookEntry[] {
  const mult = dir === 'asc' ? 1 : -1;
  return [...books].sort((a, b) => {
    let cmp = 0;
    if (sort === 'category') {
      cmp =
        a.category.localeCompare(b.category, undefined, { sensitivity: 'base' }) ||
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    } else if (sort === 'host') {
      cmp =
        (a.trustTier === b.trustTier ? 0 : a.trustTier === 'verified' ? -1 : 1) ||
        a.host.localeCompare(b.host, undefined, { sensitivity: 'base' }) ||
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    } else {
      cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    }
    return cmp * mult;
  });
}

/** Filters, sorts, and slices a single paginated response shared by SSR and `GET /api/v1/books/free`. */
export function buildFreeBooksPageResponse(
  catalog: FreeProgrammingBooksCatalog,
  options: FreeBooksFilterOptions & {
    readonly sort?: FreeBooksSortField;
    readonly dir?: FreeBooksSortDir;
    readonly limit?: number;
    readonly offset?: number;
  } = {},
): FreeBooksPageResponse {
  const filtered = filterFreeProgrammingBooks(catalog.books, options);
  const sorted = sortFreeProgrammingBooks(filtered, options.sort ?? 'title', options.dir ?? 'asc');
  const limit = Math.min(Math.max(1, options.limit ?? 50), 200);
  const offset = Math.max(0, options.offset ?? 0);
  const items = sorted.slice(offset, offset + limit).map((item) => ({
    ...item,
    formats: [...item.formats],
  }));

  return {
    fetchedAt: catalog.fetchedAt,
    repoUrl: catalog.repoUrl,
    license: catalog.license,
    totalCatalogBooks: catalog.totalBooks,
    langsCount: catalog.langsCount,
    subjectsCount: catalog.subjectsCount,
    languageCategoriesCount: catalog.languageCategoriesCount,
    subjectCategoriesCount: catalog.subjectCategoriesCount,
    pdfCount: catalog.pdfCount,
    totalMatched: sorted.length,
    quarantinedCount: catalog.quarantinedCount,
    unavailableCount: catalog.unavailableCount,
    securityCheckedAt: catalog.securityCheckedAt,
    manifestSource: catalog.manifestSource,
    limit,
    offset,
    categories: [...catalog.categories],
    items,
  };
}

async function fetchMarkdown(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/plain',
        'User-Agent': 'mikeodnis-portfolio/1.0 (+https://mikeodnis.dev)',
      },
      next: { revalidate: 3_600 },
    });
    if (!res.ok) {
      throw new Error(`GitHub raw fetch failed (${res.status}) for ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Loads the parsed EbookFoundation free programming books catalog, overlaying any live Upstash
 * Redis security manifest on top of the committed baseline so weekly security patches apply
 * without a redeploy, with stale-on-error fallback if GitHub is transiently unreachable.
 */
export async function loadFreeProgrammingBooks(): Promise<FreeProgrammingBooksCatalog> {
  const now = Date.now();
  if (cachedCatalog && now < cachedCatalog.expiresAt) {
    return cachedCatalog.catalog;
  }

  if (inflightLoad) {
    return inflightLoad;
  }

  inflightLoad = (async () => {
    try {
      const [langsMd, subjectsMd, liveRedisManifest] = await Promise.all([
        fetchMarkdown(RAW_SOURCES.langs),
        fetchMarkdown(RAW_SOURCES.subjects),
        loadLiveSecurityManifestFromRedis(),
      ]);
      const { manifest, source: manifestSource } = mergeSecurityManifests(
        securityManifest as FreeBooksSecurityManifest,
        liveRedisManifest,
      );
      const langsParsed = parseFreeProgrammingBooksWithStats(langsMd, 'langs', manifest);
      const subjectsParsed = parseFreeProgrammingBooksWithStats(subjectsMd, 'subjects', manifest);
      const catalog = buildFreeProgrammingBooksCatalog(
        langsParsed.entries,
        subjectsParsed.entries,
        new Date().toISOString(),
        {
          quarantinedCount: langsParsed.quarantinedCount + subjectsParsed.quarantinedCount,
          securityCheckedAt: manifest.checkedHosts > 0 ? manifest.generatedAt : null,
          manifestSource,
        },
      );
      cachedCatalog = { catalog, expiresAt: Date.now() + CACHE_TTL_MS };
      return catalog;
    } catch (error) {
      if (cachedCatalog) {
        return cachedCatalog.catalog;
      }
      throw error;
    } finally {
      inflightLoad = null;
    }
  })();

  return inflightLoad;
}

/** Clears the in-memory cache (for tests). */
export function resetFreeProgrammingBooksCache(): void {
  cachedCatalog = null;
  inflightLoad = null;
}
