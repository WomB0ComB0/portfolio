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
 * @file The open view of a photo on /places/photos, against the live data, at the windows where
 * it used to overflow (WCAG 1.4.4, 1.4.10, 2.4.11):
 * - At laptop heights, at 200% and 400% zoom (640x360, 320x256) and on a landscape phone
 *   (844x390), the panel stays inside the window, the photo is never squeezed to nothing, the
 *   name never runs into "Open place", and "Open place" is on screen once focused. Each window
 *   is checked with the opened photo's own shape, then with very tall (0.3, 0.45) and wide (1.5)
 *   shapes set on the panel, and a long name.
 * - Crossing the phone layout while open (rotating, zooming) keeps focus in the dialog, on the
 *   button now shown.
 * - Forced colours (Windows High Contrast) still mark the pressed Wall/Grid option and the
 *   current "Places | Photos" view.
 * GET only, on the built server (localhost:3109); nothing signs in or writes.
 */

import { expect, type Locator, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import { hydrated, settle, type Viewport, WIDE } from '../fixtures/places';

const PHOTOS_PATH = '/places/photos';
const GRID = 'ul[aria-label="Photos"]';
const DIALOG = '[data-photo-dialog]';
/** A name long enough to wrap in a narrow caption. */
const LONG_NAME = 'A long place name: the New York City Hackathon Weekend 2025';
/** The photo shapes forced onto the panel: very tall, tall and wide. */
const RATIOS = [null, 0.3, 0.45, 1.5] as const;
const FIT_WINDOWS: readonly Viewport[] = [
  { width: 1440, height: 900 },
  { width: 1366, height: 657 },
  { width: 1280, height: 720 },
  { width: 1024, height: 600 },
  { width: 800, height: 600 },
  // 1280x720 at 200%, a landscape phone, 1280x1024 at 400%.
  { width: 640, height: 360 },
  { width: 844, height: 390 },
  { width: 320, height: 256 },
];
/** Rounding slack, in CSS px. */
const SLACK = 0.5;

interface Fit {
  readonly panel: DOMRect;
  readonly frame: DOMRect;
  readonly title: DOMRect;
  readonly link: DOMRect;
}

/** Opens /places/photos at `viewport`, switches to the grid, and opens its first photo. */
async function openFirstPhoto(page: Page, viewport: Viewport): Promise<Locator> {
  await page.setViewportSize(viewport);
  await page.goto(`${getTargetUrl()}${PHOTOS_PATH}`);
  const main = await settle(page);
  await hydrated(page);
  const grid = main.getByRole('button', { name: 'Grid' });
  if ((await grid.count()) > 0) {
    await expect(async () => {
      await grid.click();
      await expect(grid).toHaveAttribute('aria-pressed', 'true', { timeout: 1_000 });
    }).toPass();
  }
  await main.locator(`${GRID} a`).first().click();
  const dialog = page.locator(DIALOG);
  await expect(dialog).toBeVisible();
  await landed(dialog);
  return dialog;
}

/** Waits for the photo's flight to land: its frame no longer transformed. */
async function landed(dialog: Locator): Promise<void> {
  const frame = dialog.locator('[data-photo-frame]');
  await expect
    .poll(() => frame.evaluate((element) => getComputedStyle(element).transform))
    .toMatch(/^(?:none|matrix\(1, 0, 0, 1, 0, 0\))$/);
}

/** Two frames, so a style change has been laid out. */
const nextFrames = (page: Page): Promise<unknown> =>
  page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );

/** The panel, frame, title and "Open place" boxes. */
const measure = (dialog: Locator): Promise<Fit> =>
  dialog.evaluate((panel) => {
    const box = (selector: string): DOMRect =>
      panel.querySelector(selector)?.getBoundingClientRect().toJSON() ?? new DOMRect().toJSON();
    return {
      panel: panel.getBoundingClientRect().toJSON(),
      frame: box('[data-photo-frame]'),
      title: box('h2'),
      link: box('a[href^="/places/"]'),
    };
  });

/** Whether two boxes overlap by more than the slack. */
const overlaps = (a: DOMRect, b: DOMRect): boolean =>
  a.left < b.right - SLACK &&
  b.left < a.right - SLACK &&
  a.top < b.bottom - SLACK &&
  b.top < a.bottom - SLACK;

