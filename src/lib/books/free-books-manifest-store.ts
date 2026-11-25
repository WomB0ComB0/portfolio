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
 * @file Zero-deploy live security manifest store backed by Upstash Redis REST API,
 * with automatic fallback to the committed `src/data/free-books-security.json` baseline.
 *
 * Uses pure `fetch` (no `node:*` or SDK imports) so callers stay safe across Next.js runtimes,
 * Bun CLI scripts, and Vitest unit tests.
 */

import type {
  DeltaDetonationRecord,
  FetchLike,
  FreeBooksSecurityManifest,
  UrlBaselineFingerprint,
} from './free-books-verifier';

export const REDIS_RUNTIME_MANIFEST_KEY = 'bookshelf:free:security-manifest:v1';
export const REDIS_FINGERPRINTS_KEY = 'bookshelf:free:fingerprints:v1';

/** 30-day TTL (refreshed weekly by `free-books-verify.yml`, so live patches never vanish early). */
const REDIS_MANIFEST_TTL_SECONDS = 30 * 24 * 60 * 60;
const REDIS_TIMEOUT_MS = 2500;

export interface RedisManifestCredentials {
  readonly url?: string;
  readonly token?: string;
}

export interface VerifierDriftState {
  readonly urlFingerprints: Readonly<Record<string, UrlBaselineFingerprint>>;
  readonly deltaDetonations: Readonly<Record<string, DeltaDetonationRecord>>;
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

async function upstashGetJson<T>(
  key: string,
  options: {
    readonly credentials?: RedisManifestCredentials;
    readonly timeoutMs?: number;
    readonly fetcher?: FetchLike;
  } = {},
): Promise<T | null> {
  const creds = resolveRedisCredentials(options.credentials);
  if (!creds) return null;
  const fetcher = options.fetcher ?? fetch;
  try {
    const res = await fetcher(`${creds.url}/get/${encodeURIComponent(key)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${creds.token}` },
      signal: AbortSignal.timeout(options.timeoutMs ?? REDIS_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { readonly result?: string | null };
    if (!body.result || typeof body.result !== 'string') return null;
    return JSON.parse(body.result) as T;
  } catch {
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
  readonly source: 'redis' | 'bundled';
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

/** Reads the slim runtime security manifest overlay from Upstash Redis (fail-open to null). */
export async function loadLiveSecurityManifestFromRedis(
  options: {
    readonly credentials?: RedisManifestCredentials;
    readonly timeoutMs?: number;
    readonly fetcher?: FetchLike;
  } = {},
): Promise<FreeBooksSecurityManifest | null> {
  return upstashGetJson<FreeBooksSecurityManifest>(REDIS_RUNTIME_MANIFEST_KEY, options);
}

/** Reads verifier drift fingerprints + delta detonation history from Upstash Redis. */
export async function loadVerifierDriftStateFromRedis(
  options: {
    readonly credentials?: RedisManifestCredentials;
    readonly timeoutMs?: number;
    readonly fetcher?: FetchLike;
  } = {},
): Promise<VerifierDriftState | null> {
  return upstashGetJson<VerifierDriftState>(REDIS_FINGERPRINTS_KEY, options);
}

/**
 * Publishes both the slim runtime manifest (`blockedHosts`, `quarantinedUrls`, `unavailableUrls`)
 * and the verifier's drift baselines (`urlFingerprints`, `deltaDetonations`) to Upstash Redis
 * so production picks up live security patches with zero code deploys.
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
  };

  const [runtimePublished, fingerprintsPublished] = await Promise.all([
    upstashSetJson(REDIS_RUNTIME_MANIFEST_KEY, runtimePayload, options),
    upstashSetJson(REDIS_FINGERPRINTS_KEY, driftPayload, options),
  ]);

  return { runtimePublished, fingerprintsPublished };
}
