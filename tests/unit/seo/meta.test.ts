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
 * @file constructMetadata emits only real tags: no placeholder video or player, a large-image
 * Twitter card, the site name as og:site_name, and an og:url only when the caller names the path.
 * Its preview image is the site card for the site's own tags, a page card (/api/og) for a page
 * without an image of its own, or the page's image; its icons are the palette set in public/.
 * It names a place (geo.placename, and a keyword) only from the location it is given, and builds
 * none in.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { publicImageInfo } from '@tests/fixtures/image-size';
import { afterAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

import { app } from '@/constants';
import { siteCardAlt } from '@/lib/og/constants';
import { constructMetadata } from '@/utils/seo/meta';

afterAll(() => {
  vi.unstubAllEnvs();
});

const statsMetadata = () =>
  constructMetadata({ title: 'Stats', description: 'Live stats', path: '/stats' });

describe('constructMetadata', () => {
  it('emits no example.com placeholder anywhere when no video or player is passed', () => {
    expect(JSON.stringify(constructMetadata())).not.toContain('example.com');
    expect(JSON.stringify(statsMetadata())).not.toContain('example.com');
  });

  it('emits no og:video and no Twitter player by default', () => {
    const metadata = statsMetadata();

    expect(metadata.openGraph).not.toHaveProperty('videos');
    expect(metadata.twitter).not.toHaveProperty('players');
  });

  it('uses a large-image Twitter card', () => {
    expect(statsMetadata().twitter).toMatchObject({ card: 'summary_large_image' });
  });

  it('names the site, not the page, in og:site_name', () => {
    expect(app.name).toBe('Mike Odnis');
    expect(statsMetadata().openGraph).toMatchObject({ siteName: app.name, title: 'Stats' });
  });

  it('builds an absolute og:url from the path', () => {
    expect(statsMetadata().openGraph).toMatchObject({ url: 'https://mikeodnis.dev/stats' });
    expect(constructMetadata({ path: '/projects/abc' }).openGraph).toMatchObject({
      url: 'https://mikeodnis.dev/projects/abc',
    });
  });

  it('omits og:url when no path is given instead of pointing at the homepage', () => {
    expect(constructMetadata({ title: 'Stats' }).openGraph).not.toHaveProperty('url');
    expect(constructMetadata().openGraph).not.toHaveProperty('url');
  });

  it('drops the currentYear and timeZone meta tags', () => {
    const other = statsMetadata().other ?? {};

    expect(other).not.toHaveProperty('currentYear');
    expect(other).not.toHaveProperty('timeZone');
  });

  it('declares the generated OG image at the 1200x630 size /api/og renders', () => {
    const [image] = [statsMetadata().openGraph?.images].flat();

    expect(image).toEqual({
      url: '/api/og?title=Stats&description=Live%20stats',
      width: 1200,
      height: 630,
      type: 'image/png',
      alt: 'Stats',
    });
  });

  it("shows the site card (the opengraph-image and twitter-image routes) for the site's own tags", () => {
    const metadata = constructMetadata();
    const card = { width: 1200, height: 630, type: 'image/png', alt: siteCardAlt() };

    expect(metadata.openGraph?.images).toEqual([{ url: '/opengraph-image', ...card }]);
    expect(metadata.twitter).toMatchObject({ images: [{ url: '/twitter-image', ...card }] });
    expect(siteCardAlt()).toContain(app.name);
  });

  it('keeps the site card for a page titled with the site name, whatever its description', () => {
    const metadata = constructMetadata({ description: 'Another sentence.' });

    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({ url: '/opengraph-image' }),
    ]);
  });

  it('points no page at the old static purple card', () => {
    for (const metadata of [constructMetadata(), statsMetadata()]) {
      expect(JSON.stringify(metadata)).not.toMatch(/opengraph-image\.png|twitter-image\.png/);
    }
  });

  it('declares the palette favicon, SVG icon and apple-touch icon, which exist in public/', () => {
    const { icons } = constructMetadata();

    expect(icons).toEqual({
      icon: [
        { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
        { url: '/pwa/icon.svg', type: 'image/svg+xml' },
      ],
      apple: [{ url: '/pwa/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    });
    expect(publicImageInfo('/pwa/apple-touch-icon.png')).toMatchObject({ width: 180, height: 180 });
    for (const file of ['favicon.ico', 'pwa/icon.svg']) {
      expect(existsSync(join(process.cwd(), 'public', file)), file).toBe(true);
    }
  });

  it('keeps a caller-supplied image as is, without guessing its size', () => {
    const metadata = constructMetadata({ title: 'P', image: 'https://cdn.sanity.io/p.png' });

    expect(metadata.openGraph?.images).toEqual([{ url: 'https://cdn.sanity.io/p.png' }]);
    expect(metadata.twitter).toMatchObject({ images: [{ url: 'https://cdn.sanity.io/p.png' }] });
  });

  it('emits video and player tags only from what the caller passes', () => {
    const metadata = constructMetadata({
      video: { url: 'https://mikeodnis.dev/intro.mp4', type: 'video/mp4' },
      player: {
        playerUrl: 'https://mikeodnis.dev/embed/intro',
        streamUrl: 'https://mikeodnis.dev/intro.mp4',
        width: 1280,
        height: 720,
      },
    });

    expect(metadata.openGraph).toMatchObject({
      videos: [{ url: 'https://mikeodnis.dev/intro.mp4', type: 'video/mp4' }],
    });
    expect(metadata.twitter).toMatchObject({
      card: 'player',
      players: [
        {
          playerUrl: 'https://mikeodnis.dev/embed/intro',
          streamUrl: 'https://mikeodnis.dev/intro.mp4',
          width: 1280,
          height: 720,
        },
      ],
    });
  });
});

/** Any spelling of the city the site's metadata used to name on its own. */
const CITY = /new york|\bnyc\b|\bny\b/i;

// Owner decision: Location in Studio decides whether the site names a place at all. The city was
// built into every page's keywords ('Software Engineer NYC', ...) and its geo.placename tag, so
// clearing the setting hid it from the hero only.
describe('constructMetadata and the location', () => {
  it('names the place it is given, as geo.placename and as a keyword', () => {
    const metadata = constructMetadata({ path: '/', location: 'Brooklyn, NY' });

    expect(metadata.other).toEqual({ 'geo.placename': 'Brooklyn, NY' });
    expect(metadata.keywords).toEqual([...app.keywords, 'Brooklyn, NY']);
  });

  it('trims the place it is given', () => {
    const metadata = constructMetadata({ location: '  Brooklyn, NY \n' });

    expect(metadata.other).toEqual({ 'geo.placename': 'Brooklyn, NY' });
    expect(metadata.keywords).toContain('Brooklyn, NY');
  });

  it.each([
    ['no location', undefined],
    ['a null location', null],
    ['an empty location', ''],
    ['a location of spaces', '  \n '],
  ])('names no place anywhere for %s', (_case, location) => {
    const metadata = constructMetadata({ title: 'Stats', path: '/stats', location });

    expect(metadata).not.toHaveProperty('other');
    expect(metadata.keywords).toEqual([...app.keywords]);
    expect(JSON.stringify(metadata)).not.toMatch(CITY);
  });

  it('builds no city into the keywords, the site’s own or a page’s', () => {
    expect(app.keywords.filter((keyword) => CITY.test(keyword))).toEqual([]);
    expect(JSON.stringify(constructMetadata())).not.toMatch(CITY);
  });

  it('keeps the college as a keyword: it says where he studied, nothing of where he is', () => {
    expect(app.keywords).toContain('Farmingdale State College');
    expect('Farmingdale State College').not.toMatch(CITY);
  });

  it('describes the site as the hero and the manifest do, with no age, school or place', () => {
    const heroLine = app.tagline.replace(/\.$/, '').toLowerCase();

    expect(app.description).toMatch(new RegExp(`^${app.name} is a software engineer ${heroLine}`));
    expect(app.description).toContain(
      'projects, experience, certifications, places and live stats',
    );
    expect(app.description).not.toMatch(/\d|year-old|student|college|Farmingdale/i);
    expect(app.description).not.toMatch(CITY);
    // About what a search result shows before it cuts the snippet.
    expect(app.description.length).toBeLessThanOrEqual(160);
  });
});
