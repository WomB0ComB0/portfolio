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
 * @file The site's JSON-LD: a Person and a WebSite on every page, one CollectionPage on /media,
 * each a native script element in the server HTML.
 *
 * The site is one person's, so nothing is typed Organization. `sameAs` lists only profiles the
 * repo already names, and the checks below pin the ones that have a constant elsewhere. /media
 * gets the page node alone: no VideoObject, BlogPosting or ItemList for its rows, which live on
 * other sites.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

import { JsonLd, StructuredData } from '@/components/scripts/structured-data';
import { app } from '@/constants/app';
import { profile } from '@/constants/profile';
import {
  collectionPageJsonLd,
  PERSON_ID,
  PROFILE_URLS,
  serializeJsonLd,
  siteJsonLd,
  WEBSITE_ID,
} from '@/lib/seo/json-ld';
import { YOUTUBE_CHANNEL_HANDLE, YOUTUBE_CHANNEL_URL } from '@/lib/youtube/channel';
import { constructMetadata } from '@/utils/seo/meta';

const SITE = 'https://mikeodnis.dev';

const sourceOf = (file: string): string => readFileSync(join(process.cwd(), file), 'utf8');

/** Types that would claim more than the pages show (see the file comment). */
const UNWANTED_TYPES = /"@type":"(?:Organization|VideoObject|BlogPosting|ItemList)"/;

interface ParsedScript {
  readonly attributes: string;
  readonly json: string;
}

/** Every JSON-LD script element in an HTML string, as its attributes and raw text. */
const jsonLdScripts = (html: string): ParsedScript[] =>
  [...html.matchAll(/<script([^>]*type="application\/ld\+json"[^>]*)>([\s\S]*?)<\/script>/g)].map(
    ([, attributes = '', json = '']) => ({ attributes, json }),
  );

const serverHtml = (element: ReactElement): string => renderToStaticMarkup(element);

describe('siteJsonLd', () => {
  const graph = siteJsonLd()['@graph'];
  const [person, website] = graph;

  it('is a schema.org graph of exactly a Person and a WebSite, with no Organization', () => {
    expect(siteJsonLd()['@context']).toBe('https://schema.org');
    expect(graph.map((node) => node['@type'])).toEqual(['Person', 'WebSite']);
    expect(JSON.stringify(siteJsonLd())).not.toMatch(UNWANTED_TYPES);
  });

  it('identifies the person and the site by fragments of the home page URL', () => {
    expect(PERSON_ID).toBe(`${SITE}/#person`);
    expect(WEBSITE_ID).toBe(`${SITE}/#website`);
    expect(person['@id']).toBe(PERSON_ID);
    expect(website['@id']).toBe(WEBSITE_ID);
  });

  it("names both after the site's owner and points both at the home page", () => {
    expect(person.name).toBe(app.name);
    expect(website.name).toBe(app.name);
    expect(person.url).toBe(`${SITE}/`);
    expect(website.url).toBe(`${SITE}/`);
  });

  it('ties the site to the person by id, not by a second copy of the person', () => {
    expect(website.publisher).toEqual({ '@id': PERSON_ID });
  });

  it('lists the profiles as sameAs: https, each once, never the site itself', () => {
    expect(person.sameAs).toEqual(PROFILE_URLS);
    expect(new Set(PROFILE_URLS).size).toBe(PROFILE_URLS.length);
    for (const url of PROFILE_URLS) {
      const parsed = new URL(url);
      expect(parsed.protocol).toBe('https:');
      expect(parsed.host).not.toBe(new URL(SITE).host);
    }
  });

  it('uses the same public GitHub and LinkedIn destinations as the shared identity', () => {
    expect(PROFILE_URLS).toContain(profile.github.url);
    expect(PROFILE_URLS).toContain(profile.linkedinUrl);
  });

  it('includes the YouTube channel whose uploads /media lists', () => {
    expect(YOUTUBE_CHANNEL_URL).toBe(`https://www.youtube.com/${YOUTUBE_CHANNEL_HANDLE}`);
    expect(YOUTUBE_CHANNEL_HANDLE).toMatch(/^@[\w.-]+$/);
    expect(PROFILE_URLS).toContain(YOUTUBE_CHANNEL_URL);
  });

  it('names the X profile by the handle the Twitter card credits', () => {
    expect(constructMetadata().twitter?.creator).toBe(profile.x.handle);
    expect(PROFILE_URLS).toContain(`https://x.com/${profile.x.handle.slice(1)}`);
  });

  it('builds a new object on each call, so no caller can change another page', () => {
    expect(siteJsonLd()).not.toBe(siteJsonLd());
    expect(siteJsonLd()).toEqual(siteJsonLd());
  });
});

