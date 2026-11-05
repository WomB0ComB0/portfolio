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
 * wins, `Allow` wins a tie, and a path no rule matches is allowed.
 *
 * Pages render their content on the server, so crawlers get the pages and the OG image route,
 * and /api/ is closed again, the content API included. The one interim exception is
 * /api/v1/messages: the guestbook still loads its messages in the browser.
 */

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

/** Length of the longest rule that is a prefix of `path`, or -1 when none is. */
const longestMatch = (patterns: string[], path: string): number =>
  Math.max(-1, ...patterns.filter((pattern) => path.startsWith(pattern)).map((p) => p.length));

function isAllowed(rule: RobotsRule, path: string): boolean {
  return longestMatch(toList(rule.allow), path) >= longestMatch(toList(rule.disallow), path);
}

const CRAWLERS = ['Googlebot', 'Bingbot', 'Applebot', 'DuckDuckBot'] as const;

/** The guestbook's messages: the only API path a page still reads in the browser. */
const GUESTBOOK_MESSAGES = '/api/v1/messages';

/** Pages (detail pages included), the OG image route link previews use, and the guestbook's messages. */
const CRAWLABLE_PATHS = [
  '/',
  '/projects',
  '/projects/project-1',
  '/experience/experience-1',
  '/places/place-1',
  '/sitemap.xml',
  '/api/og',
  '/api/og?title=Projects',
  GUESTBOOK_MESSAGES,
  `${GUESTBOOK_MESSAGES}?page=2`,
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
];

describe('robots', () => {
  const config = robots();

  it('uses only plain prefix rules, which is all this evaluator understands', () => {
    const patterns = rulesOf(config).flatMap((rule) => [
      ...toList(rule.allow),
      ...toList(rule.disallow),
    ]);
    expect(patterns.length).toBeGreaterThan(0);
    for (const pattern of patterns) expect(pattern).not.toMatch(/[*$]/);
  });

  it('keeps the Googlebot, Applebot and Bingbot groups and one `*` group', () => {
    const agents = rulesOf(config).map((rule) => toList(rule.userAgent).sort());

    expect(agents).toEqual([['Googlebot'], ['Applebot', 'Bingbot'], ['*']]);
  });

  it.each(rulesOf(config).map((rule) => [toList(rule.userAgent).join(', '), rule] as const))(
    'the %s group allows / and /api/og, disallows /api/, and opens only the guestbook under /api/v1',
    (_agents, rule) => {
      const allow = toList(rule.allow);

      expect(allow).toEqual(expect.arrayContaining(['/', '/api/og']));
      expect(toList(rule.disallow)).toEqual(['/api/']);
      expect(allow).not.toContain('/api/v1/');
      expect(allow.filter((pattern) => pattern.startsWith('/api/v1'))).toEqual([
        GUESTBOOK_MESSAGES,
      ]);
    },
  );

  it.each(CRAWLERS)('lets %s fetch pages, the OG image and the guestbook messages', (crawler) => {
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

  it('has no rule for /legal, which is not a route', () => {
    const patterns = rulesOf(config).flatMap((rule) => toList(rule.disallow));
    expect(patterns.filter((pattern) => pattern.startsWith('/legal'))).toEqual([]);
  });

  it('points crawlers at the sitemap', () => {
    expect(config.sitemap).toBe('https://mikeodnis.dev/sitemap.xml');
  });
});
