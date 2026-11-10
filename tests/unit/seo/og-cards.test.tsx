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
 * @file The link-preview cards (src/lib/og) in the Live Console look: what the site card and a
 * page card say, that they paint only with the site palette (each hex checked against its token
 * in globals.css), and how a page card fits a long title or description and reads its query.
 * The rendered PNGs are checked in og-images.test.tsx.
 */

import { oklchToHex, oklchToRgba, rootToken } from '@tests/fixtures/oklch';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

// t3-env validates on import; the cards need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import { app } from '@/constants';
import { PageCard, SiteCard } from '@/lib/og/cards';
import { SITE_HOST, SITE_ROLE } from '@/lib/og/constants';
import { OG_PALETTE, OG_TINTS } from '@/lib/og/palette';
import {
  clipText,
  fitDescription,
  fitTitle,
  PAGE_DESCRIPTION_MAX,
  PAGE_DESCRIPTION_UNDER_LONG_TITLE_MAX,
  PAGE_TITLE_MAX,
  readPageCard,
} from '@/lib/og/text';

/** The text a card shows, tags stripped and entities decoded. */
const textOf = (markup: string): string =>
  markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

const ALLOWED = new Set(
  [...Object.values(OG_PALETTE), ...Object.values(OG_TINTS)].map((colour) =>
    colour.replace(/\s+/g, '').toLowerCase(),
  ),
);

/** Every hex or rgb()/rgba() colour in the markup, normalised (no spaces, lowercase). */
const coloursIn = (markup: string): string[] =>
  [...(markup.match(/#[0-9a-f]{3,8}\b/gi) ?? []), ...(markup.match(/rgba?\([^)]*\)/gi) ?? [])].map(
    (colour) => colour.replace(/\s+/g, '').toLowerCase(),
  );

const LONG_TITLE =
  'An unusually long project title that keeps going well past one line of the card';
const LONG_DESCRIPTION = 'A description that rambles on. '.repeat(20).trim();

describe('the card palette', () => {
  it.each(Object.entries(OG_PALETTE))('%s is the --%s token as hex', (token, hex) => {
    expect(hex).toBe(oklchToHex(rootToken(token)));
  });

  it.each(Object.entries(OG_TINTS))('%s is the translucent token as rgba()', (token, rgba) => {
    const { r, g, b, alpha } = oklchToRgba(rootToken(token));
    expect(rgba).toBe(`rgba(${r}, ${g}, ${b}, ${alpha})`);
  });
});

describe('the site card', () => {
  const markup = renderToStaticMarkup(<SiteCard />);
  const text = textOf(markup);

  it("shows the name, the role line and the site's positioning line", () => {
    expect(text).toContain(app.name);
    expect(text).toContain(SITE_ROLE);
    expect(text).toContain(app.tagline);
  });

  it('carries the console cues: the host, the section index and a live readout', () => {
    expect(text).toContain(SITE_HOST);
    for (const path of ['/projects', '/places', '/certifications', '/guestbook', '/stats']) {
      expect(text).toContain(path);
    }
    expect(text).toMatch(/\blive\b/);
  });

  it('names no place: where Mike is follows the Studio setting, never a built-in card', () => {
    expect(text).not.toMatch(/New York|Brooklyn|\bNY\b/);
  });

  it('paints only with the palette, and none of the old purples', () => {
    const colours = coloursIn(markup);

    expect(colours.length).toBeGreaterThan(0);
    for (const colour of colours) expect(ALLOWED.has(colour), colour).toBe(true);
    expect(markup).not.toMatch(/#7209b7|#8b5cf6|#a855f7|#d6b3f0|#e9d5ff|#d8b4fe|Kodchasan/i);
  });
});

describe('a page card', () => {
  it('shows the page title and description under the site name and host', () => {
    const text = textOf(
      renderToStaticMarkup(<PageCard title="Projects" description="Things I have built." />),
    );

    expect(text).toContain('Projects');
    expect(text).toContain('Things I have built.');
    expect(text).toContain(app.name);
    expect(text).toContain(SITE_HOST);
  });

  it('paints only with the palette, a long title and description included', () => {
    const markup = renderToStaticMarkup(
      <PageCard title={LONG_TITLE} description={LONG_DESCRIPTION} />,
    );

    for (const colour of coloursIn(markup)) expect(ALLOWED.has(colour), colour).toBe(true);
  });
});

describe('fitting text to a card', () => {
  it('leaves short text alone and clips long text at a word, with an ellipsis', () => {
    expect(clipText('Places', 20)).toBe('Places');
    const clipped = clipText(LONG_DESCRIPTION, 60);

    expect(clipped.length).toBeLessThanOrEqual(60);
    expect(clipped.endsWith('…')).toBe(true);
    expect(clipped).not.toMatch(/\s…$/);
  });

  it('sets a short title large and steps a longer one down', () => {
    const short = fitTitle('Places');
    const medium = fitTitle('Founder & CEO at ResQ Systems');
    const long = fitTitle(LONG_TITLE);

    expect(short.fontSize).toBeGreaterThan(medium.fontSize);
    expect(medium.fontSize).toBeGreaterThan(long.fontSize);
    expect(long.text.length).toBeLessThanOrEqual(PAGE_TITLE_MAX);
  });

  it('gives a three-line title a two-line description, so the tile never crowds its header', () => {
    const clipped = clipText(LONG_DESCRIPTION, PAGE_DESCRIPTION_MAX);
    const underLongTitle = fitDescription(clipped, fitTitle(LONG_TITLE));
    const underShortTitle = fitDescription(clipped, fitTitle('Places'));

    expect(underShortTitle).toBe(clipped);
    expect(underLongTitle.length).toBeLessThanOrEqual(PAGE_DESCRIPTION_UNDER_LONG_TITLE_MAX);
    expect(underLongTitle.length).toBeLessThan(clipped.length);
  });
});

describe('reading a page card from the query', () => {
  const read = (query: string) => readPageCard(new URLSearchParams(query));

  it('gives no page card without a title, so the route draws the site card', () => {
    expect(read('')).toBeNull();
    expect(read('title=%20%20&description=Only%20this')).toBeNull();
  });

  it('trims the title and description and drops control characters', () => {
    expect(read('title=%20Projects%0A&description=%09Built%20things%07')).toEqual({
      title: 'Projects',
      description: 'Built things',
    });
  });

  it('clips what it is given to the card limits', () => {
    const card = read(
      `title=${encodeURIComponent('x'.repeat(500))}&description=${encodeURIComponent(LONG_DESCRIPTION)}`,
    );

    expect(card?.title.length).toBeLessThanOrEqual(PAGE_TITLE_MAX);
    expect(card?.description.length).toBeLessThanOrEqual(PAGE_DESCRIPTION_MAX);
  });

  it('falls back to the site description when a page gives none', () => {
    expect(read('title=Places')).toEqual({
      title: 'Places',
      description: clipText(app.description, PAGE_DESCRIPTION_MAX),
    });
  });
});
