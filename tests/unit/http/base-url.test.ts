// @vitest-environment node
/**
 * Copyright 2025 Mike Odnis
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
 * @file The server-side base URL for SSR self-fetches. Production doesn't set
 * NEXT_PUBLIC_SITE_URL, so SSR used to call the per-deployment URL (NEXT_PUBLIC_VERCEL_URL),
 * which skips the CDN: 2.9-3.3 s at p95 against 29 ms for the same URL on the production domain.
 * On production it now uses Vercel's VERCEL_PROJECT_PRODUCTION_URL; previews use VERCEL_URL.
 *
 * Both helpers are covered: getURL() and the effect fetcher, which resolves relative paths with it.
 */

import { FetchHttpClient } from '@effect/platform';
import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'test-bypass-secret';
vi.mock('@/env', () => {
  const env = { VERCEL_AUTOMATION_BYPASS_SECRET: 'test-bypass-secret' };
  return { env, default: env };
});

import { get } from '@/lib/http-clients/effect-fetcher';
import { getURL } from '@/utils/formatting/helpers';

const PRODUCTION_HOST = 'mikeodnis.dev';
const DEPLOYMENT_HOST = 'portfolio-abc123-wombocombo.vercel.app';
const PREVIEW_HOST = 'portfolio-git-feature-wombocombo.vercel.app';

/** Every variable the base URL depends on; tests set each one, so the shell's env can't leak in. */
type BaseURLEnv = Partial<
  Record<
    | 'NEXT_PUBLIC_SITE_URL'
    | 'VERCEL_ENV'
    | 'VERCEL_PROJECT_PRODUCTION_URL'
    | 'VERCEL_URL'
    | 'NEXT_PUBLIC_VERCEL_URL'
    | 'PORT',
    string
  >
>;

const BASE_URL_VARS: ReadonlyArray<keyof BaseURLEnv> = [
  'NEXT_PUBLIC_SITE_URL',
  'VERCEL_ENV',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_URL',
  'NEXT_PUBLIC_VERCEL_URL',
  'PORT',
];

function setEnv(values: BaseURLEnv): void {
  for (const name of BASE_URL_VARS) vi.stubEnv(name, values[name]);
}

/** What Vercel sets on a production deployment, with NEXT_PUBLIC_SITE_URL unset as it is today. */
const PRODUCTION: BaseURLEnv = {
  VERCEL_ENV: 'production',
  VERCEL_PROJECT_PRODUCTION_URL: PRODUCTION_HOST,
  VERCEL_URL: DEPLOYMENT_HOST,
  NEXT_PUBLIC_VERCEL_URL: DEPLOYMENT_HOST,
};

/** A preview deployment: VERCEL_PROJECT_PRODUCTION_URL is set there too, and must be ignored. */
const PREVIEW: BaseURLEnv = {
  VERCEL_ENV: 'preview',
  VERCEL_PROJECT_PRODUCTION_URL: PRODUCTION_HOST,
  VERCEL_URL: PREVIEW_HOST,
};

/** Runs a GET through the real fetcher and returns the URL and headers that reached fetch. */
async function captureRequest(input: string) {
  const fetchMock = vi.fn(
    async () =>
      new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  await Effect.runPromise(get(input, { retries: 0 }).pipe(Effect.provide(FetchHttpClient.layer)));
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string | URL, RequestInit];
  return { url: String(url), headers: new Headers(init?.headers) };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('getURL on the server', () => {
  it('uses the production domain on production, not the deployment URL', () => {
    setEnv(PRODUCTION);
    expect(getURL()).toBe(`https://${PRODUCTION_HOST}`);
    expect(getURL('/api/v1/sanity/places')).toBe(`https://${PRODUCTION_HOST}/api/v1/sanity/places`);
  });

  it('uses the preview deployment’s own URL on a preview', () => {
    setEnv(PREVIEW);
    expect(getURL()).toBe(`https://${PREVIEW_HOST}`);
  });

  it('falls back to the deployment URL on production without a production domain', () => {
    setEnv({ ...PRODUCTION, VERCEL_PROJECT_PRODUCTION_URL: undefined });
    expect(getURL()).toBe(`https://${DEPLOYMENT_HOST}`);
  });

  it('lets an explicit NEXT_PUBLIC_SITE_URL win over every Vercel variable', () => {
    setEnv({ ...PRODUCTION, NEXT_PUBLIC_SITE_URL: 'https://www.example.dev/' });
    expect(getURL()).toBe('https://www.example.dev');
  });

  it('defaults to localhost on port 3000', () => {
    setEnv({});
    expect(getURL()).toBe('http://localhost:3000');
  });

  it('uses PORT for the local default', () => {
    setEnv({ PORT: '4123' });
    expect(getURL('api/v1/blog')).toBe('http://localhost:4123/api/v1/blog');
  });

  it('ignores the blank values `vercel env pull` writes for a local run', () => {
    setEnv({ NEXT_PUBLIC_SITE_URL: '  ', VERCEL_ENV: 'development', VERCEL_URL: '' });
    expect(getURL()).toBe('http://localhost:3000');
  });
});

describe('effect fetcher base URL on the server', () => {
  it('self-fetches relative API paths through the production domain on production', async () => {
    setEnv(PRODUCTION);
    const { url, headers } = await captureRequest('/api/v1/sanity/experience');

    expect(url).toBe(`https://${PRODUCTION_HOST}/api/v1/sanity/experience`);
    expect(headers.get('x-vercel-protection-bypass')).toBe(SECRET);
  });

  it('self-fetches through the preview deployment on a preview', async () => {
    setEnv(PREVIEW);
    const { url, headers } = await captureRequest('/api/v1/sanity/experience');

    expect(url).toBe(`https://${PREVIEW_HOST}/api/v1/sanity/experience`);
    expect(headers.get('x-vercel-protection-bypass')).toBe(SECRET);
  });

  it('still never sends the bypass secret to a third party', async () => {
    setEnv(PRODUCTION);
    const { headers } = await captureRequest('https://api.spotify.com/v1/me/top/tracks');

    expect(headers.has('x-vercel-protection-bypass')).toBe(false);
  });
});
