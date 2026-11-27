// @vitest-environment node

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
 * @file src/lib/free-books/loader.ts on a stubbed `fetch` (GitHub raw and the Upstash REST API,
 * nothing real): the site's catalog drops the books the live manifest blocks, while the sweep's
 * catalog is the raw upstream list, so a flagged host or link is checked again every run.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadFreeProgrammingBooks,
  loadSweepCatalog,
  resetFreeProgrammingBooksCache,
} from '@/lib/free-books/loader';
import { REDIS_RUNTIME_MANIFEST_KEY } from '@/lib/free-books/manifest-store';
import type { FreeBooksSecurityManifest } from '@/lib/free-books/types';
import { requestUrl, SAMPLE_LANGS_MD, SAMPLE_SUBJECTS_MD } from './free-books-fixture';

const UPSTASH_URL = 'https://redis.example.upstash.io';
const RAW = 'https://raw.githubusercontent.com/EbookFoundation/free-programming-books/main/books';
const BLOCKED_HOST = 'doc.rust-lang.org';

const LIVE_MANIFEST: FreeBooksSecurityManifest = {
  generatedAt: '2026-11-22T05:17:00.000Z',
  checkedHosts: 6,
  checkedUrls: 7,
  blockedHosts: { [BLOCKED_HOST]: 'Threat Intel Feed: threat_intel_feed_blocked_host' },
  quarantinedUrls: {},
  unavailableUrls: {},
};

/** Answers GitHub raw with `lists` and the Upstash GET with LIVE_MANIFEST; refuses anything else. */
function stubNetwork(
  lists: { readonly langs: Response | string; readonly subjects: Response | string } = {
    langs: SAMPLE_LANGS_MD,
    subjects: SAMPLE_SUBJECTS_MD,
  },
) {
  const answer = (body: Response | string): Response =>
    typeof body === 'string' ? new Response(body, { status: 200 }) : body;
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = requestUrl(input);
    if (url === `${RAW}/free-programming-books-langs.md`) return answer(lists.langs);
    if (url === `${RAW}/free-programming-books-subjects.md`) return answer(lists.subjects);
    if (url === `${UPSTASH_URL}/get/${encodeURIComponent(REDIS_RUNTIME_MANIFEST_KEY)}`) {
      return new Response(JSON.stringify({ result: JSON.stringify(LIVE_MANIFEST) }));
    }
    throw new Error(`unexpected request to ${url}`);
  });
}

const hostsOf = (books: readonly { readonly host: string }[]): string[] => [
  ...new Set(books.map(({ host }) => host)),
];

beforeEach(() => {
  resetFreeProgrammingBooksCache();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', UPSTASH_URL);
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  resetFreeProgrammingBooksCache();
});

describe('loadFreeProgrammingBooks', () => {
  it('drops the books on a host the live manifest blocks, as the site always has', async () => {
    stubNetwork();

    const catalog = await loadFreeProgrammingBooks();

    expect(catalog.manifestSource).toBe('redis');
    expect(hostsOf(catalog.books)).not.toContain(BLOCKED_HOST);
    expect(catalog.books.length).toBeGreaterThan(0);
  });
});

describe('loadSweepCatalog', () => {
  it('keeps the books on a blocked host, reads no manifest and skips the site cache', async () => {
    const fetchSpy = stubNetwork();
    await loadFreeProgrammingBooks();
    fetchSpy.mockClear();

    const catalog = await loadSweepCatalog();

    expect(hostsOf(catalog.books)).toContain(BLOCKED_HOST);
    expect(fetchSpy.mock.calls.map(([input]) => requestUrl(input))).toEqual([
      `${RAW}/free-programming-books-langs.md`,
      `${RAW}/free-programming-books-subjects.md`,
    ]);
  });

  it('rejects when either list fails to load, so a run never prunes against half a catalog', async () => {
    stubNetwork({ langs: SAMPLE_LANGS_MD, subjects: new Response('down', { status: 500 }) });

    await expect(loadSweepCatalog()).rejects.toThrow(/GitHub raw fetch failed \(500\)/);
  });

  it('rejects when both lists parse to no books, so a run never prunes against an empty catalog', async () => {
    stubNetwork({ langs: '# Moved\n', subjects: '' });

    await expect(loadSweepCatalog()).rejects.toThrow(/no books/);
  });

  it.each([
    { empty: 'subjects', lists: { langs: SAMPLE_LANGS_MD, subjects: '# Moved\n' } },
    { empty: 'langs', lists: { langs: '# Moved\n', subjects: SAMPLE_SUBJECTS_MD } },
  ])(
    'rejects when only the $empty list parses to no books, so its flags are not dropped as gone',
    async ({ empty, lists }) => {
      stubNetwork(lists);

      await expect(loadSweepCatalog()).rejects.toThrow(
        `the upstream ${empty} list parsed to no books, so the catalog is incomplete`,
      );
    },
  );
});

describe('loadFreeProgrammingBooks with one list that parses to no books', () => {
  it('still serves the books of the other list on the site', async () => {
    stubNetwork({ langs: SAMPLE_LANGS_MD, subjects: '# Moved\n' });

    const catalog = await loadFreeProgrammingBooks();

    expect(catalog.books.length).toBeGreaterThan(0);
    expect(catalog.subjectsCount).toBe(0);
  });
});
