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
 * @file The book and shelf link-preview cards (src/app/api/og/_lib) in the Live Console look the
 * page card has: what they say (title, stage, authors, shelf, reading status; a shelf's title,
 * counts and covers), that they draw the cover they are given and no other image, and that they
 * paint only with the site palette, the reading status's amber included (checked against its
 * token in globals.css). The rendered PNGs are checked in og-book-route.test.tsx and
 * og-shelf-route.test.tsx.
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

import { BOOK_CARD_COVER, BookCard } from '@/app/api/og/_lib/book-card';
import type { BookPreview } from '@/app/api/og/_lib/book-preview';
import { OG_ONGOING } from '@/app/api/og/_lib/card-chrome';
import { SHELF_CARD_COVER, ShelfCard } from '@/app/api/og/_lib/shelf-card';
import type { ShelfPreview } from '@/app/api/og/_lib/shelf-preview';
import { app } from '@/constants';
import { SITE_HOST } from '@/lib/og/constants';
import { OG_PALETTE, OG_TINTS } from '@/lib/og/palette';

/** The text a card shows, tags stripped and entities decoded. */
const textOf = (markup: string): string =>
  markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

const ALLOWED = new Set(
  [...Object.values(OG_PALETTE), ...Object.values(OG_TINTS), ...Object.values(OG_ONGOING)].map(
    (colour) => colour.replace(/\s+/g, '').toLowerCase(),
  ),
);

/** Every hex or rgb()/rgba() colour in the markup, normalised (no spaces, lowercase). */
const coloursIn = (markup: string): string[] =>
  [...(markup.match(/#[0-9a-f]{3,8}\b/gi) ?? []), ...(markup.match(/rgba?\([^)]*\)/gi) ?? [])].map(
    (colour) => colour.replace(/\s+/g, '').toLowerCase(),
  );

/** Every image source the markup draws. */
const imagesIn = (markup: string): string[] =>
  [...markup.matchAll(/<img[^>]*\ssrc="([^"]*)"/g)].map((match) => match[1] ?? '');

const COVER = 'data:image/jpeg;base64,/9j/4AAQ';

const preview: BookPreview = {
  title: 'Job Ready Python',
  stageLabel: '01',
  authors: 'Hayden Van Der Post',
  shelf: 'Web & Languages',
  status: 'completed',
  coverSrc: 'https://cdn.sanity.io/images/test/test/abc123-520x680.webp?w=520&h=680',
};

describe('the reading status’s amber', () => {
  it('is the --ongoing tokens as hex and rgba()', () => {
    expect(OG_ONGOING.ongoing).toBe(oklchToHex(rootToken('ongoing')));
    const { r, g, b, alpha } = oklchToRgba(rootToken('ongoing-tint'));
    expect(OG_ONGOING['ongoing-tint']).toBe(`rgba(${r}, ${g}, ${b}, ${alpha})`);
  });
});

describe('a book card', () => {
  const markup = renderToStaticMarkup(<BookCard preview={preview} cover={COVER} />);
  const text = textOf(markup);

  it('shows the title, stage, authors, shelf and reading status under the site name', () => {
    expect(text).toContain('Job Ready Python');
    expect(text).toContain('STAGE 01');
    expect(text).toContain('by Hayden Van Der Post');
    expect(text).toContain('Web & Languages');
    expect(text).toContain('Read');
    expect(text).toContain(app.name);
    expect(text).toContain(SITE_HOST);
  });

  it('draws the cover it is given at the size it fetched, and no other image', () => {
    expect(imagesIn(markup)).toEqual([COVER]);
    expect(markup).toContain(`width="${BOOK_CARD_COVER.width}"`);
    expect(markup).toContain(`height="${BOOK_CARD_COVER.height}"`);
    expect(markup).not.toContain('cdn.sanity.io');
  });

  it('sets a title too long for the card as its main title', () => {
    const long = {
      ...preview,
      title:
        'Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow: Concepts, Tools, and Techniques to Build Intelligent Systems',
    };
    const longText = textOf(renderToStaticMarkup(<BookCard preview={long} cover={COVER} />));

    expect(longText).toContain(
      'Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow',
    );
    expect(longText).not.toContain('Intelligent Systems');
  });

  it.each([
    ['completed', 'Read'],
    ['reading', 'Reading'],
    ['queued', 'Unread'],
  ] as const)('labels a %s book "%s" and paints only with the palette', (status, label) => {
    const statusMarkup = renderToStaticMarkup(
      <BookCard preview={{ ...preview, status }} cover={COVER} />,
    );

    expect(textOf(statusMarkup)).toContain(label);
    const colours = coloursIn(statusMarkup);
    expect(colours.length).toBeGreaterThan(0);
    for (const colour of colours) expect(ALLOWED.has(colour), colour).toBe(true);
  });
});

describe('a shelf card', () => {
  const shelf: ShelfPreview = {
    title: 'Web & Languages',
    description: 'Python, JavaScript and the web.',
    bookCount: 6,
    readCount: 1,
    covers: [1, 2, 3, 4].map((n) => ({
      title: `Book ${n}`,
      coverSrc: `https://cdn.sanity.io/${n}`,
    })),
  };
  const covers = [
    'data:image/jpeg;base64,AA',
    'data:image/jpeg;base64,BB',
    'data:image/png;base64,CC',
  ];
  const markup = renderToStaticMarkup(<ShelfCard preview={shelf} covers={covers} />);
  const text = textOf(markup);

  it('shows the shelf’s title, description and counts under the site name', () => {
    expect(text).toContain('Web & Languages');
    expect(text).toContain('Python, JavaScript and the web.');
    expect(text).toContain('6 books');
    expect(text).toContain('1 read');
    expect(text).toContain(app.name);
  });

  it('draws the covers it is given, in order, at the size it fetched them', () => {
    expect(imagesIn(markup)).toEqual(covers);
    expect(markup).toContain(`width="${SHELF_CARD_COVER.width}"`);
    expect(markup).not.toContain('cdn.sanity.io');
  });

  it('paints only with the palette', () => {
    for (const colour of coloursIn(markup)) expect(ALLOWED.has(colour), colour).toBe(true);
  });
});
