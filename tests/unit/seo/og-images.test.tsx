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
 * @file The link-preview images, rendered for real with next/og: the site card at
 * /opengraph-image and /twitter-image (file-convention routes in src/app) and the page cards at
 * /api/og, each a 1200x630 PNG, with the Geist faces read from disk the way the Node runtime
 * reads them. Card content and palette are checked in og-cards.test.tsx.
 */

import { imageInfo } from '@tests/fixtures/image-size';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

// t3-env validates on import; rendering needs no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import { GET as pageCard } from '@/app/api/og/route';
import OpenGraphImage, * as openGraphRoute from '@/app/opengraph-image';
import TwitterImage, * as twitterRoute from '@/app/twitter-image';
import { app } from '@/constants';
import { loadOgFonts } from '@/lib/og/fonts';

/** Rendering a card takes a few hundred milliseconds; the first also loads the fonts and wasm. */
const RENDER_TIMEOUT = 30_000;

/** The response's status and content type, and the PNG's real size. */
async function pngOf(response: Response) {
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    status: response.status,
    type: response.headers.get('content-type'),
    ...imageInfo(bytes),
  };
}

describe.each([
  ['/opengraph-image', openGraphRoute, OpenGraphImage],
  ['/twitter-image', twitterRoute, TwitterImage],
] as const)('%s', (_path, route, render) => {
  it('declares a 1200x630 PNG with alt text that names Mike', () => {
    expect(route.size).toEqual({ width: 1200, height: 630 });
    expect(route.contentType).toBe('image/png');
    expect(route.alt).toContain(app.name);
  });

  it(
    'renders that PNG',
    async () => {
      const png = await pngOf(await render());

      expect(png).toMatchObject({ status: 200, type: 'image/png', format: 'png' });
      expect([png.width, png.height]).toEqual([1200, 630]);
    },
    RENDER_TIMEOUT,
  );
});

describe('the page card route (/api/og)', () => {
  const get = (query: string) => pageCard(new Request(`https://mikeodnis.dev/api/og${query}`));

  it.each([
    ['a page title and description', '?title=Projects&description=Things%20I%20have%20built'],
    ['no query (the site card)', ''],
    ['a title far past the card limit', `?title=${'Long%20title%20'.repeat(80)}`],
  ])(
    'renders a 1200x630 PNG for %s',
    async (_case, query) => {
      const png = await pngOf(await get(query));

      expect(png).toMatchObject({ status: 200, type: 'image/png', format: 'png' });
      expect([png.width, png.height]).toEqual([1200, 630]);
    },
    RENDER_TIMEOUT,
  );
});

describe('the card fonts', () => {
  it('loads Geist and Geist Mono as TrueType faces, once', async () => {
    const fonts = await loadOgFonts();

    expect(fonts.map(({ name, weight }) => `${name} ${weight}`)).toEqual([
      'Geist 400',
      'Geist 500',
      'Geist 600',
      'Geist Mono 400',
    ]);
    for (const font of fonts) {
      expect(Buffer.from(font.data).readUInt32BE(0), font.name).toBe(0x0001_0000);
    }
    expect(await loadOgFonts()).toBe(fonts);
  });

  it('draws them unkerned, as Satori measures them, so the spaces between words stay even', async () => {
    for (const font of await loadOgFonts()) {
      expect(gposFeatureTags(Buffer.from(font.data)), `${font.name} ${font.weight}`).not.toContain(
        'kern',
      );
    }
  });
});

/** The feature tags in a TrueType font's GPOS table (empty without one). */
function gposFeatureTags(bytes: Buffer): string[] {
  const tables = bytes.readUInt16BE(4);
  for (let index = 0; index < tables; index++) {
    const record = 12 + index * 16;
    if (bytes.toString('ascii', record, record + 4) !== 'GPOS') continue;
    const gpos = bytes.readUInt32BE(record + 8);
    const featureList = gpos + bytes.readUInt16BE(gpos + 6);
    const count = bytes.readUInt16BE(featureList);
    return Array.from({ length: count }, (_, feature) => {
      const at = featureList + 2 + feature * 6;
      return bytes.toString('ascii', at, at + 4);
    });
  }
  return [];
}
