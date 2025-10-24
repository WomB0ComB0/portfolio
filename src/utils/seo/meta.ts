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

/**
 * Constructs the metadata object for web pages, including OpenGraph, Twitter, and icon data.
 *
 * @function
 * @public
 * @author Mike Odnis
 * @see {@link https://nextjs.org/docs/app/building-your-application/optimizing/metadata Next.js Metadata Documentation}
 * @web
 * @version 1.0.0
 *
 * @param {Object} [params] - Configuration options for the metadata.
 * @param {string} [params.title] - The page title. Defaults to app.name.
 * @param {string} [params.description] - The page description. Defaults to app.description.
 * @param {string} [params.image] - URL for the OpenGraph preview image. Defaults to '/opengraph-image.png'.
 * @param {string} [params.twitter] - URL for the Twitter card image. Defaults to '/twitter-image.png'.
 * @param {string} [params.icons] - URL for the site favicon/icon. Defaults to '/assets/svgs/logo.svg'.
 * @param {boolean} [params.noIndex] - If true, prevents indexing of the page by search engines.
 * @param {string} [params.url] - Canonical URL of the page. Defaults to app.url.
 *
 * @returns {Metadata} Metadata configuration suitable for Next.js app router.
 *
 * @example
 * // Basic usage for metadata construction
 * const meta = constructMetadata({ title: 'About', description: 'About page' });
 *
 * @throws {TypeError} If a provided URL is malformed and cannot be parsed.
 * @readonly
 * @project portfolio
 * @author WomB0ComB0
 */
export function constructMetadata({
  title = `${app.name}`,
  description = `${app.description}`,
  image = '/opengraph-image.png',
  twitter = '/twitter-image.png',
  icons = '/assets/svgs/logo.svg',
  noIndex = false,
  url = app.url,

  ogVideo = 'https://cdn.example.com/og/intro.mp4',
  ogVideoType = 'video/mp4',
  ogVideoWidth = 1_280,
  ogVideoHeight = 720,

  twitterPlayer = 'https://example.com/embed/player?src=intro', // must be an embeddable <iframe>
  twitterPlayerWidth = 1_280,
  twitterPlayerHeight = 720,
  twitterPlayerStream = 'https://cdn.example.com/og/intro.mp4', // optional raw stream
}: {
  title?: string;
  description?: string;
  image?: string;
  twitter?: string;
  icons?: string;
  noIndex?: boolean;
  url?: string;

  ogVideo?: string;
  ogVideoType?: string;
  ogVideoWidth?: number;
  ogVideoHeight?: number;
  twitterPlayer?: string;
  twitterPlayerWidth?: number;
  twitterPlayerHeight?: number;
  twitterPlayerStream?: string;
} = {}): Metadata {
  return {
    title: {
      default: title,
      template: `${title} - %s`,
    },
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: title,
      type: 'website',
      locale: 'en_US',
      images: [{ url: image }],
      videos: [
        {
          url: ogVideo,
          secureUrl: ogVideo,
          type: ogVideoType,
          width: ogVideoWidth,
          height: ogVideoHeight,
        },
      ],
    },
    twitter: {
      card: 'player',
      title,
      description,
      images: [twitter],
      images: [twitter],
      creator: '@mike_odnis',
    },
    other: {
      ...(twitterPlayer && {
        'twitter:player': twitterPlayer,
        'twitter:player:width': String(twitterPlayerWidth),
        'twitter:player:height': String(twitterPlayerHeight),
      }),
      ...(twitterPlayerStream && { 'twitter:player:stream': twitterPlayerStream }),
      currentYear: new Date().getFullYear(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    icons: [{ url: icons, href: icons }],
    category: 'technology',
    manifest: '/manifest.webmanifest',
    metadataBase: new URL(app.url),
    keywords: [...app.keywords],
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
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: '#BA9BDD' },
      { media: '(prefers-color-scheme: dark)', color: '#4B0082' },
    ],
    colorScheme: 'dark light',
  };
}
