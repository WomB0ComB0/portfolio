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
 * @file The web app manifest (/manifest.webmanifest): the site's own name and copy, an app
 * identity and scope, the palette icons (maskable ones included), a shortcut per current
 * section and screenshots of the Live Console site in both form factors. Every file it names is
 * checked on disk at the size it declares, with the limits Chrome's install UI applies to
 * screenshots. The shortcut descriptions are checked against the pages' own metadata in
 * page-og-url.test.ts, and the theme colours in theme-color.test.ts.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { publicImageInfo } from '@tests/fixtures/image-size';
import { describe, expect, it, vi } from 'vitest';

// t3-env validates on import; the manifest needs no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import manifest from '@/app/manifest';
import { app } from '@/constants';

/** The file in public/ that serves `urlPath`. */
const fromPublic = (urlPath: string): string => join(process.cwd(), 'public', urlPath);

/** The MIME type a file's extension implies, for the formats the manifest uses. */
const MIME_OF: Readonly<Record<string, string>> = {
  png: 'image/png',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};
/** The MIME type `src`'s extension implies, or undefined for one not listed above. */
const mimeOf = (src: string): string | undefined => MIME_OF[src.split('.').pop() ?? ''];

/** '512x512' as [512, 512]. */
const sizeOf = (sizes: string | undefined): readonly [number, number] => {
  const [width, height] = (sizes ?? '').split('x').map(Number);
  return [width ?? Number.NaN, height ?? Number.NaN];
};

const SECTION_SHORTCUTS = [
  '/projects',
  '/places',
  '/places/photos',
  '/certifications',
  '/guestbook',
  '/stats',
];

describe('manifest identity and copy', () => {
  const m = manifest();

  it('names the app as the site does, with a short name that fits under an icon', () => {
    expect(m.name).toBe(app.name);
    expect(m.short_name).toBe(app.name);
    expect(m.short_name?.length).toBeLessThanOrEqual(12);
  });

  it('describes the site with its current positioning line, not the old age-and-college copy', () => {
    expect(m.description?.startsWith(app.tagline)).toBe(true);
    expect(m.description).not.toMatch(/year-old|innovative|passionate/i);
  });

  it('has a stable id, the whole site as its scope, and starts at the home page', () => {
    expect(m.id).toBe('/');
    expect(m.scope).toBe('/');
    expect(m.start_url).toBe('/');
  });

  it('opens standalone, falls back to minimal-ui, and lets the device choose the orientation', () => {
    expect(m.display).toBe('standalone');
    expect(m.display_override).toEqual(['standalone', 'minimal-ui']);
    expect(m.orientation).toBe('any');
  });

  it('lists a few categories, not the SEO keyword list', () => {
    expect(m.categories?.length ?? 0).toBeLessThanOrEqual(3);
    expect(m.categories).not.toEqual(expect.arrayContaining(['Mike Odnis', 'TypeScript']));
  });

  it('declares no share target or protocol handler, which the site does not handle', () => {
    expect(m).not.toHaveProperty('share_target');
    expect(m).not.toHaveProperty('protocol_handlers');
  });
});

