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

/** The size of the card src/app/api/og/route.tsx renders. */
const OG_IMAGE_SIZE = { width: 1_200, height: 630 } as const;

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
  /** The preview image URL. Defaults to the card /api/og renders for the title and description. */
  readonly image?: string;
  /** The Twitter card image URL. Defaults to the preview image. */
  readonly twitter?: string;
  /** The favicon URL. */
  readonly icons?: string;
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
  readonly alt?: string;
}

/** The caller's image as given, or the generated /api/og card with its known size. */
const previewImage = (title: string, description: string, image?: string): PreviewImage =>
  image
    ? { url: image }
    : {
        url: `/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`,
        ...OG_IMAGE_SIZE,
        alt: title,
      };

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
  icons = '/assets/svgs/logo.svg',
  noIndex = false,
  path,
  video,
  player,
  location,
}: MetadataOptions = {}): Metadata {
  const ogImage = previewImage(title, description, image);
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
      images: [{ ...ogImage }],
      ...(video && { videos: [{ ...video }] }),
    },
    twitter: {
      ...twitterCard(player),
      title,
      description,
      images: [twitter ? { url: twitter } : { ...ogImage }],
      creator: '@mike_odnis',
    },
    icons: [{ url: icons, href: icons }],
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
