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
 * @file The parser for EbookFoundation/free-programming-books' two Markdown lists
 * (`books/free-programming-books-langs.md` and `-subjects.md`), following the upstream fpb-lint
 * conventions:
 *   - Skips the `### Index` table of contents
 *   - Tracks `### Category` and an optional `#### Subcategory`
 *   - Parses `* [Title](https://...) - Author (PDF, HTML) (:card_file_box: archived) (:construction: in process) (CC BY)`
 *   - Rejects non-http(s) URLs
 * Every entry URL passes screenExternalBookUrl (url-screen.ts) first; with a security manifest,
 * blocked hosts and quarantined URLs are dropped and counted, and unavailable URLs are flagged.
 * Pure and isomorphic: the loader (loader.ts) runs it on the fetched lists. Guarded by
 * tests/unit/free-books/parse.test.ts.
 */

import type {
  FreeBookEntry,
  FreeBookFormat,
  FreeBookSource,
  FreeBooksSecurityManifest,
} from './types';
import { screenExternalBookUrl } from './url-screen';

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

/**
 * Removes HTML tags until none are left, then any stray `<` or `>`, so nested or unclosed fragments
 * (`<scr<script>ipt>`, `Book <script`) cannot survive as tag text in the catalog or the public JSON.
 */
function stripTags(raw: string): string {
  let text = raw;
  let previous: string;
  do {
    previous = text;
    text = text.replace(/<[^>]*>/g, '');
  } while (text !== previous);
  return text.replace(/[<>]/g, '');
}

/** Plain text from inline Markdown/HTML: tags, link syntax and emphasis marks removed. */
function cleanInlineMarkdown(raw: string): string {
  return stripTags(raw)
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
