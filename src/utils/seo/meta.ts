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
}: {
  title?: string;
  description?: string;
  image?: string;
  twitter?: string;
  icons?: string;
  noIndex?: boolean;
  url?: string;
} = {}): Metadata {
  return {
    title: {
      default: title,
      template: `${title} - %s`,
    },
    description: description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: image,
        },
      ],
      siteName: title,
      url,
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [twitter],
      creator: '@mike_odnis',
    },
    icons: [
      {
        url: icons,
        href: icons,
      },
    ],
    category: 'technology',
    manifest: '/manifest.webmanifest',
    metadataBase: new URL(app.url),
    keywords: [...app.keywords],
    other: {
      currentYear: new Date().getFullYear(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
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
