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
 * @file /bookshelf's filter chips, as screenshots for review: the 'Shelves' chip group and the
 * reading-status chips above the stage, at 320, 768, 1024 and 1440 px, under reduced motion, once
 * the fonts have loaded and the pill sits on the current chip. Below 48rem the shelf chips keep
 * to one row that scrolls sideways and fades over its end; at 320 px a second screenshot shows
 * the row once its last chip is chosen (scrolled to its end, the fade over its start). The site
 * is dark-only (globals.css: `color-scheme: dark`), so there is one theme to take.
 *
 * Baselines, as in homepage.spec.ts: none is committed yet, and a toHaveScreenshot with no
 * baseline fails (and writes one), so each screenshot is attached to the report for review until
 * its baseline exists, and compared once it does. Create or refresh them on purpose:
 *
 *   UPDATE_VISUAL_BASELINES=1 bunx playwright test e2e/visual/bookshelf-chips.spec.ts \
 *     --project=chromium --update-snapshots
 *
 * The chips' titles and counts are the live catalog's, so a baseline holds only for the data it
 * was taken with. The layout checks (the row's height, the stage's top, the pill's transition,
 * the chosen chip kept in view) are in e2e/performance/bookshelf-budgets.spec.ts.
 *
 * The browser aborts every request that is not GET or HEAD, and service workers are blocked.
 */

import { existsSync } from 'node:fs';
import { expect, type Locator, type Page, type TestInfo, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import { readOnly } from '../fixtures/console-routes';

const WIDTHS = [320, 768, 1024, 1440] as const;
const HEIGHT = 900;
const MAIN = 'main#main-content';
/** The shelf chips (bookshelf-filters-bar.tsx); their parent row holds the status chips too. */
const SHELF_GROUP = `${MAIN} [role="group"][aria-label="Shelves"]`;
/** What /bookshelf says when its catalog has no book (bookshelf/(list)/page.tsx). */
const EMPTY_TEXT = 'No books yet';

const UPDATE_BASELINES = process.env.UPDATE_VISUAL_BASELINES === '1';

/** Compare when asked to (creating baselines), or when this screenshot already has a baseline. */
const shouldCompare = (testInfo: TestInfo, name: string): boolean =>
  UPDATE_BASELINES || existsSync(testInfo.snapshotPath(name, { kind: 'screenshot' }));

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => readOnly(page));

/**
 * Opens /bookshelf at `width` under reduced motion and returns its shelf chip group once the
 * fonts are in and two frames have passed, so the pill has measured; null when /bookshelf shows
 * its empty state (no chips).
 */
async function openChips(page: Page, width: number): Promise<Locator | null> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width, height: HEIGHT });
  const response = await page.goto(`${getTargetUrl()}/bookshelf`);
  expect(response?.status()).toBe(200);
  const main = page.locator(MAIN);
  await expect(
    main.getByRole('heading', { level: 1, name: 'Bookshelf', exact: true }),
  ).toBeVisible();
  if ((await main.getByText(EMPTY_TEXT, { exact: true }).count()) > 0) return null;
  const group = page.locator(SHELF_GROUP);
  await expect(group).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  return group;
}

/** Screenshots `target`: compared with its baseline when one exists, else attached for review. */
async function snap(testInfo: TestInfo, target: Locator, name: string): Promise<void> {
  const options = { animations: 'disabled' as const, scale: 'css' as const };
  if (shouldCompare(testInfo, name)) {
    await expect(target).toHaveScreenshot(name, options);
  } else {
    await testInfo.attach(name, {
      body: await target.screenshot(options),
      contentType: 'image/png',
    });
  }
}

test.describe('bookshelf filter chips', () => {
  for (const width of WIDTHS) {
    test(`${width} px: the shelf and reading-status chips`, async ({ page }, testInfo) => {
      const group = await openChips(page, width);
      test.skip(group === null, 'no book is in the rendered catalog');
      if (!group) return;

      await snap(testInfo, group.locator('xpath=..'), `bookshelf-chips-${width}.png`);
    });
  }

  test('320 px: the shelf chip row scrolled to its chosen last chip', async ({
    page,
  }, testInfo) => {
    const group = await openChips(page, 320);
    test.skip(group === null, 'no book is in the rendered catalog');
    if (!group) return;
    const last = group.getByRole('button').last();

    // A DOM click: Playwright's own click would first scroll the chip into view itself.
    await last.evaluate((chip) => (chip as HTMLElement).click());
    await expect(last).toHaveAttribute('aria-pressed', 'true');
    await expect(group).toHaveAttribute('data-overflow', /^(start|both)$/);

    await snap(testInfo, group, 'bookshelf-chips-320-last.png');
  });
});
