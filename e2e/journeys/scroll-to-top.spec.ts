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

/** Shared control against real routes: no mutations, sign-in or external player actions. */
import { expect, type Page, test } from '@playwright/test';
import { openConsolePage, readOnly } from '../fixtures/console-routes';
import { hydrated, settle } from '../fixtures/ledger';

const MAIN = 'main#main-content';
const PROJECTS = '/projects';
const PROFILES = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
] as const;
const control = (page: Page) => page.getByRole('button', { name: 'Back to top', exact: true });
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

async function openProjects(page: Page, query = ''): Promise<void> {
  await openConsolePage(page, `${PROJECTS}${query}`, 'Projects');
  await settle(page);
  await hydrated(page);
}

async function scrollTo(page: Page, top: number): Promise<void> {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);
  await expect.poll(() => scrollY(page)).toBe(top);
}

async function reveal(page: Page): Promise<void> {
  await scrollTo(page, 500);
  await expect(control(page)).toBeVisible();
}

/** Real client navigation exercises the persistent shell and App Router's history state. */
async function navigateToPrivacy(page: Page, mobile: boolean): Promise<void> {
  if (mobile) {
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    await page.getByRole('dialog').locator('a[href="/privacy"]').click();
  } else {
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await nav.getByRole('button', { name: 'Legal section' }).click();
    await nav.locator('a[href="/privacy"]').click();
  }
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.locator(`${MAIN} h1`)).toBeVisible();
}

