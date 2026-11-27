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
 * client finds nothing and completes every check (no Redis state, empty but loaded feeds, no
 * blocks, every link reachable as a plain HTML page), a three-link catalog, a fixed clock, an
 * in-memory Upstash REST API behind the real manifest-store publish and load functions, and
 * runWeeks, so runs can follow each other week by week. A test overrides only the clients it is
 * about, with its own vi.fn when it asserts on the calls. Not a test file.
 */

import { buildFreeProgrammingBooksCatalog } from '@/lib/free-books/catalog';
import {
  loadLiveSecurityManifestFromRedis,
  loadVerifierDriftStateFromRedis,
  publishSecurityManifestToRedis,
  type RedisManifestCredentials,
} from '@/lib/free-books/manifest-store';
import { parseFreeProgrammingBooksMarkdown } from '@/lib/free-books/parse';
import { runSweep, type SweepDependencies, type SweepOptions } from '@/lib/free-books/sweep';
import type { ThreatIntelVerdict } from '@/lib/free-books/threat-intel';
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

/** A host check with no block, where Cloudflare and Quad9 both answered. */
export const cleanHost = (hostname: string): ThreatIntelVerdict => ({
  hostname,
  blocked: false,
  provider: null,
  reason: null,
  completedChecks: ['cloudflare', 'quad9'],
});

/** The URL a fetch call asked for, whatever form `input` took. */
const requestedUrl = (input: string | URL | Request): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

/** One `SET key value [EX seconds]`, the only command the stand-in understands. */
interface SetCommand {
  readonly key: string;
  readonly value: string;
  readonly ttlSeconds: number | null;
}

/** `command` as a SET with an optional EX, or null for anything else. */
function readSetCommand(command: unknown): SetCommand | null {
  if (!Array.isArray(command) || !command.every((part) => typeof part === 'string')) return null;
  const [name, key, value, ex, seconds, ...rest] = command as string[];
  if (name?.toUpperCase() !== 'SET' || key === undefined || value === undefined) return null;
  if (ex === undefined) return { key, value, ttlSeconds: null };
  if (ex.toUpperCase() !== 'EX' || !/^[1-9]\d*$/.test(seconds ?? '') || rest.length > 0) {
    return null;
  }
  return { key, value, ttlSeconds: Number(seconds) };
}

const upstashAnswer = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

/**
 * The Upstash REST API in memory, behind the real manifest-store functions: GET /get/<key>, one
 * command POSTed to the base URL, and a transaction POSTed to /multi-exec (a JSON array of
 * commands, answered with one `{ result }` per command, or one `{ error }` when the whole
 * transaction is discarded and nothing is written). It understands only SET with an optional EX,
 * and keeps each key's EX in `ttls`. `clients` drop into stubSweepDependencies; `failReads` makes
 * every GET throw; `failWritesTo(key)` makes every request that would write `key` answer HTTP 500
 * and write nothing, so a transaction that includes it writes none of its keys.
 */
export function inMemoryRedis() {
  const store = new Map<string, string>();
  const ttls = new Map<string, number | null>();
  const credentials: RedisManifestCredentials = {
    url: 'https://redis.example.upstash.io',
    token: 'test-token',
  };
  let readFailure: Error | null = null;
  let failingKey: string | null = null;
  /** Writes every command, or none when one of them writes the failing key. */
  const commit = (commands: readonly SetCommand[]): boolean => {
    if (commands.some(({ key }) => key === failingKey)) return false;
    for (const { key, value, ttlSeconds } of commands) {
      store.set(key, value);
      ttls.set(key, ttlSeconds);
    }
    return true;
  };
  const runOne = (body: unknown): Response => {
    const command = readSetCommand(body);
    if (!command) return upstashAnswer({ error: 'ERR unsupported command' }, 400);
    return commit([command])
      ? upstashAnswer({ result: 'OK' })
      : upstashAnswer({ error: 'ERR write failed' }, 500);
  };
  const runTransaction = (body: unknown): Response => {
    const commands = Array.isArray(body) ? body.map(readSetCommand) : [];
    if (commands.length === 0 || commands.some((command) => command === null)) {
      return upstashAnswer({ error: 'ERR transaction discarded' }, 400);
    }
    return commit(commands as SetCommand[])
      ? upstashAnswer(commands.map(() => ({ result: 'OK' })))
      : upstashAnswer({ error: 'ERR transaction discarded' }, 500);
  };
  const fetcher: FetchLike = async (input, init) => {
    const url = requestedUrl(input);
    if (init?.method === 'POST') {
      const body: unknown = JSON.parse(String(init.body));
      if (url === `${credentials.url}/multi-exec`) return runTransaction(body);
      if (url === credentials.url) return runOne(body);
      return upstashAnswer({ error: 'ERR not found' }, 404);
    }
    if (readFailure) throw readFailure;
    const key = decodeURIComponent(url.split('/get/')[1] ?? '');
    return upstashAnswer({ result: store.get(key) ?? null });
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
    ttls,
    credentials,
    fetcher,
    clients,
    /** Makes every GET throw `error` until called again with null. */
    failReads(error: Error | null): void {
      readFailure = error;
    },
    /** Makes every request that would write `key` fail, writing nothing, until called with null. */
    failWritesTo(key: string | null): void {
      failingKey = key;
    },
  };
}

/** The scheduled workflow's run: publishes to Redis, probes every link, no sandbox scans. */
export const SCHEDULED_RUN: SweepOptions = {
  dryRun: false,
  dnsblOnly: false,
  shouldPublishRedis: true,
  detonateDeltas: false,
  maxUrls: 0,
};

/** Runs one week per entry on the same Redis, and answers the keys of `field` published after each. */
export async function runWeeks(
  redis: ReturnType<typeof inMemoryRedis>,
  runs: readonly {
    readonly options?: Partial<SweepOptions>;
    readonly deps?: Partial<SweepDependencies>;
  }[],
  field: 'blockedHosts' | 'quarantinedUrls',
): Promise<string[][]> {
  const after: string[][] = [];
  for (const run of runs) {
    await runSweep(
      { ...SCHEDULED_RUN, ...run.options },
      stubSweepDependencies({ ...redis.clients, ...run.deps }),
      () => undefined,
    );
    after.push(Object.keys((await redis.clients.loadLiveManifest())?.[field] ?? {}));
  }
  return after;
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
    loadThreatFeeds: async () => ({ hosts: new Set<string>(), complete: true }),
    resolvesNormally: async () => true,
    checkHost: async (hostname) => cleanHost(hostname),
    checkSafeBrowsing: async () => ({ matches: {}, uncheckedUrls: [] }),
    probe: async () => observed('reachable'),
    fetch: async () => pageResponse(),
    checkDomainAge: async () => ({ registeredAt: null, ageDays: null, newlyRegistered: false }),
    submitDetonation: async () => null,
    now: () => SWEEP_NOW,
    ...overrides,
  };
}
