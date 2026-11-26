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
 * @file The live security manifest in Upstash Redis, read through the REST API. The weekly sweep
 * publishes it (and its drift state) so a new block reaches the site without a deploy; the
 * catalog loader (loader.ts) reads it and merges it over the committed security-manifest.json with
 * mergeSecurityManifests. Plain `fetch` with no `node:*` or SDK import, so the same module runs in
 * Next.js, in the Bun CLI and in Vitest. On the site, a read that fails or times out answers
 * null and the committed manifest stays in force. The sweep reads strictly when it will publish
 * (`strict: true`): a missing credential, an error status, a timeout, bad JSON or a stored value
 * of the wrong shape (zod) throws a RedisReadError, so a run never overwrites an overlay it could
 * not read; only a key that is not there answers null. Guarded by
 * tests/unit/free-books/manifest-store.test.ts.
 *
 * What each side holds:
 * - security-manifest.json (git) holds the owner's permanent pins. The sweep never lifts them and
 *   never fetches a pinned link, and the merge below means the site never drops them.
 * - The Redis overlay holds everything the sweep found. A block or quarantine is lifted only after
 *   two runs in a row that actually checked it and found it clean; a run that could not check it
 *   counts for nothing, a new hit resets the count, and a flag whose host or link has left the
 *   upstream list is dropped. The counts live in the drift key as `cleanStreaks`.
 */

import { z } from 'zod';
import type {
  DeltaDetonationRecord,
  FetchLike,
  FlagCleanStreaks,
  FreeBooksSecurityManifest,
  ManifestSource,
  UrlBaselineFingerprint,
} from './types';

export const REDIS_RUNTIME_MANIFEST_KEY = 'bookshelf:free:security-manifest:v1';
const REDIS_FINGERPRINTS_KEY = 'bookshelf:free:fingerprints:v1';

/** 30-day TTL (refreshed weekly by `free-books-verify.yml`, so live patches never vanish early). */
const REDIS_MANIFEST_TTL_SECONDS = 30 * 24 * 60 * 60;
const REDIS_TIMEOUT_MS = 2500;

export interface RedisManifestCredentials {
  readonly url?: string;
  readonly token?: string;
}

/** How a read reaches Upstash; `strict` makes a read the sweep cannot trust throw. */
export interface RedisReadOptions {
  readonly credentials?: RedisManifestCredentials;
  readonly timeoutMs?: number;
  readonly fetcher?: FetchLike;
  /** Throw a RedisReadError instead of answering null on anything but a missing key. */
  readonly strict?: boolean;
}

/** A strict read the sweep could not trust, said in plain words: what, and why. */
export class RedisReadError extends Error {
  constructor(what: string, reason: string, options?: { readonly cause?: unknown }) {
    super(`could not read the ${what} from Redis (${reason})`, options);
    this.name = 'RedisReadError';
  }
}

const textRecord = z.record(z.string(), z.string());
const countRecord = z.record(z.string(), z.number().int().nonnegative());

/** The runtime manifest the sweep publishes and the site reads. */
const runtimeManifestSchema = z.object({
  generatedAt: z.string(),
  checkedHosts: z.number().int().nonnegative(),
  checkedUrls: z.number().int().nonnegative(),
  blockedHosts: textRecord,
  quarantinedUrls: textRecord,
  unavailableUrls: textRecord,
});

/** The sweep's drift state, as types.ts declares it. */
const driftStateSchema = z.object({
  urlFingerprints: z.record(
    z.string(),
    z.object({
      finalHost: z.string(),
      contentType: z.string(),
      rdapRegisteredAt: z.string().nullable().optional(),
      checkedAt: z.string(),
    }),
  ),
  deltaDetonations: z.record(
    z.string(),
    z.object({
      provider: z.enum(['urlscan.io', 'cloudflare-url-scanner']),
      verdict: z.enum(['submitted', 'clean', 'malicious']),
      reportUrl: z.string().nullable(),
      scannedAt: z.string(),
    }),
  ),
  cleanStreaks: z.object({ hosts: countRecord, urls: countRecord }).optional(),
});

export interface VerifierDriftState {
  readonly urlFingerprints: Readonly<Record<string, UrlBaselineFingerprint>>;
  readonly deltaDetonations: Readonly<Record<string, DeltaDetonationRecord>>;
  /** Clean runs in a row per automated flag; absent before the first run that stored them. */
  readonly cleanStreaks?: FlagCleanStreaks;
}

