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

import { GlobalProvider } from '@/app/_providers';
import { fontVariables } from '@/app/fonts';
import { AnalyticsScripts, StructuredData } from '@/components/scripts';
import '@/styles/globals.css';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { siteMetadata } from '@/lib/seo/site-metadata';
import { constructViewport } from '@/utils';

/**
 * Every page's defaults, with geo.placename only while Location in Studio names a place (as this
 * server last loaded it, never waiting for Sanity: src/lib/seo/site-metadata.ts). So the tag is
 * missing on a fresh server's first request and for one request after each 5-minute cache
 * expiry, and a change in Studio takes up to those 5 minutes to show, as the hero's does.
 */
export function generateMetadata(): Metadata {
  return siteMetadata();
}
export const viewport = constructViewport();
export const dynamic = 'force-dynamic';

export const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') || undefined;
  const pathname = headersList.get('x-url') || '';
  return (
    <html
      lang="en"
      className={fontVariables}
      suppressHydrationWarning
      data-a11y-animated-images="system"
      data-a11y-link-underlines="false"
      data-turbo-loaded
      data-scroll-behavior="smooth"
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* theme-color comes from the viewport export (constructViewport), once. */}
        {/* Referrer-Policy and X-XSS-Protection come from the headers in src/config/security-headers.ts;
            a meta referrer tag here would override the header. */}

        <link rel="canonical" href={`${process.env.NEXT_PUBLIC_APP_URL}${pathname}`} />
        <meta name="language" content="English" />
        {/* The country only. geo.placename comes from generateMetadata, from Location in Studio. */}
        <meta name="geo.region" content="US" />

        <AnalyticsScripts nonce={nonce} />
        <StructuredData nonce={nonce} />
      </head>
      <body suppressHydrationWarning>
        <GlobalProvider>
          {children}
          <SpeedInsights />
          <Analytics />
        </GlobalProvider>
      </body>
    </html>
  );
};
RootLayout.displayName = 'RootLayout';
export default RootLayout;