describe('collectionPageJsonLd', () => {
  it("is the brief's /media node: the page, part of the site, by the person", () => {
    expect(collectionPageJsonLd({ path: '/media', name: 'Media' })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${SITE}/media#page`,
      url: `${SITE}/media`,
      name: 'Media',
      isPartOf: { '@id': `${SITE}/#website` },
      author: { '@id': `${SITE}/#person` },
    });
  });

  it('lists no rows: the page node only', () => {
    const json = JSON.stringify(collectionPageJsonLd({ path: '/media', name: 'Media' }));

    expect(json).not.toMatch(UNWANTED_TYPES);
    expect(json).not.toMatch(/hasPart|itemListElement|mainEntity/);
  });
});

describe('serializeJsonLd', () => {
  const hostile = collectionPageJsonLd({
    path: '/media',
    name: '</script><script>alert(1)</script><!-- <b>',
  });

  it('escapes every "<", so no value can close the script element or open a comment', () => {
    const json = serializeJsonLd(hostile);

    expect(json).not.toContain('<');
    expect(json).toContain('\\u003c/script>');
  });

  it('still parses back to the same data', () => {
    expect(JSON.parse(serializeJsonLd(hostile))).toEqual(hostile);
    expect(JSON.parse(serializeJsonLd(siteJsonLd()))).toEqual(siteJsonLd());
  });
});

describe('JsonLd', () => {
  it('renders a native script element with the JSON as its text, on the server', () => {
    const data = collectionPageJsonLd({ path: '/media', name: 'Media' });

    const scripts = jsonLdScripts(serverHtml(<JsonLd data={data} />));

    expect(scripts).toHaveLength(1);
    // Raw JSON: React must not HTML-escape the quotes, or no parser could read it.
    expect(scripts[0]?.json).not.toContain('&quot;');
    expect(JSON.parse(scripts[0]?.json ?? '')).toEqual(data);
  });

  it('keeps a hostile value inside the one script element', () => {
    const data = collectionPageJsonLd({ path: '/media', name: '</script><p id="escaped">' });

    const html = serverHtml(<JsonLd data={data} />);

    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html).not.toContain('<p id="escaped">');
    expect(JSON.parse(jsonLdScripts(html)[0]?.json ?? '')).toEqual(data);
  });

  it('is a server component: no client directive and no next/script, which injects in the browser', () => {
    const source = sourceOf('src/components/scripts/structured-data.tsx');

    expect(source).not.toMatch(/^\s*['"]use client['"]/m);
    expect(source).not.toMatch(/from 'next\/script'/);
  });
});

describe('StructuredData', () => {
  it("puts the site's Person and WebSite in the server HTML, in one script", () => {
    const scripts = jsonLdScripts(serverHtml(<StructuredData nonce={undefined} />));

    expect(scripts).toHaveLength(1);
    expect(JSON.parse(scripts[0]?.json ?? '')).toEqual(siteJsonLd());
  });

  it('carries the request nonce when the layout has one', () => {
    const [script] = jsonLdScripts(serverHtml(<StructuredData nonce="nonce-example" />));

    expect(script?.attributes).toContain('nonce="nonce-example"');
  });
});