function resolveRedisCredentials(
  override?: RedisManifestCredentials,
): { readonly url: string; readonly token: string } | null {
  if (override?.url && override?.token) {
    return {
      url: override.url.trim().replace(/\/+$/, ''),
      token: override.token.trim(),
    };
  }
  if (typeof window !== 'undefined') return null;
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? '').trim().replace(/\/+$/, '');
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? '').trim();
  if (!url || !token) return null;
  return { url, token };
}

/** One Upstash GET of `key`. */
function requestUpstashGet(
  key: string,
  creds: { readonly url: string; readonly token: string },
  options: RedisReadOptions,
): Promise<Response> {
  return (options.fetcher ?? fetch)(`${creds.url}/get/${encodeURIComponent(key)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${creds.token}` },
    signal: AbortSignal.timeout(options.timeoutMs ?? REDIS_TIMEOUT_MS),
    cache: 'no-store',
  });
}

const isTimeout = (cause: unknown): boolean =>
  typeof cause === 'object' &&
  cause !== null &&
  'name' in cause &&
  (cause.name === 'TimeoutError' || cause.name === 'AbortError');

/** The first zod issue's path, as `blockedHosts` or `cleanStreaks.hosts.example.com`. */
const issuePath = (error: z.ZodError): string =>
  error.issues[0]?.path.map(String).join('.') || 'the top level';

/**
 * The sweep's read of `key`: the stored value checked against `schema`, null only when Upstash
 * answers that the key is not there, and a RedisReadError for anything it cannot trust.
 */
async function upstashGetStrict<T>(
  key: string,
  what: string,
  schema: z.ZodType<T>,
  options: RedisReadOptions,
): Promise<T | null> {
  const creds = resolveRedisCredentials(options.credentials);
  if (!creds) {
    throw new RedisReadError(
      what,
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set',
    );
  }
  let res: Response;
  try {
    res = await requestUpstashGet(key, creds, options);
  } catch (cause) {
    throw new RedisReadError(what, isTimeout(cause) ? 'timed out' : 'the request failed', {
      cause,
    });
  }
  if (!res.ok) throw new RedisReadError(what, `HTTP ${res.status}`);
  let body: unknown;
  try {
    body = await res.json();
  } catch (cause) {
    throw new RedisReadError(what, 'the response was not JSON', { cause });
  }
  const result = typeof body === 'object' && body !== null && 'result' in body ? body.result : {};
  if (result === null) return null;
  if (typeof result !== 'string')
    throw new RedisReadError(what, 'the response had no stored value');
  let stored: unknown;
  try {
    stored = JSON.parse(result);
  } catch (cause) {
    throw new RedisReadError(what, 'the stored value is not JSON', { cause });
  }
  const parsed = schema.safeParse(stored);
  if (!parsed.success) {
    throw new RedisReadError(
      what,
      `the stored value has the wrong shape at ${issuePath(parsed.error)}`,
    );
  }
  return parsed.data;
}

async function upstashGetJson<T>(key: string, options: RedisReadOptions = {}): Promise<T | null> {
  const creds = resolveRedisCredentials(options.credentials);
  if (!creds) return null;
  try {
    const res = await requestUpstashGet(key, creds, options);
    if (!res.ok) return null;
    const body = (await res.json()) as { readonly result?: string | null };
    if (!body.result || typeof body.result !== 'string') return null;
    return JSON.parse(body.result) as T;
  } catch {
    // Not reported here: the verify CLI shares this module. The caller falls back to the
    // committed manifest (or a fresh baseline in the sweep).
    return null;
  }
}

async function upstashSetJson(
  key: string,
  value: unknown,
  options: {
    readonly credentials?: RedisManifestCredentials;
    readonly ttlSeconds?: number;
    readonly timeoutMs?: number;
    readonly fetcher?: FetchLike;
  } = {},
): Promise<boolean> {
  const creds = resolveRedisCredentials(options.credentials);
  if (!creds) return false;
  const fetcher = options.fetcher ?? fetch;
  const ttl = options.ttlSeconds ?? REDIS_MANIFEST_TTL_SECONDS;
  try {
    const res = await fetcher(creds.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SET', key, JSON.stringify(value), 'EX', String(ttl)]),
      signal: AbortSignal.timeout(options.timeoutMs ?? 6000),
    });
    return res.ok;
  } catch {
    // The sweep prints the outcome (redisPublished: false); nothing is reported from here.
    return false;
  }
}

