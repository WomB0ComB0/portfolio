'use client';

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

import Script from 'next/script';
import { env } from '@/env';

/**
 * Injects Google Analytics 4 (GA4) script for analytics.
 * Uses the official `@next/third-parties/google` component.
 *
 * @returns {JSX.Element | null} The GA4 script tag or null if Measurement ID is not configured.
 */
export function AnalyticsScripts({ nonce }: { nonce: string | undefined }) {
  if (!env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      <Script
        id="ga-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID}`}
        strategy="afterInteractive"
        nonce={nonce}
      />
      <Script id="ga-init" strategy="afterInteractive" nonce={nonce}>
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments)}
          gtag('js', new Date());
          gtag('config', '${env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID}', { anonymize_ip: true });
        `}
      </Script>
    </>
  );
}
