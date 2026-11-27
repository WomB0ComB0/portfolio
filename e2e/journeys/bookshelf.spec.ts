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
 * - The reading map, on /bookshelf and on a book's page, is a modal dialog: opened from the
 *   keyboard, focus stays inside it, the page behind is hidden and holds still, and Escape or a
 *   click outside closes it with focus back on its button. Over a book's in-page detail, Escape
 *   closes only the map. Its Open stage opens that book's detail in place, with focus on the
 *   detail's heading.
 *
 * The browser aborts every request that is not GET or HEAD, and service workers are blocked.
 */

import { type APIRequestContext, expect, type Locator, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import { EMPTY_TEXT, LIVE, MAIN, openBookshelf, publishedBooks } from '../fixtures/bookshelf';
import { readOnly } from '../fixtures/console-routes';

/** A cover served by the Sanity image CDN, which is where every book cover now lives. */
const SANITY_COVER = 'img[src^="https://cdn.sanity.io/images/"]';
const SHELF_LINK = `${MAIN} a[href^="/bookshelf/shelf/"]`;
/** The live region's text, capturing the title of the book on stage. */
const ON_STAGE_TEXT = /^\d+ of \d+: (.+)$/s;
const MISSING_PAGES = ['/bookshelf/does-not-exist', '/bookshelf/shelf/does-not-exist'] as const;

const urlOf = (path: string): string => `${getTargetUrl()}${path}`;

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => readOnly(page));

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
  const onStage = page.locator(LIVE);
  await expect(onStage).toHaveText(ON_STAGE_TEXT);
  const title = ON_STAGE_TEXT.exec(((await onStage.textContent()) ?? '').trim())?.[1]?.trim() ?? '';
  const slug = (await publishedBooks(request)).find((book) => book.title === title)?.slug?.current;
  expect(slug, `the books JSON gives the slug of "${title}"`).toEqual(expect.any(String));
  return { slug: slug ?? '', title };
}

/** The 'Reading map' button, found even while the open map hides the page from assistive tech. */
const mapButton = (page: Page): Locator =>
  page.locator(MAIN).getByRole('button', { name: 'Reading map', exact: true, includeHidden: true });

/** Whether focus is inside `locator`'s element. */
const holdsFocus = (locator: Locator): Promise<boolean> =>
  locator.evaluate((element) => element.contains(document.activeElement));

/**
 * Focuses the 'Reading map' button as the keyboard would and presses Enter: the map appears once
 * its lazily loaded code arrives.
 */
async function openReadingMap(page: Page): Promise<{ trigger: Locator; dialog: Locator }> {
  const trigger = mapButton(page);
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Reading map' });
  await expect(dialog).toBeVisible();
  return { trigger, dialog };
}

/**
 * The map is the site's modal dialog: focus starts inside and Tab and Shift+Tab keep it there,
 * the page behind is hidden from assistive technology and its scroll is locked, Escape closes it
 * and focus goes back to its button, and so does a click outside it.
 */
async function expectModalReadingMap(page: Page): Promise<void> {
  const { trigger, dialog } = await openReadingMap(page);
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(await holdsFocus(dialog), 'focus starts inside the map').toBe(true);
  for (const key of ['Shift+Tab', 'Tab', 'Tab', 'Tab']) {
    await page.keyboard.press(key);
    expect(await holdsFocus(dialog), `focus after ${key}`).toBe(true);
  }
  expect(
    await trigger.evaluate((button) => Boolean(button.closest('[aria-hidden="true"]'))),
    'the page behind is hidden from assistive technology',
  ).toBe(true);
  await expect(page.locator('body')).toHaveAttribute('data-scroll-locked', /.*/);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect.poll(() => holdsFocus(trigger), 'focus back on Reading map').toBe(true);
  await expect(page.locator('body')).not.toHaveAttribute('data-scroll-locked', /.*/);

  await trigger.click();
  await expect(dialog).toBeVisible();
  // Radix arms its click-outside listener on a zero-delay timer after the dialog opens, and a busy
  // page can take the click first: wait out one such timer, queued after Radix's.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  // The top-left corner is outside the panel, whose frame keeps at least 1rem from every edge.
  await page.mouse.click(4, 4);
  await expect(dialog).toBeHidden();
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
    await expect(page.locator(LIVE)).toHaveText(ON_STAGE_TEXT);
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

  test('the reading map on /bookshelf is a modal dialog that gives focus back', async ({
    page,
  }) => {
    const { isEmpty } = await openBookshelf(page);
    test.skip(isEmpty, 'no book is in the rendered catalog');

    await expectModalReadingMap(page);
  });

  test("the reading map on the book on stage's page is a modal dialog too", async ({
    page,
    request,
  }) => {
    const book = await bookOnStage(page, request);
    test.skip(book === null, 'no book is in the rendered catalog');
    if (!book) return;
    await page.goto(urlOf(`/bookshelf/${encodeURIComponent(book.slug)}`));
    await expect(page.locator(MAIN).getByRole('heading', { level: 1 })).toContainText(book.title);

    await expectModalReadingMap(page);
  });

  test("Escape on the reading map over a book's in-page detail closes only the map", async ({
    page,
  }) => {
    const { isEmpty } = await openBookshelf(page);
    test.skip(isEmpty, 'no book is in the rendered catalog');
    const main = page.locator(MAIN);
    await expect(page.locator(LIVE)).toHaveText(ON_STAGE_TEXT);
    const title = ON_STAGE_TEXT.exec(((await page.locator(LIVE).textContent()) ?? '').trim())?.[1];
    await main.getByRole('button', { name: /^Open notes/ }).click();
    const heading = main.getByRole('heading', { level: 1 });
    await expect(heading).toHaveText(title?.trim() ?? '');

    const { dialog } = await openReadingMap(page);
    await page.keyboard.press('Escape');

    await expect(dialog).toBeHidden();
    await expect(heading).toHaveText(title?.trim() ?? '');
  });

  test("Open stage on the reading map opens the book's detail with focus on its heading", async ({
    page,
  }) => {
    const { isEmpty } = await openBookshelf(page);
    test.skip(isEmpty, 'no book is in the rendered catalog');
    const { dialog } = await openReadingMap(page);
    // The map's entries, in stage order: the first entry's title and its Open stage button.
    const title = (await dialog.getByRole('heading', { level: 4 }).first().textContent()) ?? '';
    await dialog.getByRole('button', { name: 'Open stage' }).first().focus();
    await page.keyboard.press('Enter');

    await expect(dialog).toBeHidden();
    const heading = page.locator(MAIN).getByRole('heading', { level: 1 });
    await expect(heading).toHaveText(title.trim());
    await expect(heading).toBeFocused();
  });

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
