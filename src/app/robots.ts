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

import type { MetadataRoute } from 'next';

/**
 * Generates robots.txt configuration for the website
 *
 * @returns {MetadataRoute.Robots} Robot rules configuration object containing crawler rules and sitemap location
 *
 * @example
 * // Returns robot rules allowing Googlebot, Applebot and Bingbot access to /api/og/*
 * // while blocking /api/ and /legal paths
 * robots();
 *
 * @remarks
 * - Allows access to /api/og/* for preview image generation
 * - Blocks access to general API routes and legal pages
 * - Configures rules separately for Googlebot vs Applebot/Bingbot
 * - Points to sitemap.xml for complete site structure
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: 'Googlebot',
        allow: ['/'],
        disallow: ['/api/', '/legal'],
      },
      {
        userAgent: ['Applebot', 'Bingbot'],
        allow: ['/'],
        disallow: ['/api/', '/legal'],
      },
    ],
    sitemap: 'https://mikeodnis.dev/sitemap.xml',
  };
}
