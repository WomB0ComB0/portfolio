// @vitest-environment node
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
 * @file constructMetadata's whole output for the pages that pass neither a book nor an image
 * object, pinned as it was before book pages got their own og:type and cover card. Each case is
 * compared as JSON text, so a key added, dropped or moved fails it: every ordinary page must
 * render the same tags in the same order. The expected objects are written from the app
 * constants rather than copied text, so editing the site's description or keywords does not
 * break them.
 */

import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

import { app } from '@/constants';
import { siteCardAlt } from '@/lib/og/constants';
import { constructMetadata } from '@/utils/seo/meta';

const CARD = { width: 1200, height: 630, type: 'image/png' } as const;

/** The keys after twitter, the same on every page. */
const tail = (extraKeywords: readonly string[] = []) => ({
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/pwa/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/pwa/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  category: 'technology',
  manifest: '/manifest.webmanifest',
  metadataBase: 'https://mikeodnis.dev/',
  keywords: [...app.keywords, ...extraKeywords],
});

/** The page card /api/og draws for a title and description. */
const pageCard = (title: string, description: string) => ({
  url: `/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`,
  ...CARD,
  alt: title,
});

/** The JSON text Next is handed, keys in order. */
const asText = (value: unknown): string => JSON.stringify(value);

describe('constructMetadata for ordinary pages (no book, no image object)', () => {
  it('keeps the site defaults byte for byte', () => {
    const siteCard = { ...CARD, alt: siteCardAlt() };
    const expected = {
      title: { absolute: app.name, template: `${app.name} - %s` },
      description: app.description,
      openGraph: {
        title: app.name,
        description: app.description,
        siteName: app.name,
        type: 'website',
        locale: 'en_US',
        images: [{ url: '/opengraph-image', ...siteCard }],
      },
      twitter: {
        card: 'summary_large_image',
        title: app.name,
        description: app.description,
        images: [{ url: '/twitter-image', ...siteCard }],
        creator: '@mike_odnis',
      },
      ...tail(),
    };

    expect(asText(constructMetadata())).toBe(asText(expected));
  });

  it('keeps a page with a title, description and path byte for byte', () => {
    const card = pageCard('Stats', 'Live stats');
    const expected = {
      title: { default: 'Stats', template: 'Stats - %s' },
      description: 'Live stats',
      openGraph: {
        title: 'Stats',
        description: 'Live stats',
        url: 'https://mikeodnis.dev/stats',
        siteName: app.name,
        type: 'website',
        locale: 'en_US',
        images: [card],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Stats',
        description: 'Live stats',
        images: [card],
        creator: '@mike_odnis',
      },
      ...tail(),
    };

    const metadata = constructMetadata({
      title: 'Stats',
      description: 'Live stats',
      path: '/stats',
    });

    expect(asText(metadata)).toBe(asText(expected));
  });

  it('keeps a page with its own image URL (a place photo) byte for byte, size unguessed', () => {
    const photo = 'https://cdn.sanity.io/images/p/d/summit-3000x2000.jpg?w=1200&h=630';
    const description = 'Where the keynote happened.';
    const expected = {
      title: { default: 'Summit Hall', template: 'Summit Hall - %s' },
      description,
      openGraph: {
        title: 'Summit Hall',
        description,
        url: 'https://mikeodnis.dev/places/place-1',
        siteName: app.name,
        type: 'website',
        locale: 'en_US',
        images: [{ url: photo }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Summit Hall',
        description,
        images: [{ url: photo }],
        creator: '@mike_odnis',
      },
      ...tail(),
    };

    const metadata = constructMetadata({
      title: 'Summit Hall',
      description,
      image: photo,
      path: '/places/place-1',
    });

    expect(asText(metadata)).toBe(asText(expected));
  });

  it('keeps a page with a video, a player and a location byte for byte', () => {
    const card = pageCard('Intro', app.description);
    const player = {
      playerUrl: 'https://mikeodnis.dev/embed/intro',
      streamUrl: 'https://mikeodnis.dev/intro.mp4',
      width: 1280,
      height: 720,
    };
    const expected = {
      title: { default: 'Intro', template: 'Intro - %s' },
      description: app.description,
      openGraph: {
        title: 'Intro',
        description: app.description,
        siteName: app.name,
        type: 'website',
        locale: 'en_US',
        images: [card],
        videos: [{ url: 'https://mikeodnis.dev/intro.mp4', type: 'video/mp4' }],
      },
      twitter: {
        card: 'player',
        players: [player],
        title: 'Intro',
        description: app.description,
        images: [card],
        creator: '@mike_odnis',
      },
      ...tail(['Brooklyn, NY']),
      other: { 'geo.placename': 'Brooklyn, NY' },
    };

    const metadata = constructMetadata({
      title: 'Intro',
      video: { url: 'https://mikeodnis.dev/intro.mp4', type: 'video/mp4' },
      player,
      location: 'Brooklyn, NY',
    });

    expect(asText(metadata)).toBe(asText(expected));
  });
});
