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
 * @file The home page's visual checks:
 * - it answers 200, with the site's title and a responsive viewport meta;
 * - at 375, 768, 1024 and 1440 px, under reduced motion and once every tile has loaded, a
 *   screenshot of the whole page with what changes on its own masked: the live now playing,
 *   status and GitHub slots and the footer's status badge, and what the server words relative to
 *   now: the text marked data-dated (the last place's when line) and any stale
 *   tile's 'as of …' line (LeetCode, typing).
 *
 * Baselines: the repository commits none yet, and a toHaveScreenshot with no baseline fails (and
 * writes one). So by default each screenshot is attached to the test report for review, not
 * compared. A screenshot is compared with toHaveScreenshot when its baseline file exists, or when
 * UPDATE_VISUAL_BASELINES=1 is set, which is how baselines are created or refreshed on purpose:
 *
 *   UPDATE_VISUAL_BASELINES=1 bunx playwright test e2e/visual/homepage.spec.ts \
 *     --project=chromium --update-snapshots
 *
 * Baselines are per browser project and platform (Playwright's default snapshot path, under
 * e2e/visual/homepage.spec.ts-snapshots/). The unmasked tiles (LeetCode, typing, the featured
 * project, the roles and the site index) change whenever their data does, and every tile changes
 * with the design tokens: review the diff before committing new baselines. page.clock cannot pin
 * the dated text: the server words it, so it is masked instead.
 *
 * The behaviour checks (layout at each width, links, keyboard, motion, console, no-JavaScript
 * HTML) live in e2e/journeys/home-bento.spec.ts.
 */

import { existsSync } from 'node:fs';
import { expect, type Locator, type Page, type TestInfo, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';

/** The shell's one `<main>` (src/components/animations/pages/page-transition.tsx). */
const MAIN = 'main#main-content';

const SLOT = '[data-bento-slot]';
const SLOT_COUNT = 10;

/** A tile still loading (its skeleton) marks itself busy. */
const BUSY = '[aria-busy="true"]';

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

/** Slots whose content changes from one load to the next. */
const LIVE_SLOTS = ['now', 'status', 'gh'] as const;

/**
 * Text the server words from today's date, so it changes from one day to the next with no new
 * data (TileMeta's `dated`): the last place's line with the relative day ('yesterday', '6 d ago')
 * and the date, which gains the year once the year turns (place-tile.tsx). The rest of the place
 * tile, its 'Last place' label included, is compared.
 * Each is a flex item of its tile, so its box spans the tile whatever its words.
 */
const DATED_TEXT = '[data-dated]';

/**
 * A stale tile's 'as of Nov 5 11:02 AM ET' (asOfText in tiles/tile-states.tsx): the LeetCode and
 * typing meta line, worded from the load time and today's date. Matches the line, wherever it is.
 */
const AS_OF_LINE = /\bas of\b/;

/** The footer's StatusBadge links here; its dot's colour is live too. */
const STATUS_PAGE_URL = 'https://status.mikeodnis.dev';

const UPDATE_BASELINES = process.env.UPDATE_VISUAL_BASELINES === '1';

/** Compare when asked to (creating baselines), or when this screenshot already has a baseline. */
const shouldCompare = (testInfo: TestInfo, name: string): boolean =>
  UPDATE_BASELINES || existsSync(testInfo.snapshotPath(name, { kind: 'screenshot' }));

/** What the screenshots mask: everything live, or worded relative to now. */
const liveContent = (page: Page): Locator[] => [
  ...LIVE_SLOTS.map((area) => page.locator(`[data-bento-slot="${area}"]`)),
  page.locator(MAIN).locator(SLOT).locator(DATED_TEXT),
  page.locator(MAIN).locator(SLOT).getByText(AS_OF_LINE),
  page.getByRole('contentinfo').locator(`a[href="${STATUS_PAGE_URL}"]`),
];

/**
 * Waits for what a screenshot shows to stop changing: every tile loaded (no skeleton left), every
 * image decoded, below the fold too (lazy images load now rather than mid-capture), and the fonts.
 * An image that fails to load is left as it is: the screenshot then shows it for review.
 */
async function settle(page: Page): Promise<void> {
  const main = page.locator(MAIN);
  await expect(main.locator(SLOT)).toHaveCount(SLOT_COUNT);
  await expect(main.locator(`${SLOT} ${BUSY}`)).toHaveCount(0);
  await page.evaluate(async () => {
    const images = [...document.images];
    for (const image of images) image.loading = 'eager';
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    await document.fonts.ready;
  });
}

test.describe('home page basics', () => {
  test('answers 200', async ({ page }) => {
    const response = await page.goto(getTargetUrl());

    expect(response?.status()).toBe(200);
  });

  test("has the site's title", async ({ page }) => {
    await page.goto(getTargetUrl());

    await expect(page).toHaveTitle(/Mike Odnis|Portfolio/i);
  });

  test('declares a responsive viewport', async ({ page }) => {
    await page.goto(getTargetUrl());

    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      'content',
      /width=device-width/,
    );
  });
});

test.describe('home page screenshots', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.width} px: the whole page, live content masked`, async ({
      page,
    }, testInfo) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize(viewport);
      await page.goto(getTargetUrl());
      await settle(page);

      const name = `home-${viewport.width}.png`;
      const options = {
        fullPage: true,
        mask: liveContent(page),
        animations: 'disabled' as const,
        scale: 'css' as const,
      };
      if (shouldCompare(testInfo, name)) {
        await expect(page).toHaveScreenshot(name, options);
      } else {
        const body = await page.screenshot(options);
        await testInfo.attach(name, { body, contentType: 'image/png' });
      }
    });
  }
});
