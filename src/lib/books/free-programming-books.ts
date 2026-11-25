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

export type FreeBookSource = 'langs' | 'subjects';
export type FreeBookFormat = 'PDF' | 'HTML' | 'EPUB' | 'Kindle' | 'Markdown' | 'AsciiDoc';

export interface FreeBookEntry {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly authors: string;
  readonly source: FreeBookSource;
  readonly category: string;
  readonly subcategory: string | null;
  readonly formats: readonly FreeBookFormat[];
  readonly license: string | null;
  readonly archived: boolean;
  readonly inProcess: boolean;
  readonly requiresAccount: boolean;
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
  readonly categories: readonly FreeBookCategorySummary[];
  readonly books: readonly FreeBookEntry[];
}

export const EBOOK_FOUNDATION_REPO_URL =
  'https://github.com/EbookFoundation/free-programming-books';

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

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

interface CacheEntry {
  readonly catalog: FreeProgrammingBooksCatalog;
  readonly expiresAt: number;
}

let cachedCatalog: CacheEntry | null = null;
let inflightLoad: Promise<FreeProgrammingBooksCatalog> | null = null;

function isSafeHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function cleanInlineMarkdown(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseEntryLine(
  line: string,
  source: FreeBookSource,
  category: string,
  subcategory: string | null,
  index: number,
): FreeBookEntry | null {
  // Match `* [Title](https://...)` with balanced-ish URL handling (no spaces in URL).
  const match = /^\s*\*\s+\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)(.*)$/.exec(line);
  if (!match?.[1] || !match[2]) return null;

  const title = cleanInlineMarkdown(match[1]);
  const url = match[2].trim();
  if (!title || !isSafeHttpUrl(url)) return null;

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
    id: `${source}-${slugKey}-${index}`,
    title,
    url,
    authors,
    source,
    category,
    subcategory,
    formats: [...formatsSet],
    license,
    archived,
    inProcess,
    requiresAccount,
  };
}

/**
 * Pure parser for an EbookFoundation `free-programming-books` Markdown list.
 * Skips the `### Index` section and extracts all verified `http(s)` book entries with metadata.
 */
export function parseFreeProgrammingBooksMarkdown(
  markdown: string,
  source: FreeBookSource,
): FreeBookEntry[] {
  const entries: FreeBookEntry[] = [];
  const lines = markdown.split(/\r?\n/);

  let currentCategory: string | null = null;
  let currentSubcategory: string | null = null;
  let inIndex = false;
  let seq = 0;

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

    const entry = parseEntryLine(line, source, currentCategory, currentSubcategory, seq);
    if (entry) {
      entries.push(entry);
      seq += 1;
    }
  }

  return entries;
}

export function buildFreeProgrammingBooksCatalog(
  langsBooks: readonly FreeBookEntry[],
  subjectsBooks: readonly FreeBookEntry[],
  fetchedAt = new Date().toISOString(),
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
    categories,
    books,
  };
}

export interface FreeBooksFilterOptions {
  readonly source?: 'all' | FreeBookSource;
  readonly category?: string;
  readonly format?: 'all' | FreeBookFormat;
  readonly q?: string;
  readonly hideArchived?: boolean;
  readonly hideInProcess?: boolean;
}

export function filterFreeProgrammingBooks(
  books: readonly FreeBookEntry[],
  options: FreeBooksFilterOptions,
): FreeBookEntry[] {
  const source = options.source ?? 'all';
  const category = options.category?.trim().toLowerCase() ?? '';
  const format = options.format ?? 'all';
  const query = options.q?.trim().toLowerCase() ?? '';
  const hideArchived = options.hideArchived ?? false;
  const hideInProcess = options.hideInProcess ?? false;

  return books.filter((book) => {
    if (source !== 'all' && book.source !== source) return false;
    if (category && category !== 'all' && book.category.toLowerCase() !== category) return false;
    if (format !== 'all' && !book.formats.includes(format)) return false;
    if (hideArchived && book.archived) return false;
    if (hideInProcess && book.inProcess) return false;
    if (query) {
      const haystack =
        `${book.title} ${book.authors} ${book.category} ${book.subcategory ?? ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
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
      next: { revalidate: 86_400 },
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
 * Loads the parsed EbookFoundation free programming books catalog with 24h caching and
 * stale-on-error fallback so the UI and API stay resilient if GitHub is transiently unreachable.
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
      const [langsMd, subjectsMd] = await Promise.all([
        fetchMarkdown(RAW_SOURCES.langs),
        fetchMarkdown(RAW_SOURCES.subjects),
      ]);
      const langsBooks = parseFreeProgrammingBooksMarkdown(langsMd, 'langs');
      const subjectsBooks = parseFreeProgrammingBooksMarkdown(subjectsMd, 'subjects');
      const catalog = buildFreeProgrammingBooksCatalog(langsBooks, subjectsBooks);
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