describe('manifest icons', () => {
  const icons = manifest().icons ?? [];
  const rasters = icons.filter((icon) => icon.type !== 'image/svg+xml');

  it.each([
    ['any', '192x192'],
    ['any', '512x512'],
    ['maskable', '192x192'],
    ['maskable', '512x512'],
  ])('has a %s PNG at %s', (purpose, sizes) => {
    expect(icons).toContainEqual(expect.objectContaining({ purpose, sizes, type: 'image/png' }));
  });

  it('has a scalable SVG icon', () => {
    const svg = icons.find((icon) => icon.type === 'image/svg+xml');

    expect(svg).toMatchObject({ sizes: 'any', purpose: 'any' });
    expect(existsSync(fromPublic(svg?.src ?? '/missing.svg'))).toBe(true);
  });

  it.each(rasters.map((icon) => [icon.src, icon] as const))(
    '%s exists at the size and type it declares',
    (src, icon) => {
      const info = publicImageInfo(src);
      const [width, height] = sizeOf(icon.sizes);

      expect([info.width, info.height]).toEqual([width, height]);
      expect(icon.type).toBe(mimeOf(src));
    },
  );

  it('fills every maskable icon edge to edge (no alpha), so the mask never shows a hole', () => {
    const maskable = icons.filter((icon) => icon.purpose === 'maskable');

    expect(maskable.length).toBeGreaterThanOrEqual(2);
    for (const icon of maskable) expect(publicImageInfo(icon.src).hasAlpha, icon.src).toBe(false);
  });

  it('drops the old purple PWABuilder set and the embedded-PNG SVG logo', () => {
    for (const icon of icons) {
      expect(icon.src).not.toMatch(/^\/pwa\/(windows11|ios|android)\//);
      expect(icon.src).not.toMatch(/^\/assets\/svgs\//);
    }
  });
});

describe('manifest shortcuts', () => {
  const shortcuts = manifest().shortcuts ?? [];

  it("goes straight to the site's current sections, in this order", () => {
    expect(shortcuts.map((shortcut) => shortcut.url)).toEqual(SECTION_SHORTCUTS);
  });

  it.each(shortcuts.map((shortcut) => [shortcut.url, shortcut] as const))(
    '%s has a name, a short name that fits, a description and a 96px icon on disk',
    (_url, shortcut) => {
      expect(shortcut.name).toBeTruthy();
      expect(shortcut.short_name?.length ?? 0).toBeGreaterThan(0);
      expect(shortcut.short_name?.length ?? 0).toBeLessThanOrEqual(12);
      expect(shortcut.description).toBeTruthy();
      expect(shortcut.icons).toHaveLength(1);

      const [icon] = shortcut.icons ?? [];
      const info = publicImageInfo(icon?.src ?? '/missing.png');
      expect(icon).toMatchObject({ sizes: '96x96', type: 'image/png' });
      expect([info.width, info.height]).toEqual([96, 96]);
    },
  );
});

describe('manifest screenshots', () => {
  const screenshots = manifest().screenshots ?? [];
  const wide = screenshots.filter((shot) => shot.form_factor === 'wide');
  const narrow = screenshots.filter((shot) => shot.form_factor === 'narrow');

  it('shows the site on a desktop and on a phone', () => {
    expect(wide.length).toBeGreaterThanOrEqual(1);
    expect(narrow.length).toBeGreaterThanOrEqual(1);
    expect(wide.length + narrow.length).toBe(screenshots.length);
  });

  it.each(screenshots.map((shot) => [shot.src, shot] as const))(
    '%s exists at the size and type it declares, within the install UI limits',
    (src, shot) => {
      const info = publicImageInfo(src);
      const [width, height] = sizeOf(shot.sizes);

      expect([info.width, info.height]).toEqual([width, height]);
      expect(shot.type).toBe(mimeOf(src));
      expect(shot.label).toBeTruthy();
      for (const side of [width, height]) {
        expect(side).toBeGreaterThanOrEqual(320);
        expect(side).toBeLessThanOrEqual(3840);
      }
      expect(Math.max(width, height) / Math.min(width, height)).toBeLessThanOrEqual(2.3);
      if (shot.form_factor === 'wide') expect(width).toBeGreaterThan(height);
      if (shot.form_factor === 'narrow') expect(height).toBeGreaterThan(width);
    },
  );

  it('keeps one aspect ratio per form factor, as Chrome requires', () => {
    for (const group of [wide, narrow]) {
      const ratios = new Set(
        group.map((shot) => {
          const [width, height] = sizeOf(shot.sizes);
          return (width / height).toFixed(3);
        }),
      );
      expect(ratios.size).toBe(1);
    }
  });

  it('replaces the old pre-redesign screenshots', () => {
    for (const shot of screenshots) {
      expect(shot.src).not.toMatch(/\/assets\/images\/screen-shot-(narrow|wide)\.png$/);
    }
  });
});
