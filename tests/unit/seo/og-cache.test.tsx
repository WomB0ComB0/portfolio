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
 * @file /api/og's cards are kept by the CDN. ImageResponse answers 'public, max-age=0,
 * must-revalidate' unless told otherwise, which Vercel's CDN never keeps, so every link-preview
 * fetch ran Satori and resvg again. A drawn card now carries s-maxage; its words are in its URL,
 * so a changed card is a new URL. The guard's refusals and a failed render stay `no-store`, and
 * the guard runs inside the function, so only a CDN miss reaches it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

// t3-env validates on import. Every value reads as unset, Upstash's URL and token included.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

const guard = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock('@/lib/security/api-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/security/api-guard')>()),
  apiGuard: guard,
}));

/** Set to make the faces fail to load, so the card cannot be drawn. */
const faces = vi.hoisted(() => ({ fail: false }));
vi.mock('@/lib/og/fonts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/og/fonts')>();
  return {
    ...actual,
    loadOgFonts: () =>
      faces.fail ? Promise.reject(new Error('the faces are missing')) : actual.loadOgFonts(),
  };
});

import { GET } from '@/app/api/og/route';
import { SiteCard } from '@/lib/og/cards';
import { PAGE_CARD_CACHE_CONTROL } from '@/lib/og/constants';
import { renderOgCard } from '@/lib/og/render';

/** Rendering a card takes a few hundred milliseconds; the first also loads the fonts and wasm. */
const RENDER_TIMEOUT = 30_000;

const request = (): Request =>
  new Request('https://mikeodnis.dev/api/og?title=Projects&description=Things', {
    headers: { 'x-forwarded-for': '203.0.113.7' },
  });

/** The seconds a Cache-Control value gives `directive`, or undefined when it has none. */
function secondsOf(cacheControl: string | null, directive: string): number | undefined {
  const match = new RegExp(`(?:^|,)\\s*${directive}=(\\d+)`).exec(cacheControl ?? '');
  return match ? Number(match[1]) : undefined;
}

afterEach(() => {
  guard.check.mockReset();
  faces.fail = false;
});

describe('the page card route (/api/og) and the CDN', () => {
  it(
    'sends a drawn card with an s-maxage, so the CDN answers later fetches of the same URL',
    async () => {
      guard.check.mockResolvedValue({ kind: 'allow' });

      const response = await GET(request());
      const cacheControl = response.headers.get('cache-control');

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/png');
      expect(cacheControl).toBe(PAGE_CARD_CACHE_CONTROL);
      expect(cacheControl).toMatch(/^public,/);
      expect(secondsOf(cacheControl, 's-maxage')).toBeGreaterThanOrEqual(86_400);
      expect(secondsOf(cacheControl, 'stale-while-revalidate')).toBeGreaterThan(0);
      expect(cacheControl).not.toMatch(/no-store|no-cache|must-revalidate|private/);
    },
    RENDER_TIMEOUT,
  );

  it('keeps a 429 from the guard out of every cache', async () => {
    guard.check.mockResolvedValue({ kind: 'limit', limit: 30, reset: Date.now() + 5_000 });

    const response = await GET(request());

    expect(response.status).toBe(429);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('keeps a 403 from the guard out of every cache', async () => {
    guard.check.mockResolvedValue({ kind: 'ban' });

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('keeps a failed render (500) out of every cache, so the next fetch draws again', async () => {
    guard.check.mockResolvedValue({ kind: 'allow' });
    faces.fail = true;

    const response = await GET(request());

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('asks the guard only when the function runs, once per request', async () => {
    guard.check.mockResolvedValue({ kind: 'ban' });

    await GET(request());

    expect(guard.check).toHaveBeenCalledTimes(1);
  });
});

describe('renderOgCard', () => {
  it(
    "keeps ImageResponse's own Cache-Control when no headers are given (the prerendered site cards)",
    async () => {
      const response = await renderOgCard(<SiteCard />);

      expect(response.headers.get('cache-control')).not.toBe(PAGE_CARD_CACHE_CONTROL);
      expect(secondsOf(response.headers.get('cache-control'), 's-maxage')).toBeUndefined();
    },
    RENDER_TIMEOUT,
  );
});
