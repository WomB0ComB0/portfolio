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
 * @file What the /bookshelf browser checks share: the page's selectors (its main, the 3D stage,
 * the live region naming the book on stage, the 'Shelves' chip group and the empty state), the
 * phone, tablet and desktop contexts, the public books JSON, and opening /bookshelf: once its
 * h1 is up (whether it shows books or its empty state), or, for the budgets, once the network is
 * idle with a book on stage. Used by e2e/journeys/bookshelf.spec.ts,
 * e2e/performance/bookshelf-budgets.spec.ts and e2e/visual/bookshelf-chips.spec.ts. Every helper
 * only reads.
 */

import {
  type APIRequestContext,
  type BrowserContextOptions,
  expect,
  type Page,
} from '@playwright/test';

import { getTargetUrl } from './base';

export const PATH = '/bookshelf';
/** The shell's one `<main>` (src/components/animations/pages/page-transition.tsx). */
export const MAIN = 'main#main-content';
/** The 3D stage (bookshelf-stage.tsx). */
export const STAGE = `${MAIN} [role="region"][aria-roledescription="carousel"]`;
/** The live region naming the book on stage, "<stage> of <count>: <title>" (bookshelf-stage.tsx). */
export const LIVE = `${MAIN} p[aria-live="polite"]`;
export const LIVE_TEXT = /^(\d+) of (\d+): /;
/**
 * The shelf chips: toggle buttons in the 'Shelves' group, "All" first (bookshelf-filters-bar.tsx).
 * Their parent row holds the reading-status chips too.
 */
export const SHELF_GROUP = `${MAIN} [role="group"][aria-label="Shelves"]`;
/** What /bookshelf says when its catalog has no book (bookshelf/(list)/page.tsx). */
export const EMPTY_TEXT = 'No books yet';

export const desktop = (deviceScaleFactor: number): BrowserContextOptions => ({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor,
  isMobile: false,
  hasTouch: false,
});
export const phone = (height: number): BrowserContextOptions => ({
  viewport: { width: 375, height },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
export const tablet: BrowserContextOptions = {
  viewport: { width: 768, height: 1024 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

/** A book as /api/v1/sanity/books serves it: the raw projection, so every field is optional. */
export interface ApiBook {
  readonly title?: string;
  readonly slug?: { readonly current?: string } | null;
  readonly shelfId?: string | null;
}

/** The published books, in the API's order (shelf position first, then creation). */
export async function publishedBooks(request: APIRequestContext): Promise<readonly ApiBook[]> {
  const response = await request.get(`${getTargetUrl()}/api/v1/sanity/books`);
  expect(response.ok(), 'GET /api/v1/sanity/books').toBe(true);
  const body: unknown = await response.json();
  expect(Array.isArray(body), 'the books JSON is a list').toBe(true);
  return body as ApiBook[];
}

/**
 * Opens /bookshelf and waits for its h1. `isEmpty` is true when it shows its empty state: no book
 * is in its catalog, whatever the books JSON lists.
 */
export async function openBookshelf(
  page: Page,
): Promise<{ readonly status?: number; readonly isEmpty: boolean }> {
  const response = await page.goto(`${getTargetUrl()}${PATH}`);
  const main = page.locator(MAIN);
  await expect(main).toHaveCount(1);
  await expect(
    main.getByRole('heading', { level: 1, name: 'Bookshelf', exact: true }),
  ).toBeVisible();
  const isEmpty = (await main.getByText(EMPTY_TEXT, { exact: true }).count()) > 0;
  return { status: response?.status(), isEmpty };
}

/**
 * Loads `path` (/bookshelf or a shelf's page) from `origin` until the network is idle, with the
 * stage's live readout naming a book.
 */
export async function openStage(page: Page, origin: string, path: string = PATH): Promise<void> {
  const response = await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
  expect(response?.status(), `GET ${path}`).toBe(200);
  await expect(page.locator(LIVE)).toHaveText(LIVE_TEXT);
}
