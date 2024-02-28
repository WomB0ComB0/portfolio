import type { Metadata, Viewport } from 'next';

export async function constructMetadata({
  image = '/assets/images/PurpleBackground.png',
  icons = '/assets/svgs/PurpleBackground.svg',
  description = "Mike Odnis' portfolio. Undergraduate, Computer Science student at Farmingdale State College.",
  title = 'Mike Odnis',
  noIndex = false,
}: MetadataProps = {}): Promise<Metadata> {
  return {
    title: {
      default: title,
      template: `${title} - %s`,
    },
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: image,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
      creator: '@OdnisMike',
    },
    icons: [
      {
        url: icons,
        href: icons,
      },
    ],
    manifest: '/pwa/manifest.json',
    metadataBase: new URL('https://mikeodnis.com/'),
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

export async function constructViewport(): Promise<Viewport> {
  return {
    width: 'device-width',
    height: 'device-height',
    initialScale: 1,
    minimumScale: 1,
    maximumScale: 1,
    themeColor: '#BA9BDD',
  };
}
