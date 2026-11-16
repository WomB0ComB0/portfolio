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

/**
 * @file robots.txt rules, evaluated the way Google, Bing and Applebot read them (RFC 9309): a
 * crawler uses the group naming its user agent, else the `*` group; the longest matching rule
 * wins, `Allow` wins a tie, and a path no rule matches is allowed. In a rule `*` stands for any
 * run of characters and a final `$` for the end of the URL; a rule matches from the start of the
 * path, query string included.
 *
 * Pages render their content on the server, so crawlers get the pages and the OG image route,
 * and /api/ is closed, the content API included. /api/v1/messages is closed too: the guestbook
 * renders its messages on the server now, so no page reads it in the browser.
 *
 * A list page's search results (`?q=`) are closed as well: the page prints the query back, so
 * every such URL is an indexable page of somebody else's words. The rules name each list page,
 * so no other URL with a `q` parameter is caught, /_next/image?...&q=75 least of all. Each page
 * is named with and without a trailing slash: the site answers /media/?q=x with the same page
 * and no redirect (skipTrailingSlashRedirect in next.config.ts).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { MetadataRoute } from 'next';
import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';

/** One user-agent group; `userAgent` is optional here, as in the single-group form. */
type RobotsRule = Exclude<MetadataRoute.Robots['rules'], readonly unknown[]>;

const toList = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : [value].flat();

function rulesOf(config: MetadataRoute.Robots): RobotsRule[] {
  return [config.rules].flat();
}

function groupFor(config: MetadataRoute.Robots, userAgent: string): RobotsRule | undefined {
  const agentsOf = (rule: RobotsRule) => toList(rule.userAgent ?? '*').map((a) => a.toLowerCase());
  const rules = rulesOf(config);
  return (
    rules.find((rule) => agentsOf(rule).includes(userAgent.toLowerCase())) ??
    rules.find((rule) => agentsOf(rule).includes('*'))
  );
}