/**
 * Merges the bundled git manifest with a live Upstash Redis overlay:
 * - Hard-quarantined hosts and URLs union cleanly so git-committed blocks can never be regressed.
 * - Live `unavailableUrls` and telemetry supersede stale bundled values when Redis is newer.
 */
export function mergeSecurityManifests(
  bundled: FreeBooksSecurityManifest,
  live: FreeBooksSecurityManifest | null,
): {
  readonly manifest: FreeBooksSecurityManifest;
  readonly source: ManifestSource;
} {
  if (!live || typeof live.generatedAt !== 'string') {
    return { manifest: bundled, source: 'bundled' };
  }

  const liveTime = Date.parse(live.generatedAt);
  const bundledTime = Date.parse(bundled.generatedAt);
  const liveIsNewer =
    Number.isFinite(liveTime) && (!Number.isFinite(bundledTime) || liveTime >= bundledTime);

  return {
    source: 'redis',
    manifest: {
      generatedAt: liveIsNewer ? live.generatedAt : bundled.generatedAt,
      checkedHosts: liveIsNewer ? live.checkedHosts : bundled.checkedHosts,
      checkedUrls: liveIsNewer ? live.checkedUrls : bundled.checkedUrls,
      blockedHosts: { ...bundled.blockedHosts, ...live.blockedHosts },
      quarantinedUrls: { ...bundled.quarantinedUrls, ...live.quarantinedUrls },
      unavailableUrls: liveIsNewer ? { ...live.unavailableUrls } : { ...bundled.unavailableUrls },
    },
  };
}

/**
 * Reads the slim runtime security manifest overlay from Upstash Redis: fail-open to null for the
 * site, or, with `strict`, validated and throwing a RedisReadError on anything but a missing key.
 */
export async function loadLiveSecurityManifestFromRedis(
  options: RedisReadOptions = {},
): Promise<FreeBooksSecurityManifest | null> {
  return options.strict
    ? upstashGetStrict(REDIS_RUNTIME_MANIFEST_KEY, 'live manifest', runtimeManifestSchema, options)
    : upstashGetJson<FreeBooksSecurityManifest>(REDIS_RUNTIME_MANIFEST_KEY, options);
}

/**
 * Reads the verifier's drift state (fingerprints, sandbox history, clean-run counts) from Upstash
 * Redis, fail-open to null, or strictly as loadLiveSecurityManifestFromRedis does.
 */
export async function loadVerifierDriftStateFromRedis(
  options: RedisReadOptions = {},
): Promise<VerifierDriftState | null> {
  return options.strict
    ? upstashGetStrict(REDIS_FINGERPRINTS_KEY, 'drift state', driftStateSchema, options)
    : upstashGetJson<VerifierDriftState>(REDIS_FINGERPRINTS_KEY, options);
}

/**
 * Publishes both the slim runtime manifest (`blockedHosts`, `quarantinedUrls`, `unavailableUrls`)
 * and the verifier's drift state (`urlFingerprints`, `deltaDetonations`, `cleanStreaks`) to
 * Upstash Redis so production picks up live security patches with zero code deploys. The runtime
 * payload never carries the drift fields, so what the site reads keeps its shape.
 */
export async function publishSecurityManifestToRedis(
  manifest: FreeBooksSecurityManifest,
  options: {
    readonly credentials?: RedisManifestCredentials;
    readonly timeoutMs?: number;
    readonly fetcher?: FetchLike;
  } = {},
): Promise<{ readonly runtimePublished: boolean; readonly fingerprintsPublished: boolean }> {
  const runtimePayload: FreeBooksSecurityManifest = {
    generatedAt: manifest.generatedAt,
    checkedHosts: manifest.checkedHosts,
    checkedUrls: manifest.checkedUrls,
    blockedHosts: manifest.blockedHosts,
    quarantinedUrls: manifest.quarantinedUrls,
    unavailableUrls: manifest.unavailableUrls,
  };
  const driftPayload: VerifierDriftState = {
    urlFingerprints: manifest.urlFingerprints ?? {},
    deltaDetonations: manifest.deltaDetonations ?? {},
    ...(manifest.cleanStreaks ? { cleanStreaks: manifest.cleanStreaks } : {}),
  };

  const [runtimePublished, fingerprintsPublished] = await Promise.all([
    upstashSetJson(REDIS_RUNTIME_MANIFEST_KEY, runtimePayload, options),
    upstashSetJson(REDIS_FINGERPRINTS_KEY, driftPayload, options),
  ]);

  return { runtimePublished, fingerprintsPublished };
}
