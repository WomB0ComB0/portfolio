import '@/styles/globals.css';
import { Providers } from '@/providers';
import { Scripts } from '@/scripts/Scripts';
import { constructMetadata, constructViewport } from '@/utils';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { NextWebVitalsMetric } from 'next/app';

export const metadata = constructMetadata();
export const viewport = constructViewport();
export const reportWebVitals = (metric: NextWebVitalsMetric) => {
  if (metric.label === 'web-vital') {
    console.log(metric);
  }
};

export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-a11y-animated-images="system"
      data-a11y-link-underlines="false"
      data-turbo-loaded
    >
      <head>
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
        <Providers>
          {children}
          {modal}
          <SpeedInsights />
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