/** A rule as a regular expression: literal text, `*` for any run, a final `$` for the end. */
function ruleMatcher(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

/** Length of the longest rule that matches `path` from its start, or -1 when none does. */
const longestMatch = (patterns: string[], path: string): number =>
  Math.max(
    -1,
    ...patterns.filter((pattern) => ruleMatcher(pattern).test(path)).map((p) => p.length),
  );

function isAllowed(rule: RobotsRule, path: string): boolean {
  return longestMatch(toList(rule.allow), path) >= longestMatch(toList(rule.disallow), path);
}

const CRAWLERS = ['Googlebot', 'Bingbot', 'Applebot', 'DuckDuckBot'] as const;

/** The guestbook's messages: rendered on /guestbook's server HTML now, so closed like the rest. */
const GUESTBOOK_MESSAGES = '/api/v1/messages';

/** Pages (detail pages included, /guestbook too) and the OG image route link previews use. */
const CRAWLABLE_PATHS = [
  '/',
  '/projects',
  '/projects/project-1',
  '/experience/experience-1',
  '/places/place-1',
  '/guestbook',
  '/sitemap.xml',
  '/api/og',
  '/api/og?title=Projects',
];

/** The list pages whose filter bar takes free text in `?q=` and prints it back. */
const SEARCHABLE_PAGES = [
  '/media',
  '/projects',
  '/certifications',
  '/places',
  '/places/photos',
] as const;

/** A list page as it is linked, and with the trailing slash the site also answers. */
const formsOf = (page: string): string[] => [page, `${page}/`];

/** The rules that close one list page's search: `q` first or after other parameters, each form. */
const searchRulesOf = (page: string): string[] =>
  formsOf(page).flatMap((form) => [`${form}?q=`, `${form}?*&q=`]);

/**
 * A search on each list page, with and without the trailing slash: `q` alone, after another
 * filter, before one, and empty.
 */
const SEARCH_URLS = SEARCHABLE_PAGES.flatMap(formsOf).flatMap((page) => [
  `${page}?q=anything`,
  `${page}?q=`,
  `${page}?q=buy+cheap+pills&kind=video`,
  `${page}?kind=video&q=anything`,
  `${page}?a=1&b=2&q=x`,
]);

/** URLs with a `q` in them that are no list page's search, and the filters that are not search. */
const NOT_SEARCH_URLS = [
  // Next's image optimiser: `q` is the quality.
  '/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fcover.png&w=1080&q=75',
  '/_next/image?q=75&url=%2Fassets%2Fa.png&w=640',
  '/_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Fa%2Fb%2Fc.jpg%3Fq%3D80&w=3840&q=75',
  '/_next/static/chunks/main.js?q=1',
  '/_next/static/css/app.css?v=1&q=2',
  '/assets/logo.svg?q=1',
  '/opengraph-image?q=1',
  '/api/og?title=Projects&q=1',
  // The list pages themselves, in both forms, and their other filters.
  ...SEARCHABLE_PAGES.flatMap(formsOf),
  '/media?kind=video',
  '/media/?kind=video',
  '/media/?kind=video&seq=1',
  '/media/?kind=video&qq=1',
  '/media/?faq=1',
  '/projects/?tech=react',
  '/places/photos/?category=food',
  '/media?series=coding-marathon',
  '/media?kind=video&seq=1',
  '/media?kind=video&qq=1',
  '/media?faq=1',
  '/projects?tech=react',
  '/places?year=2024',
  '/certifications?issuer=aws',
  // Pages that take no search: a `q` there changes nothing they render.
  '/?q=anything',
  '/experience?q=anything',
  '/stats?q=anything',
  '/projects/project-1?q=anything',
  '/places/place-1?q=anything',
  '/media-kit?q=anything',
  // The same with a trailing slash: a detail page under a list page is not that page's search.
  '/experience/?q=anything',
  '/stats/?q=anything',
  '/projects/project-1/?q=anything',
  '/projects/project-1/?a=1&q=anything',
  '/places/place-1/?q=anything',
  '/media-kit/?q=anything',
];

/** The content API, whose data the pages now render on the server, and the service endpoints. */
const CLOSED_PATHS = [
  '/api/',
  '/api/v1/',
  '/api/v1/sanity/projects',
  '/api/v1/sanity/places',
  '/api/v1/blog',
  '/api/v1/github-stats',
  '/api/v1/now-playing',
  '/api/admin',
  '/api/admin/ban',
  '/api/status',
  '/api/health',
  '/api/v1/health',
  '/api/v1/status',
  '/api/v1/version',
  '/api/v1/info',
  GUESTBOOK_MESSAGES,
  `${GUESTBOOK_MESSAGES}?page=2`,
];

const APP_DIR = join(process.cwd(), 'src/app');

/** Every .ts and .tsx file under `dir`. */
const sourceFilesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFilesIn(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

/**
 * The routes with a filter schema (defineFilters, src/lib/filters): the schema's search is the
 * `?q=` their FilterBar submits. A route is its folder under src/app without route groups and
 * private folders, e.g. (routes)/(dev)/media/_lib/media-filters.ts is /media. The lab is left
 * out: it is noindex and off in production.
 */
function routesWithFilters(): string[] {
  const routes = sourceFilesIn(APP_DIR)
    .filter((file) => /\bdefineFilters(?:<[^>]*>)?\(/.test(readFileSync(file, 'utf8')))
    .map((file) => {
      const segments = relative(APP_DIR, file).split(sep).slice(0, -1);
      const firstPrivate = segments.findIndex((segment) => segment.startsWith('_'));
      const route = (firstPrivate === -1 ? segments : segments.slice(0, firstPrivate)).filter(
        (segment) => !/^\(.*\)$/.test(segment),
      );
      return `/${route.join('/')}`;
    })
    .filter((route) => !route.startsWith('/lab'));
  return [...new Set(routes)].sort();
}

describe('robots', () => {
  const config = robots();

  it("uses a wildcard only inside a list page's own query string, and never `$`", () => {
    const patterns = rulesOf(config).flatMap((rule) => [
      ...toList(rule.allow),
      ...toList(rule.disallow),
    ]);
    expect(patterns.length).toBeGreaterThan(0);
    for (const pattern of patterns) {
      expect(pattern).not.toContain('$');
      if (!pattern.includes('*')) continue;
      // `<page>?*&q=` or `<page>/?*&q=`: the page's exact path up to its `?`, so the wildcard
      // can never span another URL's path.
      const page = SEARCHABLE_PAGES.flatMap(formsOf).find((path) => pattern === `${path}?*&q=`);
      expect({ pattern, page: page !== undefined }).toEqual({ pattern, page: true });
    }
  });

  it('keeps the Googlebot, Applebot and Bingbot groups and one `*` group', () => {
    const agents = rulesOf(config).map((rule) => toList(rule.userAgent).sort());

    expect(agents).toEqual([['Googlebot'], ['Applebot', 'Bingbot'], ['*']]);
  });

  it.each(rulesOf(config).map((rule) => [toList(rule.userAgent).join(', '), rule] as const))(
    'the %s group allows / and /api/og, disallows /api/ and list searches, and opens nothing under /api/v1',
    (_agents, rule) => {
      const allow = toList(rule.allow);

      expect(allow).toEqual(['/', '/api/og']);
      expect(toList(rule.disallow)).toEqual(['/api/', ...SEARCHABLE_PAGES.flatMap(searchRulesOf)]);
      expect(allow.filter((pattern) => pattern.startsWith('/api/v1'))).toEqual([]);
    },
  );

  it.each(CRAWLERS)('lets %s fetch pages and the OG image', (crawler) => {
    const group = groupFor(config, crawler);
    expect(group).toBeDefined();
    for (const path of CRAWLABLE_PATHS) {
      expect({ path, allowed: isAllowed(group as RobotsRule, path) }).toEqual({
        path,
        allowed: true,
      });
    }
  });

  it.each(CRAWLERS)('keeps %s out of the rest of /api/', (crawler) => {
    const group = groupFor(config, crawler) as RobotsRule;
    for (const path of CLOSED_PATHS) {
      expect({ path, allowed: isAllowed(group, path) }).toEqual({ path, allowed: false });
    }
  });

  it.each(CRAWLERS)("keeps %s out of every list page's search results", (crawler) => {
    const group = groupFor(config, crawler) as RobotsRule;
    for (const path of SEARCH_URLS) {
      expect({ path, allowed: isAllowed(group, path) }).toEqual({ path, allowed: false });
    }
  });

  it.each(CRAWLERS)(
    'lets %s fetch optimised images, assets and every URL that is not a list search',
    (crawler) => {
      const group = groupFor(config, crawler) as RobotsRule;
      for (const path of NOT_SEARCH_URLS) {
        expect({ path, allowed: isAllowed(group, path) }).toEqual({ path, allowed: true });
      }
    },
  );

  it('gives each list page four rules: `q` first or later, with and without a trailing slash', () => {
    expect(searchRulesOf('/media')).toEqual([
      '/media?q=',
      '/media?*&q=',
      '/media/?q=',
      '/media/?*&q=',
    ]);
    const patterns = toList(groupFor(config, 'Googlebot')?.disallow);

    for (const page of SEARCHABLE_PAGES) {
      expect(patterns).toEqual(expect.arrayContaining(searchRulesOf(page)));
    }
  });

  it('has no blanket rule for a `q` parameter, which would block /_next/image', () => {
    const patterns = rulesOf(config).flatMap((rule) => toList(rule.disallow));

    expect(patterns.filter((pattern) => /^\/?\*/.test(pattern))).toEqual([]);
    expect(patterns.filter((pattern) => pattern.startsWith('/_next'))).toEqual([]);
  });

  it('covers every route that defines a filter schema, which is what takes ?q=', () => {
    const routes = routesWithFilters();

    // The scan does find schemas (it reads src/app), so the check below is not empty.
    expect(routes).toEqual(expect.arrayContaining(['/places', '/projects']));
    expect(SEARCHABLE_PAGES).toEqual(expect.arrayContaining(routes));
  });

  it('has no rule for /legal, which is not a route', () => {
    const patterns = rulesOf(config).flatMap((rule) => toList(rule.disallow));
    expect(patterns.filter((pattern) => pattern.startsWith('/legal'))).toEqual([]);
  });

  it('points crawlers at the sitemap', () => {
    expect(config.sitemap).toBe('https://mikeodnis.dev/sitemap.xml');
  });
});
