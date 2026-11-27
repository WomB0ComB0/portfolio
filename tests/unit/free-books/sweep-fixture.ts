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
 * @file Stubs for the verify sweep, CLI and manifest-store tests: SweepDependencies whose every
 * client finds nothing (no Redis state, no feeds, no blocks, every link reachable as a plain HTML
 * page), a three-link catalog, a fixed clock, and an in-memory Upstash REST API behind the real
 * manifest-store publish and load functions, so runs can follow each other week by week. A test
 * overrides only the clients it is about, with its own vi.fn when it asserts on the calls. Not a
 * test file.
 */

import { buildFreeProgrammingBooksCatalog } from '@/lib/free-books/catalog';
import {
  loadLiveSecurityManifestFromRedis,
  loadVerifierDriftStateFromRedis,
  publishSecurityManifestToRedis,
  type RedisManifestCredentials,
} from '@/lib/free-books/manifest-store';
import { parseFreeProgrammingBooksMarkdown } from '@/lib/free-books/parse';
import type { SweepDependencies } from '@/lib/free-books/sweep';
import type {
  FetchLike,
  FreeBooksSecurityManifest,
  FreeProgrammingBooksCatalog,
} from '@/lib/free-books/types';
import type { LinkObservation } from '@/lib/link-health/types';

/** The sweep's clock in every test. */
export const SWEEP_NOW = new Date('2026-11-29T05:17:00.000Z');

/** A committed manifest with nothing in it. */
export const EMPTY_MANIFEST: FreeBooksSecurityManifest = {
  generatedAt: '2026-11-01T00:00:00.000Z',
  checkedHosts: 0,
  checkedUrls: 0,
  blockedHosts: {},
  quarantinedUrls: {},
  unavailableUrls: {},
  urlFingerprints: {},
  deltaDetonations: {},
};

/** Three links on three hosts: one verified, two external (one a PDF). */
export const RUST_BOOK = 'https://doc.rust-lang.org/book/';
export const INDIE_GUIDE = 'https://indie.example/guide';
export const OLD_NOTES = 'https://old.example/notes.pdf';

const CATALOG_LINES: Readonly<Record<string, string>> = {
  [RUST_BOOK]: `* [Rust Book](${RUST_BOOK}) - Team (HTML)`,
  [INDIE_GUIDE]: `* [Indie Guide](${INDIE_GUIDE}) - Someone (HTML)`,
  [OLD_NOTES]: `* [Old Notes](${OLD_NOTES}) - Someone (PDF)`,
};

/** The fixture catalog, or only the `links` given (as upstream removing the others). */
export const sweepCatalog = (
  links: readonly string[] = [RUST_BOOK, INDIE_GUIDE, OLD_NOTES],
): FreeProgrammingBooksCatalog =>
  buildFreeProgrammingBooksCatalog(
    parseFreeProgrammingBooksMarkdown(
      ['### Rust', ...links.map((link) => CATALOG_LINES[link] ?? '')].join('\n'),
      'langs',
    ),
    [],
    SWEEP_NOW.toISOString(),
  );

/** A 200 response with `body` as `contentType`. */
export const pageResponse = (
  body = '<html><body>A free book</body></html>',
  contentType = 'text/html; charset=utf-8',
): Response => new Response(body, { status: 200, headers: { 'content-type': contentType } });

/** A probe observation of `kind`. */
export const observed = (kind: LinkObservation['kind']): LinkObservation =>
  kind === 'reachable' ? { kind, httpStatus: 200 } : { kind };

/** The URL a fetch call asked for, whatever form `input` took. */
const requestedUrl = (input: string | URL | Request): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

/**
 * The Upstash REST API in memory (SET over POST, GET by key), behind the real manifest-store
 * functions. `clients` drop into stubSweepDependencies; `failReads` makes every GET throw.
 */
export function inMemoryRedis() {
  const store = new Map<string, string>();
  const credentials: RedisManifestCredentials = {
    url: 'https://redis.example.upstash.io',
    token: 'test-token',
  };
  let readFailure: Error | null = null;
  const fetcher: FetchLike = async (input, init) => {
    if (init?.method === 'POST') {
      const [, key, value] = JSON.parse(String(init.body)) as [string, string, string];
      store.set(key, value);
      return new Response(JSON.stringify({ result: 'OK' }), { status: 200 });
    }
    if (readFailure) throw readFailure;
    const key = decodeURIComponent(requestedUrl(input).split('/get/')[1] ?? '');
    return new Response(JSON.stringify({ result: store.get(key) ?? null }), { status: 200 });
  };
  const clients: Pick<SweepDependencies, 'publish' | 'loadLiveManifest' | 'loadDriftState'> = {
    publish: (manifest) => publishSecurityManifestToRedis(manifest, { credentials, fetcher }),
    loadLiveManifest: (options) =>
      loadLiveSecurityManifestFromRedis({ ...options, credentials, fetcher }),
    loadDriftState: (options) =>
      loadVerifierDriftStateFromRedis({ ...options, credentials, fetcher }),
  };
  return {
    store,
    credentials,
    fetcher,
    clients,
    /** Makes every GET throw `error` until called again with null. */
    failReads(error: Error | null): void {
      readFailure = error;
    },
  };
}

/** Clients that find nothing, with `overrides` in their place. */
export function stubSweepDependencies(
  overrides: Partial<SweepDependencies> = {},
): SweepDependencies {
  return {
    readManifest: () => JSON.stringify(EMPTY_MANIFEST),
    loadLiveManifest: async () => null,
    loadDriftState: async () => null,
    publish: async () => ({ runtimePublished: true, fingerprintsPublished: true }),
    loadCatalog: async () => sweepCatalog(),
    loadThreatFeeds: async () => new Set<string>(),
    resolvesNormally: async () => true,
    checkHost: async (hostname) => ({ hostname, blocked: false, provider: null, reason: null }),
    checkSafeBrowsing: async () => ({}),
    probe: async () => observed('reachable'),
    fetch: async () => pageResponse(),
    checkDomainAge: async () => ({ registeredAt: null, ageDays: null, newlyRegistered: false }),
    submitDetonation: async () => null,
    now: () => SWEEP_NOW,
    ...overrides,
  };
}
