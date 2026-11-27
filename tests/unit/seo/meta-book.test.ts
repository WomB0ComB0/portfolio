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
 * @file constructMetadata's two options for a book's page: an image given as an object (its URL
 * with the size, type and alt text it is drawn at), which X gets exactly as Open Graph does; and
 * a book, which makes og:type 'book' with its book:author, book:isbn and book:tag tags. Next's own
 * Open Graph resolver is run on the result, so the tags it writes are the ones checked. Pages
 * that pass neither are pinned in meta-unchanged.test.ts.
 */

import { resolveOpenGraph } from 'next/dist/lib/metadata/resolvers/resolve-opengraph';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
});

import { constructMetadata } from '@/utils/seo/meta';

const cover = {
  url: '/api/og/book/job-ready-python?v=abc123',
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: 'Cover of Job Ready Python by Hayden Van Der Post, unread, on the Web & Languages shelf',
} as const;

/** The Open Graph tags Next writes for `metadata`, through its own resolver. */
const resolved = (metadata: ReturnType<typeof constructMetadata>) =>
  resolveOpenGraph(
    metadata.openGraph,
    new URL('https://mikeodnis.dev'),
    Promise.resolve('/bookshelf/job-ready-python'),
    { trailingSlash: false, isStaticMetadataRouteFile: false },
    null,
  );

describe('constructMetadata with an image object', () => {
  const metadata = constructMetadata({ title: 'Job Ready Python (Stage 01)', image: cover });

  it('declares the image with its size, type and alt text as og:image', () => {
    expect(metadata.openGraph?.images).toEqual([cover]);
  });

  it('gives X the same image, alt text included, so twitter:image matches og:image', () => {
    expect(metadata.twitter).toMatchObject({ images: [cover] });
  });

  it('copies the image rather than sharing the caller’s object', () => {
    const [image] = [metadata.openGraph?.images].flat();

    expect(image).not.toBe(cover);
  });
});

describe('constructMetadata with a book', () => {
  const book = {
    authors: ['Hayden Van Der Post', 'Alice Smith'],
    isbn: '9781234567897',
    tags: ['Web & Languages'],
  };

  it("makes og:type 'book' with its authors, ISBN and tags", async () => {
    const og = await resolved(constructMetadata({ title: 'Job Ready Python', book }));

    expect(og).toMatchObject({
      type: 'book',
      authors: ['Hayden Van Der Post', 'Alice Smith'],
      isbn: '9781234567897',
      tags: ['Web & Languages'],
    });
  });

  it('leaves out book:isbn and book:tag when the book has none', async () => {
    const og = await resolved(
      constructMetadata({ title: 'Job Ready Python', book: { authors: ['Hayden Van Der Post'] } }),
    );

    expect(og).toMatchObject({ type: 'book', authors: ['Hayden Van Der Post'] });
    expect(og).not.toHaveProperty('isbn');
    expect(og).not.toHaveProperty('tags');
  });

  it('keeps og:type where it was among the Open Graph keys', () => {
    const keys = Object.keys(
      constructMetadata({ title: 'Job Ready Python', book }).openGraph ?? {},
    );

    expect(keys.slice(0, 4)).toEqual(['title', 'description', 'siteName', 'type']);
    expect(keys.at(-1)).toBe('images');
  });

  it('copies the authors and tags rather than sharing the caller’s arrays', () => {
    const og = constructMetadata({ title: 'Job Ready Python', book }).openGraph as {
      authors: string[];
      tags: string[];
    };

    expect(og.authors).not.toBe(book.authors);
    expect(og.tags).not.toBe(book.tags);
  });

  it('keeps every other page an og:type website', async () => {
    const og = await resolved(constructMetadata({ title: 'Stats', path: '/stats' }));

    expect(og).toMatchObject({ type: 'website' });
    expect(og).not.toHaveProperty('authors');
  });
});
