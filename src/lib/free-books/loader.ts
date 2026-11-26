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

import 'server-only';

/**
 * @file The server-only catalog loader. It fetches both Markdown lists from GitHub, reads the live
 * Redis manifest (manifest-store.ts) and merges it over the committed security-manifest.json,
 * parses each list (parse.ts) and builds the catalog (catalog.ts). The catalog is cached in memory
 * for an hour and one load runs at a time; when a refresh fails, the last catalog is served if
 * there is one. free/page.tsx and `GET /api/v1/books/free` (books/handlers.ts) call it. The verify
 * sweep (under --conditions=react-server) calls loadSweepCatalog instead: the same lists with no
 * manifest applied and no cache, so a flagged host or link is checked again every run.
 */

import { buildFreeProgrammingBooksCatalog } from './catalog';
import { loadLiveSecurityManifestFromRedis, mergeSecurityManifests } from './manifest-store';
import { parseFreeProgrammingBooksWithStats } from './parse';
import securityManifest from './security-manifest.json';
import type {
  FreeBookSource,
  FreeBooksSecurityManifest,
  FreeProgrammingBooksCatalog,
} from './types';

/** Both lists, raw from the upstream main branch. */
const RAW_SOURCES: Readonly<Record<FreeBookSource, string>> = {
  langs:
    'https://raw.githubusercontent.com/EbookFoundation/free-programming-books/main/books/free-programming-books-langs.md',
  subjects:
    'https://raw.githubusercontent.com/EbookFoundation/free-programming-books/main/books/free-programming-books-subjects.md',
};

/** An hour in memory, so a live Redis patch reaches the site within the hour. */
const CACHE_TTL_MS = 60 * 60 * 1000;
/** Each GitHub fetch gives up after 10 s. */
const FETCH_TIMEOUT_MS = 10_000;

interface CacheEntry {
  readonly catalog: FreeProgrammingBooksCatalog;
  readonly expiresAt: number;
}

let cachedCatalog: CacheEntry | null = null;
let inflightLoad: Promise<FreeProgrammingBooksCatalog> | null = null;

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

/** Both upstream lists as Markdown; throws when either one fails to load. */
async function fetchBothLists(): Promise<Readonly<Record<FreeBookSource, string>>> {
  const [langs, subjects] = await Promise.all([
    fetchMarkdown(RAW_SOURCES.langs),
    fetchMarkdown(RAW_SOURCES.subjects),
  ]);
  return { langs, subjects };
}

/**
 * The raw upstream catalog for the verify sweep: both lists parsed with no security manifest and
 * no cache, so every host and link is checked again each run, flagged or not. Each URL still
 * passes screenExternalBookUrl (parse.ts), so an unsafe link never reaches a probe. Throws when
 * either list fails to load or both parse to no books, so a run never prunes its flags against a
 * missing catalog.
 */
export async function loadSweepCatalog(): Promise<FreeProgrammingBooksCatalog> {
  const lists = await fetchBothLists();
  const langsParsed = parseFreeProgrammingBooksWithStats(lists.langs, 'langs');
  const subjectsParsed = parseFreeProgrammingBooksWithStats(lists.subjects, 'subjects');
  if (langsParsed.entries.length + subjectsParsed.entries.length === 0) {
    throw new Error('the upstream lists parsed to no books, so there is nothing to check');
  }
  return buildFreeProgrammingBooksCatalog(
    langsParsed.entries,
    subjectsParsed.entries,
    new Date().toISOString(),
    {
      quarantinedCount: langsParsed.quarantinedCount + subjectsParsed.quarantinedCount,
      securityCheckedAt: null,
      manifestSource: 'bundled',
    },
  );
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
      const [lists, liveRedisManifest] = await Promise.all([
        fetchBothLists(),
        loadLiveSecurityManifestFromRedis(),
      ]);
      const { manifest, source: manifestSource } = mergeSecurityManifests(
        securityManifest as FreeBooksSecurityManifest,
        liveRedisManifest,
      );
      const langsParsed = parseFreeProgrammingBooksWithStats(lists.langs, 'langs', manifest);
      const subjectsParsed = parseFreeProgrammingBooksWithStats(
        lists.subjects,
        'subjects',
        manifest,
      );
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
