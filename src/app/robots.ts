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

const SITEMAP_URL = 'https://mikeodnis.dev/sitemap.xml';

/**
 * Interim: pages still load their content in the browser from /api/v1/*, so a crawler kept out of
 * /api/ renders them empty. Until pages render their data on the server, crawlers may read the
 * content API and the OG image route. Narrow this back to `/api/og` once they do.
 */
const ALLOW = ['/', '/api/v1/', '/api/og'];

/**
 * The rest of /api/ (admin, status, health) stays closed, as do the /api/v1 service endpoints,
 * which carry no page content. Crawlers use the longest matching rule, so these beat `/api/v1/`.
 */
const DISALLOW = ['/api/', '/api/v1/health', '/api/v1/info', '/api/v1/status', '/api/v1/version'];

/** The rules every user-agent group shares; each group gets its own copy. */
const crawlRules = (): { allow: string[]; disallow: string[] } => ({
  allow: [...ALLOW],
  disallow: [...DISALLOW],
});

/**
 * Generates robots.txt.
 *
 * @returns {MetadataRoute.Robots} Crawler rules and the sitemap location.
 *
 * @remarks
 * - Googlebot, Applebot and Bingbot keep their own groups, and every other crawler gets the `*`
 *   group. All of them share one set of rules.
 * - Pages and the read-only content API are allowed; admin and service endpoints are not.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: 'Googlebot', ...crawlRules() },
      { userAgent: ['Applebot', 'Bingbot'], ...crawlRules() },
      { userAgent: '*', ...crawlRules() },
    ],
    sitemap: SITEMAP_URL,
  };
}
