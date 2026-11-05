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
 * Pages render their content on the server, so a crawler needs no API to read them. Under /api/
 * only the OG image route stays open, for link previews.
 *
 * Interim: the guestbook still loads its messages in the browser from /api/v1/messages, so that
 * endpoint stays open too. Remove it once the guestbook renders its messages on the server.
 */
const ALLOW = ['/', '/api/og', '/api/v1/messages'];

/**
 * The rest of /api/ stays closed: admin, status and health, the service endpoints, and the content
 * API, whose data the pages now put in their server HTML. Crawlers use the longest matching rule,
 * so the allows above beat `/api/`.
 */
const DISALLOW = ['/api/'];

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
 * - Pages, the OG image route and the guestbook's messages are allowed; the rest of /api/ is not.
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
