import type { Metadata, Viewport } from 'next';
import { app } from '@/constants';

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
