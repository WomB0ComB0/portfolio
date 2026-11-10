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

import type { Metadata, Viewport } from 'next';
import { app } from '@/constants';
import {
  OG_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  PAGE_CARD_PATH,
  SITE_CARD_PATH,
  SITE_TWITTER_CARD_PATH,
  siteCardAlt,
} from '@/lib/og/constants';

/**
 * The favicon (16, 32 and 48 px in one file), the scalable icon and the apple-touch icon: the
 * wolf mark in the palette (src/lib/og/wolf-mark.tsx), in public/. A new object per page, so no
 * page's metadata shares one with another. The web app manifest (src/app/manifest.ts) lists the
 * install icons.
 */
const siteIcons = (): NonNullable<Metadata['icons']> => ({
  icon: [
    { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
    { url: '/pwa/icon.svg', type: 'image/svg+xml' },
  ],
  apple: [{ url: '/pwa/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
});

/**
 * The browser chrome and PWA colour: the page background (`--background`, equal to the Live
 * Console `--canvas`, oklch(16% 0.016 285deg) in src/styles/globals.css) as hex, so the address
 * bar and splash screen blend with the tinted-black page.
 * tests/unit/seo/theme-color.test.ts recomputes it from the token.
 */
export const THEME_COLOR = '#0c0c14';

/** An og:video. Nothing is emitted unless a caller passes one. */
export interface MetadataVideo {
  readonly url: string;
  readonly type?: string;
  readonly width?: number;
  readonly height?: number;
}

/** A Twitter player card. `playerUrl` must be an embeddable HTTPS iframe page. */
export interface MetadataPlayer {
  readonly playerUrl: string;
  readonly streamUrl: string;
  readonly width: number;
  readonly height: number;
}

/** Options for {@link constructMetadata}. Every field is optional. */
export interface MetadataOptions {
  /** The page title. Defaults to app.name. */
  readonly title?: string;
  /** The page description. Defaults to app.description. */
  readonly description?: string;
  /**
   * The preview image URL. Defaults to the site card for the site's own title (the site name),
   * or the page card /api/og draws for any other title and its description.
   */
  readonly image?: string;
  /** The Twitter card image URL. Defaults to the preview image (the site card's X twin). */
  readonly twitter?: string;
  /** When true, asks search engines not to index or follow the page. */
  readonly noIndex?: boolean;
  /** The page's path on the site, e.g. '/stats'. Sets og:url; without it og:url is left out. */
  readonly path?: string;
  /** An og:video for the page. */
  readonly video?: MetadataVideo;
  /** A Twitter player for the page. Switches the card type to 'player'. */
  readonly player?: MetadataPlayer;
  /**
   * Where the site says Mike is, from Location in Studio: geo.placename and one more keyword.
   * Nothing names a place without it (blank counts as none); the site builds no place in.
   */
  readonly location?: string | null;
}

interface PreviewImage {
  readonly url: string;
  readonly width?: number;
  readonly height?: number;
  readonly type?: string;
  readonly alt?: string;
}

/** A page's preview images: the og:image, and the twitter:image beside it. */
interface PreviewImages {
  readonly openGraph: PreviewImage;
  readonly twitter: PreviewImage;
}

/** What every generated card declares: its 1200x630 size and PNG type. */
const CARD = { ...OG_IMAGE_SIZE, type: OG_CONTENT_TYPE } as const;

/**
 * The preview images for a page: the caller's image as given (no size guessed), the site card
 * (/opengraph-image, and /twitter-image for X) when the title is the site's own, or the page card
 * /api/og draws from the title and description, with their known size.
 */
function previewImages(title: string, description: string, image?: string): PreviewImages {
  if (image) return { openGraph: { url: image }, twitter: { url: image } };
  if (title === app.name) {
    const alt = siteCardAlt();
    return {
      openGraph: { url: SITE_CARD_PATH, ...CARD, alt },
      twitter: { url: SITE_TWITTER_CARD_PATH, ...CARD, alt },
    };
  }
  const query = `title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;
  const page = { url: `${PAGE_CARD_PATH}?${query}`, ...CARD, alt: title };
  return { openGraph: page, twitter: page };
}

const twitterCard = (player?: MetadataPlayer) =>
  player
    ? { card: 'player' as const, players: [{ ...player }] }
    : { card: 'summary_large_image' as const };

/**
 * The tags that name `location`: geo.placename and a keyword. None for no location or a blank
 * one, so `other` is left out and a page's metadata never overrides the layout's with nothing.
 */
function placeTags(location: string | null | undefined): Pick<Metadata, 'other'> & {
  readonly keywords: readonly string[];
} {
  const place = location?.trim() ?? '';
  if (!place) return { keywords: [] };
  return { other: { 'geo.placename': place }, keywords: [place] };
}

/**
 * Constructs the metadata object for web pages, including OpenGraph, Twitter, and icon data.
 *
 * Video and player tags appear only when a caller passes them, og:site_name is the site's name,
 * and og:url is the absolute URL of `path` (left out when no path is given, so pages without
 * one do not all claim the homepage). The canonical link comes from src/app/layout.tsx. A place
 * is named (geo.placename, and a keyword) only from `location`: the server pages pass the one
 * Location in Studio gives (src/lib/seo/site-metadata.ts), and nothing here names one itself.
 *
 * The preview image is the caller's, or a card in the Live Console look (src/lib/og): the site
 * card for the site's own title (the home page and the layout's defaults), a page card for any
 * other. Every page sets its own, so Next never adds the opengraph-image file's tag itself.
 *
 * @function
 * @public
 * @author Mike Odnis
 * @see {@link https://nextjs.org/docs/app/building-your-application/optimizing/metadata Next.js Metadata Documentation}
 * @web
 * @version 2.0.0
 *
 * @param {MetadataOptions} [options] - Configuration options for the metadata.
 * @returns {Metadata} Metadata configuration suitable for Next.js app router.
 *
 * @example
 * // Basic usage for metadata construction
 * const meta = constructMetadata({ title: 'About', description: 'About page', path: '/about' });
 *
 * @throws {TypeError} If app.url is malformed and cannot be parsed.
 * @readonly
 * @project portfolio
 * @author WomB0ComB0
 */
export function constructMetadata({
  title = `${app.name}`,
  description = `${app.description}`,
  image,
  twitter,
  noIndex = false,
  path,
  video,
  player,
  location,
}: MetadataOptions = {}): Metadata {
  const preview = previewImages(title, description, image);
  const place = placeTags(location);

  return {
    title: {
      default: title,
      template: `${title} - %s`,
    },
    description,
    openGraph: {
      title,
      description,
      ...(path !== undefined && { url: new URL(path, app.url).href }),
      siteName: app.name,
      type: 'website',
      locale: 'en_US',
      images: [{ ...preview.openGraph }],
      ...(video && { videos: [{ ...video }] }),
    },
    twitter: {
      ...twitterCard(player),
      title,
      description,
      images: [twitter ? { url: twitter } : { ...preview.twitter }],
      creator: '@mike_odnis',
    },
    icons: siteIcons(),
    category: 'technology',
    manifest: '/manifest.webmanifest',
    metadataBase: new URL(app.url),
    keywords: [...app.keywords, ...place.keywords],
    ...(place.other && { other: place.other }),
    ...(noIndex && { robots: { index: false, follow: false } }),
  };
}

/**
 * Constructs a viewport object containing responsive and accessibility-related viewport settings for web browsers.
 *
 * @function
 * @public
 * @author Mike Odnis
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag MDN: Viewport Meta Tag}
 * @web
 * @version 1.0.0
 *
 * @returns {Viewport} Viewport configuration for HTML meta tags.
 *
 * @example
 * // Usage in Next.js app/layout.tsx
 * export const viewport = constructViewport();
 *
 * @readonly
 * @project portfolio
 * @author WomB0ComB0
 */
export function constructViewport(): Viewport {
  return {
    width: 'device-width',
    height: 'device-height',
    initialScale: 1,
    minimumScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: 'cover',
    interactiveWidget: 'resizes-visual',
    // The one theme-color tag on the page; the site is dark-only, whatever the OS preference.
    themeColor: THEME_COLOR,
    colorScheme: 'dark',
  };
}