for (const profile of PROFILES) {
  test.describe(`scroll-to-top: ${profile.name}`, () => {
    test.use({ viewport: profile.viewport, hasTouch: profile.mobile, serviceWorkers: 'block' });
    test.beforeEach(async ({ page }) => readOnly(page));

    test('appears after the capped threshold inside the page column and clear of navigation', async ({
      page,
    }) => {
      await openProjects(page);
      await expect(control(page)).toHaveCount(0);
      const threshold = Math.min(320, profile.viewport.height / 2);
      await scrollTo(page, threshold - 1);
      await expect(control(page)).toHaveCount(0);
      await scrollTo(page, threshold);
      await expect(control(page)).toBeVisible();
      const box = await control(page).boundingBox();
      const main = await page.locator(MAIN).boundingBox();
      if (!box || !main) throw new Error('missing control or main box');
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(main.x);
      expect(box.x + box.width).toBeLessThanOrEqual(main.x + main.width);
      expect(box.y + box.height).toBeLessThan(profile.viewport.height);
      if (profile.mobile) {
        const bar = await page.getByRole('navigation', { name: 'Mobile navigation' }).boundingBox();
        if (!bar) throw new Error('missing mobile navigation');
        expect(bar.y - box.y - box.height).toBeGreaterThanOrEqual(8);
      }
      await scrollTo(page, 0);
      await expect(control(page)).toHaveCount(0);
    });

    test('stays visible above the footer at the bottom without covering its status or links', async ({
      page,
    }) => {
      await openProjects(page);
      await page.evaluate(() =>
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
      );
      await expect(control(page)).toBeVisible();
      await expect
        .poll(async () => {
          const button = await control(page).boundingBox();
          const footer = await page.getByRole('contentinfo').boundingBox();
          if (!button || !footer) throw new Error('missing control or footer box');
          return footer.y - button.y - button.height;
        })
        .toBeGreaterThanOrEqual(8);
      const box = await control(page).boundingBox();
      if (!box) throw new Error('missing control box');
      expect(box.y).toBeGreaterThanOrEqual(0);
      if (profile.mobile) {
        const bar = await page.getByRole('navigation', { name: 'Mobile navigation' }).boundingBox();
        if (!bar) throw new Error('missing mobile navigation');
        expect(bar.y - box.y - box.height).toBeGreaterThanOrEqual(8);
      }
    });

    test('keyboard activation keeps filters and router history, clears only the hash, and focuses main', async ({
      page,
    }) => {
      await openProjects(page, '?q=a');
      await expect(page.getByRole('searchbox')).toHaveValue('a');
      await reveal(page);
      const before = await page.evaluate(() => {
        history.replaceState(
          { ...history.state, scrollTopMarker: 'kept' },
          '',
          `${location.pathname}${location.search}#scroll-top-check`,
        );
        return { query: location.search, state: history.state, length: history.length };
      });
      await control(page).focus();
      await expect(control(page)).toBeFocused();
      await page.keyboard.press('Enter');
      await expect.poll(() => scrollY(page)).toBe(0);
      await expect(page.locator(MAIN)).toBeFocused();
      await expect(control(page)).toHaveCount(0);
      const after = await page.evaluate(() => ({
        query: location.search,
        hash: location.hash,
        state: history.state,
        length: history.length,
      }));
      expect(after).toEqual({ ...before, hash: '' });
      await expect(page.getByRole('searchbox')).toHaveValue('a');
      await navigateToPrivacy(page, profile.mobile);
      await page.goBack();
      await expect(page).toHaveURL(/\/projects\?q=a$/);
      await expect(
        page.locator(MAIN).getByRole('heading', { level: 1, name: 'Projects', exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('searchbox')).toHaveValue('a');
    });

    test('a click under reduced motion reaches the top immediately and focuses main', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openProjects(page);
      await reveal(page);
      // Runs after React's root click handler but in the same event: a smooth journey would not
      // have reached the top yet. It observes the real scroll, without replacing a browser API.
      await page.evaluate(() => {
        document.addEventListener(
          'click',
          () => {
            (window as Window & { scrollTopClickY?: number }).scrollTopClickY = window.scrollY;
          },
          { once: true },
        );
      });
      await control(page).click();
      expect(
        await page.evaluate(
          () => (window as Window & { scrollTopClickY?: number }).scrollTopClickY,
        ),
      ).toBe(0);
      await expect(page.locator(MAIN)).toBeFocused();
      await expect(control(page)).toHaveCount(0);
    });

    test('hides while the command palette is open and restores after Escape', async ({ page }) => {
      await openProjects(page);
      await reveal(page);
      await page.keyboard.press('Control+k');
      const search = page.getByRole('combobox');
      await expect(search).toHaveAttribute('aria-expanded', 'true');
      await expect(control(page)).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(search).toHaveCount(0);
      await expect(control(page)).toBeVisible();
    });

    test('recalculates on client route changes without leaving a stale visible control', async ({
      page,
    }) => {
      await openProjects(page);
      await reveal(page);
      await navigateToPrivacy(page, profile.mobile);
      await expect.poll(() => scrollY(page)).toBe(0);
      await expect(control(page)).toHaveCount(0);
      await scrollTo(page, 500);
      await expect(control(page)).toBeVisible();
    });

    if (profile.mobile) {
      test('hides behind the native Filters sheet and returns when it closes', async ({ page }) => {
        await openProjects(page);
        await page
          .locator('main [data-filter-part="chips"][data-pill="on"]')
          .first()
          .waitFor({ state: 'attached' });
        await reveal(page);
        // A locator click first scrolls this pinned button into the page's scroll padding.
        // Tap its visible position, as a phone visitor does, keeping the scrolled precondition.
        const filters = await page.locator('main [data-filter-part="filters"]').boundingBox();
        if (!filters) throw new Error('missing Filters button');
        await page.touchscreen.tap(filters.x + filters.width / 2, filters.y + filters.height / 2);
        await expect.poll(() => scrollY(page)).toBe(500);
        const sheet = page.locator('main [data-filter-part="sheet"]');
        await expect
          .poll(() => sheet.evaluate((element) => element.matches(':popover-open')))
          .toBe(true);
        await expect(control(page)).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect
          .poll(() => sheet.evaluate((element) => element.matches(':popover-open')))
          .toBe(false);
        await expect.poll(() => scrollY(page)).toBe(500);
        await expect(control(page)).toBeVisible();
      });
    }
  });
}
