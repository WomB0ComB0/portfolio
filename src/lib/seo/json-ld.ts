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
 * @file The site's JSON-LD as plain data: the person the site is about and the site itself, on
 * every page, and a page node for a list page. Pure, so it is unit-tested as data;
 * src/components/scripts/structured-data.tsx writes it into the server HTML.
 *
 * The site is one person's, so the nodes are a Person and a WebSite, never an Organization. A
 * node says only what the pages show or the repo already names: no job title, employer or place.
 * List rows get no nodes of their own (no VideoObject, BlogPosting or ItemList): what /media
 * lists lives on other sites, and structured data belongs on the page it describes.
 */

import { app } from '@/constants/app';
import { profile } from '@/constants/profile';
import { YOUTUBE_CHANNEL_URL } from '@/lib/youtube/channel';

const SCHEMA_CONTEXT = 'https://schema.org';

/** The absolute URL of `path` on the origin the canonical link and og:url use (app.url). */
const siteUrl = (path: string): string => new URL(path, app.url).href;

const HOME_URL = siteUrl('/');

/**
 * The ids other nodes point at: fragments of the home page URL, as identifiers only (nothing
 * serves them). They must not change once crawled, or the nodes stop joining up.
 */
export const PERSON_ID = `${HOME_URL}#person`;
export const WEBSITE_ID = `${HOME_URL}#website`;

/** Public profile URLs shared with visible identity links and social metadata. */
export const PROFILE_URLS: readonly string[] = [
  profile.github.url,
  profile.linkedinUrl,
  YOUTUBE_CHANNEL_URL,
  profile.x.url,
  profile.blueskyUrl,
  profile.instagramUrl,
  profile.blogUrl,
  profile.newsletterUrl,
];

/** A pointer to a node defined elsewhere in the site's JSON-LD. */
interface NodeRef {
  readonly '@id': string;
}

export interface PersonNode {
  readonly '@type': 'Person';
  readonly '@id': string;
  readonly name: string;
  readonly url: string;
  readonly sameAs: readonly string[];
}

export interface WebSiteNode {
  readonly '@type': 'WebSite';
  readonly '@id': string;
  readonly url: string;
  readonly name: string;
  readonly publisher: NodeRef;
}

/** Every page's JSON-LD: the person, then the site. */
export interface SiteJsonLd {
  readonly '@context': typeof SCHEMA_CONTEXT;
  readonly '@graph': readonly [PersonNode, WebSiteNode];
}

/** A list page's JSON-LD: the page itself, with no node per row. */
export interface CollectionPageJsonLd {
  readonly '@context': typeof SCHEMA_CONTEXT;
  readonly '@type': 'CollectionPage';
  readonly '@id': string;
  readonly url: string;
  readonly name: string;
  readonly isPartOf: NodeRef;
  readonly author: NodeRef;
}

export type JsonLdDocument = SiteJsonLd | CollectionPageJsonLd;

/**
 * The JSON-LD every page carries: who the site is about and the site, joined by id. The site's
 * `name` is what a search engine may show as the site name.
 */
export function siteJsonLd(): SiteJsonLd {
  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [
      {
        '@type': 'Person',
        '@id': PERSON_ID,
        name: app.name,
        url: HOME_URL,
        sameAs: [...PROFILE_URLS],
      },
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        url: HOME_URL,
        name: app.name,
        publisher: { '@id': PERSON_ID },
      },
    ],
  };
}

export interface CollectionPageOptions {
  /** The page's path on the site, e.g. /media. */
  readonly path: string;
  /** The page's name, as its h1 says it. */
  readonly name: string;
}

/** A list page as a CollectionPage: part of the site, by the person. */
export function collectionPageJsonLd({ path, name }: CollectionPageOptions): CollectionPageJsonLd {
  const url = siteUrl(path);
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'CollectionPage',
    '@id': `${url}#page`,
    url,
    name,
    isPartOf: { '@id': WEBSITE_ID },
    author: { '@id': PERSON_ID },
  };
}

/**
 * The JSON text for a script element. Every `<` becomes JSON's own `<` escape, as Next's
 * JSON-LD guide shows, so no value can close the script element or open an HTML comment; a
 * JSON parser reads it back as `<`.
 */
export function serializeJsonLd(data: JsonLdDocument): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
