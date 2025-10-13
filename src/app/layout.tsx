import '@/styles/globals.css';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Provider } from '@/providers';
import { Scripts } from '@/scripts';
import { constructMetadata, constructViewport } from '@/utils';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import env from '@/env';

export const metadata = constructMetadata();
export const viewport = constructViewport();

const kodchasanFont = localFont({
  src: [{}],
  variable: '--font-kodchasan',
  display: 'swap',
  preload: true
})
// export const reportWebVitals = (metric: NextWebVitalsMetric) => {
//   if (metric.label === 'web-vital') {
//     console.log(metric);
//   }
// };

export default async function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get('x-url') || '';
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-a11y-animated-images="system"
      data-a11y-link-underlines="false"
      data-turbo-loaded
      className={`${kodchasanFont.variable}`}
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#234c8b" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
        <meta name="referrer" content="no-referrer" />

        <link rel="canonical" href={`${process.env.NEXT_PUBLIC_APP_URL}${pathname}`} />
        <meta name="language" content="English" />
        <meta name="geo.region" content="US" />
        <meta name="geo.placename" content="New York, NY" />

        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.google-analytics.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.google.com" crossOrigin="anonymous" />

        <Scripts />
      </head>
      <body>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-NL4XDQ2B"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          ></iframe>
        </noscript>
        <Provider>
          {children}
          {modal}
          <SpeedInsights />
          <Analytics />
        </Provider>
      </body>
    </html>
  );
}

RootLayout.displayName = 'RootLayout';