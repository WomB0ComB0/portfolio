import '@/styles/globals.css';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';
import { Providers } from '@/providers';
import { constructMetadata, constructViewport } from '@/utils';
import type { NextWebVitalsMetric } from 'next/app';
import Head from 'next/head';
import { Scripts } from '@/scripts/Scripts';

export const metadata = constructMetadata();
export const viewport = constructViewport();
export const reportWebVitals = (metric: NextWebVitalsMetric) => {
  if (metric.label === 'web-vital') {
    console.log(metric);
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-a11y-animated-images="system"
      data-a11y-link-underlines="false"
      data-turbo-loaded
    >
      <Head>
        <Scripts />
      </Head>
      <body>
        <Providers>
          {children}
          <SpeedInsights />
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
