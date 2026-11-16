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
 * @file /media's own JSON-LD in its server HTML: one CollectionPage node, named as the h1 names
 * the page, and nothing about its rows.
 *
 * The rows link to videos and posts on other sites, so a VideoObject, BlogPosting or ItemList
 * here would describe pages that are not this one. A filtered URL (?q=, ?kind=) is the same
 * page with the same canonical, so it carries the same node and never the query.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST, parse, serverHtml, textOf, VIDEOS } from '../media/media-page-fixtures';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

const { loaders, fetchBlogs } = vi.hoisted(() => ({
  loaders: {
    loadVideos: vi.fn(),
    loadVideoList: vi.fn(),
    loadTalks: vi.fn(),
    loadPresentations: vi.fn(),
    loadArticles: vi.fn(),
    loadProjects: vi.fn(),
  },
  fetchBlogs: vi.fn(),
}));

// t3-env validates every variable on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/sanity/loaders', () => loaders);
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});
vi.mock('@/app/api/v1/[[...route]]/blog/handlers', () => ({ fetchBlogs }));
vi.mock('@/lib/observability/report', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/observability/report')>()),
  reportApiFailure: vi.fn(() => true),
  reportError: vi.fn(() => true),
}));

const SITE = 'https://mikeodnis.dev';

/** The page's JSON-LD blocks, parsed. */
const jsonLdOf = (root: HTMLElement): Record<string, unknown>[] =>
  [...root.querySelectorAll('script[type="application/ld+json"]')].map(
    (script) => JSON.parse(script.textContent ?? '') as Record<string, unknown>,
  );

beforeEach(() => {
  loaders.loadVideos.mockResolvedValue(VIDEOS);
  loaders.loadVideoList.mockImplementation(async () => ({
    videos: await loaders.loadVideos(),
    complete: true,
  }));
  loaders.loadTalks.mockResolvedValue([]);
  loaders.loadPresentations.mockResolvedValue([]);
  loaders.loadArticles.mockResolvedValue([]);
  loaders.loadProjects.mockResolvedValue([]);
  fetchBlogs.mockResolvedValue([POST]);
});

describe("/media's JSON-LD", () => {
  it('is one CollectionPage node in the server HTML, named as the h1 names the page', async () => {
    const root = parse(await serverHtml());

    expect(jsonLdOf(root)).toEqual([
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${SITE}/media#page`,
        url: `${SITE}/media`,
        name: textOf(root.querySelector('h1')),
        isPartOf: { '@id': `${SITE}/#website` },
        author: { '@id': `${SITE}/#person` },
      },
    ]);
  });

  it('gives no row a node: no video, post or list type, and no row title', async () => {
    const root = parse(await serverHtml());
    const json = [...root.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => script.textContent ?? '')
      .join('\n');

    // The rows are there to be left out.
    expect(textOf(root)).toContain(POST.title);
    expect(json).not.toMatch(/VideoObject|BlogPosting|ItemList|itemListElement|hasPart/);
    for (const title of [POST.title, ...VIDEOS.map((video) => video.title)]) {
      expect(json).not.toContain(title);
    }
  });

  /** Filtered URLs: a search, a kind, and a search that tries to close the script element. */
  const FILTERS: Record<string, string>[] = [
    { q: 'marathon' },
    { kind: 'video' },
    { q: '</script><b>x' },
  ];

  it.each(FILTERS)('is the same node on a filtered URL (%o), never the query', async (params) => {
    const [unfiltered, filtered] = await Promise.all([serverHtml(), serverHtml(params)]);

    expect(jsonLdOf(parse(filtered))).toEqual(jsonLdOf(parse(unfiltered)));
  });
});
