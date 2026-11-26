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
 * a title. The books and shelves the checks use come from what /bookshelf renders (its catalog),
 * never from the raw books JSON alone: the JSON also lists books the catalog leaves out, such as a
 * book whose shelf is unpublished, and those have no page.
 * - /bookshelf answers 200 with the h1 "Bookshelf" and either at least one cover from
 *   cdn.sanity.io and a book on stage, or, with no book in its catalog, its "No books yet" state.
 * - The book /bookshelf puts on stage first has a /bookshelf/<slug> page that answers 200 with
 *   its title in the h1 and its cover image served from https://cdn.sanity.io. /bookshelf renders
 *   no book slug (its books open in place), so the slug is the books JSON's for that title.
 * - A shelf link on /bookshelf leads to a /bookshelf/shelf/<slug> page that answers 200.
 * - Unknown book and shelf slugs answer 404.
 * - The public books JSON names each book's shelf and cover, and none of the removed fields
 *   (`coverUrl`, `spine`).
 *
 * The browser aborts every request that is not GET or HEAD, and service workers are blocked.
 */

import { type APIRequestContext, expect, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import { readOnly } from '../fixtures/console-routes';

/** The shell's one `<main>` (src/components/animations/pages/page-transition.tsx). */
const MAIN = 'main#main-content';
/** A cover served by the Sanity image CDN, which is where every book cover now lives. */
const SANITY_COVER = 'img[src^="https://cdn.sanity.io/images/"]';
/** What /bookshelf says when its catalog has no book (bookshelf/(list)/page.tsx). */
const EMPTY_TEXT = 'No books yet';
const SHELF_LINK = `${MAIN} a[href^="/bookshelf/shelf/"]`;
/** The live region naming the book on stage, "<stage> of <count>: <title>" (bookshelf-stage.tsx). */
const ON_STAGE = `${MAIN} p[aria-live="polite"]`;
const ON_STAGE_TEXT = /^\d+ of \d+: (.+)$/s;
const MISSING_PAGES = ['/bookshelf/does-not-exist', '/bookshelf/shelf/does-not-exist'] as const;

/** A book as /api/v1/sanity/books serves it: the raw projection, so every field is optional. */
interface ApiBook {
  readonly title?: string;
  readonly slug?: { readonly current?: string } | null;
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

/**
 * Opens /bookshelf and waits for its h1. `isEmpty` is true when it shows its empty state: no book
 * is in its catalog, whatever the books JSON lists.
 */
async function openBookshelf(
  page: Page,
): Promise<{ readonly status?: number; readonly isEmpty: boolean }> {
  const response = await page.goto(urlOf('/bookshelf'));
  const main = page.locator(MAIN);
  await expect(main).toHaveCount(1);
  await expect(
    main.getByRole('heading', { level: 1, name: 'Bookshelf', exact: true }),
  ).toBeVisible();
  const isEmpty = (await main.getByText(EMPTY_TEXT, { exact: true }).count()) > 0;
  return { status: response?.status(), isEmpty };
}

/**
 * The book /bookshelf puts on stage first (so one its catalog holds), with its slug from the books
 * JSON, or null when /bookshelf shows its empty state.
 */
async function bookOnStage(
  page: Page,
  request: APIRequestContext,
): Promise<{ readonly slug: string; readonly title: string } | null> {
  const { isEmpty } = await openBookshelf(page);
  if (isEmpty) return null;
  const onStage = page.locator(ON_STAGE);
  await expect(onStage).toHaveText(ON_STAGE_TEXT);
  const title = ON_STAGE_TEXT.exec(((await onStage.textContent()) ?? '').trim())?.[1]?.trim() ?? '';
  const slug = (await publishedBooks(request)).find((book) => book.title === title)?.slug?.current;
  expect(slug, `the books JSON gives the slug of "${title}"`).toEqual(expect.any(String));
  return { slug: slug ?? '', title };
}

test.describe('the bookshelf against the live data', () => {
  test('/bookshelf answers 200 with its h1 and covers from Sanity', async ({ page }) => {
    const { status, isEmpty } = await openBookshelf(page);

    expect(status).toBe(200);
    const main = page.locator(MAIN);
    if (isEmpty) {
      await expect(main.getByText(EMPTY_TEXT, { exact: true })).toBeVisible();
      await expect(main.locator(SANITY_COVER)).toHaveCount(0);
      return;
    }
    await expect(main.locator(SANITY_COVER).first()).toBeAttached();
    await expect(page.locator(ON_STAGE)).toHaveText(ON_STAGE_TEXT);
  });

  test('the page of the book on stage answers 200 with its title and its Sanity cover', async ({
    page,
    request,
  }) => {
    const book = await bookOnStage(page, request);
    test.skip(book === null, 'no book is in the rendered catalog');
    if (!book) return;

    const response = await page.goto(urlOf(`/bookshelf/${encodeURIComponent(book.slug)}`));

    expect(response?.status()).toBe(200);
    const main = page.locator(MAIN);
    await expect(main.getByRole('heading', { level: 1 })).toContainText(book.title);
    await expect(main.locator(SANITY_COVER).first()).toBeVisible();
  });

  test('a shelf link on /bookshelf opens a shelf page that answers 200', async ({ page }) => {
    const { isEmpty } = await openBookshelf(page);
    test.skip(isEmpty, 'no book is in the rendered catalog');
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
