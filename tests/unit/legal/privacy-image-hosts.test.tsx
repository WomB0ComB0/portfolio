// @vitest-environment node
/**
 * Copyright 2026 Mike Odnis
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
 * @file The privacy policy names every outside host a visitor's browser loads images and media
 * from, and quotes the Referrer-Policy the site really sends.
 *
 * Images load straight from their CDNs (CdnImage, since 2026-11-17), so the page CSP's img-src,
 * media-src and frame-src are the hosts a browser can contact for them. A host added there fails
 * this test until the policy names it, or until it is listed below with the reason it is left out.
 */

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Privacy } from '@/app/(routes)/(legal)/privacy/_interface/privacy/privacy';
import { SECURITY_HEADERS } from '@/config/security-headers';
import { buildContentSecurityPolicy } from '@/lib/security/csp';

const MEDIA_DIRECTIVES = ['img-src', 'media-src', 'frame-src'] as const;

/** Sources the policy covers without naming a host: the site itself and its Google services. */
const COVERED_ELSEWHERE: ReadonlySet<string> = new Set([
  "'self'",
  'data:',
  'blob:',
  'https://mikeodnis.dev',
  // Google Analytics and Google Maps, named in the policy as Google services.
  'https://*.google-analytics.com',
  'https://*.analytics.google.com',
  'https://*.googletagmanager.com',
  'https://maps.googleapis.com',
  'https://maps.gstatic.com',
]);

/**
 * Allowed by img-src, but no component builds an image URL on them and no live page used them
 * (home, /media, /spotify, /stats, /sponsor, /experience, /projects, /places, /guestbook on
 * 2026-11-19). Name a host in the policy before moving it out of this list.
 */
const ALLOWED_BUT_UNUSED: ReadonlySet<string> = new Set([
  'https://lh3.googleusercontent.com',
  'https://github.com',
  'https://api.lanyard.rest',
  'https://res.cloudinary.com',
]);

const policy = buildContentSecurityPolicy({ nonce: 'test', isDev: false, mode: 'enforce' });

/** The sources of one CSP directive, or none when the directive is absent. */
const sourcesOf = (directive: string): string[] =>
  policy
    .split('; ')
    .find((entry) => entry.startsWith(`${directive} `))
    ?.split(' ')
    .slice(1) ?? [];

const mediaSources = [...new Set(MEDIA_DIRECTIVES.flatMap(sourcesOf))];

/** Hosts the policy must name: every media source that is neither covered elsewhere nor unused. */
const disclosedHosts = [
  ...new Set(
    mediaSources
      .filter((source) => !COVERED_ELSEWHERE.has(source) && !ALLOWED_BUT_UNUSED.has(source))
      .map((source) => new URL(source).hostname),
  ),
];

/** `html` with every `<...>` run dropped, scanned once so no tag can be rebuilt from the parts. */
const withoutTags = (html: string): string => {
  let text = '';
  let inTag = false;
  for (const char of html) {
    if (char === '<') inTag = true;
    else if (char === '>') inTag = false;
    else if (!inTag) text += char;
  }
  return text;
};

const pageText = withoutTags(renderToString(Privacy())).replaceAll(/\s+/g, ' ');

describe('Privacy policy image and media hosts', () => {
  it('finds outside hosts to check in the page CSP', () => {
    expect(disclosedHosts).toEqual(expect.arrayContaining(['cdn.sanity.io', 'i.scdn.co']));
  });

  it.each(disclosedHosts)('names %s', (host) => {
    expect(pageText).toContain(host);
  });

  it('lists only exemptions the CSP still allows', () => {
    const stale = [...COVERED_ELSEWHERE, ...ALLOWED_BUT_UNUSED].filter(
      (source) => !mediaSources.includes(source),
    );

    expect(stale).toEqual([]);
  });

  it('quotes the Referrer-Policy the site sends', () => {
    const referrerPolicy = SECURITY_HEADERS.find(({ key }) => key === 'Referrer-Policy')?.value;

    expect(referrerPolicy).toBeDefined();
    expect(pageText).toContain(`Referrer-Policy is ${referrerPolicy}`);
  });
});
