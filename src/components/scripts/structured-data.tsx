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
import { app } from '@/constants';
import { generateSchema, Stringify } from '@/utils';

/**
 * Generates and injects JSON-LD structured data for SEO.
 * It creates a `WebPage` schema that includes nested `Organization` data.
 *
 * @returns {JSX.Element} A script tag containing the JSON-LD data.
 */
export function StructuredData({ nonce }: Readonly<{ nonce: string | undefined }>) {
  const structuredData = generateSchema({
    type: 'Organization',
    name: app.name,
    url: app.url,
    thumbnailUrl: app.logo,
    logo: app.logo,
    sameAs: [
      'https://mikeodnis.dev',
      'https://news.mikeodnis.dev',
      'https://blog.mikeodnis.dev',
      'https://linkedin.com/in/mikeodnis',
      'https://instagram.com/mikeodnis.dev',
      'https://x.com/@mike_odnis',
      'https://bsky.app/profile/mikeodnis.dev',
    ],
  });

  return (
    <Script id="structured-data" type="application/ld+json" nonce={nonce}>
      {Stringify(structuredData)}
    </Script>
  );
}
