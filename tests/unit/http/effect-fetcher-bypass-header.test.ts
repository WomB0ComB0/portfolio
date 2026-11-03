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
 * @file The server-side fetcher may send Vercel's `x-vercel-protection-bypass` secret only to
 * this site's own origin. It used to attach it to every server-side request, including
 * third-party APIs (Spotify, GitHub, WakaTime, YouTube, ...).
 *
 * Runs in the node environment: on the server `getBaseURL()` is absolute; under jsdom it is ''.
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

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');

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

describe('effect-fetcher: Vercel protection bypass header', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs with an absolute server-side base URL', () => {
    expect(globalThis.window).toBeUndefined();
    expect(BASE).toMatch(/^https?:\/\//);
  });

  it('sends the bypass secret on relative requests to our own API', async () => {
    const { url, headers } = await captureRequest('/api/v1/blog');
    expect(url).toBe(`${BASE}/api/v1/blog`);
    expect(headers.get('x-vercel-protection-bypass')).toBe(SECRET);
  });

  it('sends it for an absolute URL on our own origin', async () => {
    const { headers } = await captureRequest(`${BASE}/api/v1/wakatime`);
    expect(headers.get('x-vercel-protection-bypass')).toBe(SECRET);
  });

  it.each([
    'https://api.spotify.com/v1/me/player/currently-playing',
    'https://api.github.com/users/WomB0ComB0',
    'https://wakatime.com/api/v1/users/current/all_time_since_today',
    // Same host name on a different scheme or port is a different origin.
    `${BASE.replace(/^http:/, 'https:').replace(/^https:\/\/([^/:]+)(:\d+)?/, 'https://$1:8443')}/api`,
  ])('never sends it to another origin: %s', async (external) => {
    const { headers } = await captureRequest(external);
    expect(headers.has('x-vercel-protection-bypass')).toBe(false);
  });
});
