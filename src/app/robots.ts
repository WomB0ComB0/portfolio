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
 * The list pages, and the query parameters that only re-filter or re-arrange them: the free-text
 * search `q`, each facet of the page's filter schema (src/lib/filters; /places/photos shares
 * /places' schema), and /projects' `view`. A filtered or re-arranged page is the same content as
 * the page itself, its canonical link is the page without its query, and every chip and view
 * combination is another URL a crawler would render on a function. The pages themselves stay
 * open. tests/unit/seo/robots.test.ts fails when a route gains a filter schema or a facet and it
 * is not listed here.
 */
const LIST_PAGE_PARAMS = {
  '/media': ['q', 'kind', 'series', 'topic'],
  '/projects': ['q', 'category', 'tech', 'view'],
  '/certifications': ['q', 'issuer', 'skill'],
  '/places': ['q', 'category'],
  '/places/photos': ['q', 'category'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/**
 * One list page's rules for one parameter: first in the query, or after any others, on the page
 * as it is linked and with a trailing slash. The site answers /media/?q=x with the same page and
 * no redirect (skipTrailingSlashRedirect, next.config.ts), so the slash form needs its own rules.
 * Every rule starts with the page's exact path and its `?`, so it matches that page alone, never
 * a detail page under it, and `&q=` never matches `&seq=`. A blanket `/*?q=` or `/*&q=` would
 * also block /_next/image?url=...&w=...&q=75, where `q` is the quality.
 */
const paramRulesFor = (page: string, param: string): string[] =>
  [page, `${page}/`].flatMap((form) => [`${form}?${param}=`, `${form}?*&${param}=`]);

/** Every list page's rules, page by page, its parameters in the order listed. */
const LIST_PAGE_RULES = Object.entries(LIST_PAGE_PARAMS).flatMap(([page, params]) =>
  params.flatMap((param) => paramRulesFor(page, param)),
);

/**
 * The rest of /api/ stays closed: admin, status and health, the service endpoints, and the content
 * API, whose data the pages now put in their server HTML. Crawlers use the longest matching rule,
 * so the allows above beat `/api/`, and the list page rules beat `Allow: /`.
 *
 * A search URL answers 200 with whatever was typed printed in it, so anyone can mint an indexable
 * page of their own words on this domain. Google's URL guide says to block "URLs that generate
 * search results" in robots.txt. The filter and view parameters are closed for crawl budget: each
 * combination renders the page again, uncached.
 */
const DISALLOW = ['/api/', ...LIST_PAGE_RULES];

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
 * - A list page's search, filter and view parameters (`?q=`, `?tech=`, `?view=`, ..., with or
 *   without a trailing slash) are not: see LIST_PAGE_PARAMS. The list pages themselves are.
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
