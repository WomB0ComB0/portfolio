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
 * @file /bookshelf against the live Sanity data, read-only. Nothing hard-codes a count, a slug or
 * a title: the book comes from /api/v1/sanity/books (the cached read the pages share), the shelf
 * from the page's own shelf links.
 * - /bookshelf answers 200 with the h1 "Bookshelf" and at least one cover from cdn.sanity.io, or,
 *   with no book published, its "No books yet" state.
 * - The first book's /bookshelf/<slug> answers 200 with the book's title in its h1 and its cover
 *   image served from https://cdn.sanity.io.
 * - A shelf link on /bookshelf leads to a /bookshelf/shelf/<slug> page that answers 200.
 * - Unknown book and shelf slugs answer 404.
 * - The public books JSON names each book's shelf and cover, and none of the removed fields
 *   (`coverUrl`, `spine`).
 *
 * The browser aborts every request that is not GET or HEAD, and service workers are blocked.
 */

import { type APIRequestContext, expect, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import { readOnly } from '../fixtures/console-routes';

/** The shell's one `<main>` (src/components/animations/pages/page-transition.tsx). */
const MAIN = 'main#main-content';
/** A cover served by the Sanity image CDN, which is where every book cover now lives. */
const SANITY_COVER = 'img[src^="https://cdn.sanity.io/images/"]';
/** What /bookshelf says when no book is published (bookshelf/(list)/page.tsx). */
const EMPTY_TEXT = 'No books yet';
const SHELF_LINK = `${MAIN} a[href^="/bookshelf/shelf/"]`;
const MISSING_PAGES = ['/bookshelf/does-not-exist', '/bookshelf/shelf/does-not-exist'] as const;

/** A book as /api/v1/sanity/books serves it: the raw projection, so every field is optional. */
interface ApiBook {
  readonly title?: string;
  readonly slug?: { readonly current?: string } | null;
  readonly coverImage?: { readonly asset?: { readonly _ref?: string } | null } | null;
}

const urlOf = (path: string): string => `${getTargetUrl()}${path}`;

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => readOnly(page));

/** The published books, in the API's order (shelf position first, then creation). */
async function publishedBooks(request: APIRequestContext): Promise<readonly ApiBook[]> {
  const response = await request.get(urlOf('/api/v1/sanity/books'));
  expect(response.ok(), 'GET /api/v1/sanity/books').toBe(true);
  const body: unknown = await response.json();
  expect(Array.isArray(body), 'the books JSON is a list').toBe(true);
  return body as ApiBook[];
}

/** The first published book with a slug, a title and a cover, or null when there is none. */
async function firstBook(
  request: APIRequestContext,
): Promise<{ readonly slug: string; readonly title: string } | null> {
  const book = (await publishedBooks(request)).find(
    (candidate) =>
      typeof candidate.slug?.current === 'string' &&
      typeof candidate.title === 'string' &&
      Boolean(candidate.coverImage?.asset?._ref),
  );
  return book ? { slug: book.slug?.current ?? '', title: book.title ?? '' } : null;
}

test.describe('the bookshelf against the live data', () => {
  test('/bookshelf answers 200 with its h1 and covers from Sanity', async ({ page, request }) => {
    const books = await publishedBooks(request);
    const response = await page.goto(urlOf('/bookshelf'));

    expect(response?.status()).toBe(200);
    const main = page.locator(MAIN);
    await expect(main).toHaveCount(1);
    await expect(
      main.getByRole('heading', { level: 1, name: 'Bookshelf', exact: true }),
    ).toBeVisible();
    if (books.length === 0) {
      await expect(main.getByText(EMPTY_TEXT, { exact: true })).toBeVisible();
      return;
    }
    await expect(main.locator(SANITY_COVER).first()).toBeAttached();
  });

  test("the first book's page answers 200 with its title and its Sanity cover", async ({
    page,
    request,
  }) => {
    const book = await firstBook(request);
    test.skip(book === null, 'no book with a cover is published');
    if (!book) return;

    const response = await page.goto(urlOf(`/bookshelf/${encodeURIComponent(book.slug)}`));

    expect(response?.status()).toBe(200);
    const main = page.locator(MAIN);
    await expect(main.getByRole('heading', { level: 1 })).toContainText(book.title);
    await expect(main.locator(SANITY_COVER).first()).toBeVisible();
  });

  test('a shelf link on /bookshelf opens a shelf page that answers 200', async ({
    page,
    request,
  }) => {
    test.skip((await publishedBooks(request)).length === 0, 'no book is published');
    await page.goto(urlOf('/bookshelf'));
    const link = page.locator(SHELF_LINK).first();
    await expect(link).toBeAttached();
    const href = (await link.getAttribute('href')) ?? '';
    expect(href).toMatch(/^\/bookshelf\/shelf\/[a-z0-9]+(?:-[a-z0-9]+)*$/);

    const response = await page.goto(urlOf(href));

    expect(response?.status()).toBe(200);
    await expect(page.locator(MAIN).getByRole('heading', { level: 1 })).toBeVisible();
  });

  for (const path of MISSING_PAGES) {
    test(`${path} answers 404`, async ({ request }) => {
      const response = await request.get(urlOf(path));
      expect(response.status()).toBe(404);
    });
  }

  test('the public books JSON names a shelf and a cover, and no removed field', async ({
    request,
  }) => {
    const books = await publishedBooks(request);
    test.skip(books.length === 0, 'no book is published');
    for (const book of books) {
      expect(book).toHaveProperty('shelfId');
      expect(book).toHaveProperty('coverImage');
      expect(book).not.toHaveProperty('coverUrl');
      expect(book).not.toHaveProperty('spine');
    }
  });
});