/** Checks the panel is inside the window, the photo has a size, and the name clears the link. */
function expectFits(fit: Fit, viewport: Viewport, label: string): void {
  expect(fit.panel.left, `${label}: panel left`).toBeGreaterThanOrEqual(-SLACK);
  expect(fit.panel.top, `${label}: panel top`).toBeGreaterThanOrEqual(-SLACK);
  expect(fit.panel.right, `${label}: panel right`).toBeLessThanOrEqual(viewport.width + SLACK);
  expect(fit.panel.bottom, `${label}: panel bottom`).toBeLessThanOrEqual(viewport.height + SLACK);
  expect(fit.frame.height, `${label}: photo height`).toBeGreaterThan(40);
  expect(fit.frame.width, `${label}: photo width`).toBeGreaterThan(40);
  expect(overlaps(fit.title, fit.link), `${label}: name runs into Open place`).toBe(false);
}

test.describe('the open photo fits the window', () => {
  for (const viewport of FIT_WINDOWS) {
    test(`${viewport.width}x${viewport.height}`, async ({ page }) => {
      const dialog = await openFirstPhoto(page, viewport);
      await dialog.locator('h2').evaluate((title, name) => {
        title.textContent = name;
      }, LONG_NAME);

      for (const ratio of RATIOS) {
        const label = ratio === null ? 'its own shape' : `ratio ${ratio}`;
        if (ratio !== null) {
          await dialog.evaluate((panel, value) => {
            panel.style.setProperty('--ratio', value);
          }, String(ratio));
        }
        await nextFrames(page);
        expectFits(await measure(dialog), viewport, label);
      }

      // Open place, reached by the keyboard, is on screen (the caption scrolls to it).
      await page.keyboard.press('Shift+Tab');
      const link = dialog.getByRole('link', { name: 'Open place' });
      await expect(link).toBeFocused();
      await nextFrames(page);
      const box = await link.boundingBox();
      if (!box) throw new Error('no Open place box');
      expect(box.y).toBeGreaterThanOrEqual(-SLACK);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + SLACK);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + SLACK);
    });
  }
});

test.describe('the open photo across the phone layout', () => {
  test('rotating to a phone and back keeps focus in the dialog, on the button shown', async ({
    page,
  }) => {
    const dialog = await openFirstPhoto(page, WIDE);
    const close = dialog.getByRole('button', { name: 'Close' });
    const done = dialog.getByRole('button', { name: 'Done' });
    await expect(close).toBeFocused();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(done).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((panel) => panel.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Shift+Tab');
    await expect(done).toBeFocused();

    await page.setViewportSize(WIDE);
    await expect(close).toBeFocused();

    // Focus on a part both layouts show (Open place) stays where it is.
    const link = dialog.getByRole('link', { name: 'Open place' });
    await page.keyboard.press('Shift+Tab');
    await expect(link).toBeFocused();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(done).toBeVisible();
    await expect(link).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
});

test.describe('forced colours', () => {
  test.use({ viewport: WIDE });

  test('the pressed option and the current view stand out from the others', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto(`${getTargetUrl()}${PHOTOS_PATH}`);
    const main = await settle(page);
    await hydrated(page);
    const background = (locator: Locator) =>
      locator.evaluate((element) => getComputedStyle(element).backgroundColor);
    const nav = main.getByRole('navigation', { name: 'Places views' });
    const current = nav.getByRole('link', { name: 'Photos' });
    const other = nav.getByRole('link', { name: 'Places' });
    await expect(current).toHaveAttribute('aria-current', 'page');
    expect(await background(current)).not.toBe(await background(other));

    const wall = main.getByRole('button', { name: 'Wall' });
    test.skip((await wall.count()) === 0, 'fewer than 12 photos: no switch');
    const grid = main.getByRole('button', { name: 'Grid' });
    const pressed = (await wall.getAttribute('aria-pressed')) === 'true' ? wall : grid;
    const unpressed = pressed === wall ? grid : wall;
    expect(await background(pressed)).not.toBe(await background(unpressed));
    expect(await unpressed.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe(
      '1px',
    );
  });
});
