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
 * @file Stubs for the verify sweep and CLI tests: SweepDependencies whose every client finds
 * nothing (no Redis state, no feeds, no blocks, every link reachable as a plain HTML page), a
 * three-link catalog and a fixed clock. A test overrides only the clients it is about, with its
 * own vi.fn when it asserts on the calls. Not a test file.
 */

import { vi } from 'vitest';
import { buildFreeProgrammingBooksCatalog } from '@/lib/free-books/catalog';
import { parseFreeProgrammingBooksMarkdown } from '@/lib/free-books/parse';
import type { SweepDependencies } from '@/lib/free-books/sweep';
import type {
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

export const sweepCatalog = (): FreeProgrammingBooksCatalog =>
  buildFreeProgrammingBooksCatalog(
    parseFreeProgrammingBooksMarkdown(
      [
        '### Rust',
        `* [Rust Book](${RUST_BOOK}) - Team (HTML)`,
        `* [Indie Guide](${INDIE_GUIDE}) - Someone (HTML)`,
        `* [Old Notes](${OLD_NOTES}) - Someone (PDF)`,
      ].join('\n'),
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

/** Clients that find nothing, with `overrides` in their place. */
export function stubSweepDependencies(
  overrides: Partial<SweepDependencies> = {},
): SweepDependencies {
  return {
    readManifest: () => JSON.stringify(EMPTY_MANIFEST),
    writeManifest: vi.fn(),
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
