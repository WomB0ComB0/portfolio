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
 * only the OG image route stays open, for link previews. The guestbook renders its messages on
 * the server too, so /api/v1/messages is closed with the rest.
 */
const ALLOW = ['/', '/api/og'];

/**
 * The list pages whose filter bar takes free text in `?q=` and prints it back in the page (a
 * filter schema from src/lib/filters; /places/photos shares /places' schema). Their other
 * filters (?kind=, ?tech=, ?year=) choose among the site's own values and stay crawlable;
 * each page's canonical link is the page without its query either way.
 * tests/unit/seo/robots.test.ts fails when a route gains a filter schema and is not listed here.
 */
const SEARCHABLE_LIST_PAGES = [
  '/media',
  '/projects',
  '/certifications',
  '/places',
  '/places/photos',
] as const;

/**
 * A list page's search results: `q` as the first parameter, or after any others, on the page as
 * it is linked and with a trailing slash. The site answers /media/?q=x with the same page and no
 * redirect (skipTrailingSlashRedirect, next.config.ts), so the slash form needs its own rules.
 * Every rule starts with the page's exact path and its `?`, so it matches that page alone, never
 * a detail page under it. A blanket `/*?q=` or `/*&q=` would also block
 * /_next/image?url=...&w=...&q=75, where `q` is the quality.
 */
const searchRulesFor = (page: string): string[] =>
  [page, `${page}/`].flatMap((form) => [`${form}?q=`, `${form}?*&q=`]);

/**
 * The rest of /api/ stays closed: admin, status and health, the service endpoints, and the content
 * API, whose data the pages now put in their server HTML. Crawlers use the longest matching rule,
 * so the allows above beat `/api/`, and the search rules beat `Allow: /`.
 *
 * A search URL answers 200 with whatever was typed printed in it, so anyone can mint an indexable
 * page of their own words on this domain. Google's URL guide says to block "URLs that generate
 * search results" in robots.txt.
 */
const DISALLOW = ['/api/', ...SEARCHABLE_LIST_PAGES.flatMap(searchRulesFor)];

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
 * - Pages and the OG image route are allowed; the rest of /api/ is not.
 * - A list page's search results (`?q=`, with or without a trailing slash) are not: see DISALLOW.
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
