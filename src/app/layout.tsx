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

import '@/styles/globals.css';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import { GlobalProvider } from '@/app/_providers';
import { Scripts } from '@/scripts';
import { constructMetadata, constructViewport } from '@/utils';

export const metadata = constructMetadata();
export const viewport = constructViewport();

const kodchasanFont = localFont({
  src: [
    {
      path: '../../public/assets/fonts/Kodchasan-Light.ttf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../../public/assets/fonts/Kodchasan-LightItalic.ttf',
      weight: '300',
      style: 'italic',
    },
    {
      path: '../../public/assets/fonts/Kodchasan-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/assets/fonts/Kodchasan-Italic.ttf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../../public/assets/fonts/Kodchasan-Medium.ttf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../public/assets/fonts/Kodchasan-MediumItalic.ttf',
      weight: '500',
      style: 'italic',
    },
    {
      path: '../../public/assets/fonts/Kodchasan-SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../public/assets/fonts/Kodchasan-SemiBoldItalic.ttf',
      weight: '600',
      style: 'italic',
    },
    {
      path: '../../public/assets/fonts/Kodchasan-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../../public/assets/fonts/Kodchasan-BoldItalic.ttf',
      weight: '700',
      style: 'italic',
    },
  ],
  variable: '--font-kodchasan',
  display: 'swap',
  preload: true,
});

export const RootLayout = async ({ children }: { children: React.ReactNode }) => {
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
        <meta name="theme-color" content="#4B0082" />
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
      <body suppressHydrationWarning>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-NL4XDQ2B"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          ></iframe>
        </noscript>
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
