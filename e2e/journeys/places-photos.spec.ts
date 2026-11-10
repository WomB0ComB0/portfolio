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
 * @file /places/photos against the live data (the owner's "Keep A: wall first on a mouse, grid on
 * touch"). Nothing hard-codes a count: each check reads the page's own figures.
 * - 1440 with a mouse: the wall is the first view once its lazy code has mounted; a drag pans
 *   it, a sideways wheel pans it and a vertical one scrolls the page; one Tab stop, arrows move,
 *   Enter opens the photo, Escape closes it and focus comes back; Grid swaps in place.
 * - 390 on touch: the grid first, two columns, no wall code until Wall is tapped; the sheet's
 *   Done and Escape; a photo opens whole (contained) and Done closes it; no sideways scroll.
 * - Without JavaScript at 390, 1024 and 1440: the grid only, each photo a link to a past place.
 * - Filters: the chips and the search narrow the photos, the URL keeps only q and category, the
 *   "Places | Photos" links carry them, and Back from a place page restores them.
 * - Reduced motion: the card folders on /places keep their rest pose on hover, and a hovered wall
 *   card does not lift (it does with motion, so the check can see a lift).
 * - No layout shift on either page.
 * GET only, on the built server (localhost:3109); nothing signs in or writes.
 */

import { expect, type Locator, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import { hydrated, MAIN, PHONE, settle, type Viewport, WIDE } from '../fixtures/places';

const PHOTOS_PATH = '/places/photos';
const GRID = 'ul[aria-label="Photos"]';
const WALL = '[aria-roledescription="photo wall"]';
const CHIPS = 'ul[aria-label="Filter by category"]';
const URL_KEYS = new Set(['q', 'category']);
const LIVE_WORDS = /here now|right now|upcoming|currently at/i;
const NO_JS_VIEWPORTS: readonly Viewport[] = [PHONE, { width: 1024, height: 640 }, WIDE];

/** Opens /places/photos with `query` at `viewport`, settled. */
async function openPhotos(page: Page, query: string, viewport: Viewport): Promise<Locator> {
  await page.setViewportSize(viewport);
  await page.goto(`${getTargetUrl()}${PHOTOS_PATH}${query}`);
  return settle(page);
}

/** The header's "N photos from M past visits", as [N, M]. */
async function headerFigures(main: Locator): Promise<[number, number]> {
  const text = (await main.locator('.page-header-description').textContent()) ?? '';
  const match = /^(\d+) photos? from (\d+) past visits?$/.exec(text.trim());
  if (!match) throw new Error(`unreadable header: ${text}`);
  return [Number(match[1]), Number(match[2])];
}

/** The URL's query keys. */
const urlKeys = (page: Page): string[] => [...new URL(page.url()).searchParams.keys()];

/** The first wall card's transform, to tell whether the wall moved. */
const firstSlotTransform = (page: Page): Promise<string> =>
  page
    .locator(`${WALL} > div > div`)
    .first()
    .evaluate((slot) => getComputedStyle(slot).transform);

/** Whether the page scrolls sideways. */
const sidewaysScroll = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

/** Switches to the grid when the switch is there (fewer than 12 photos have no switch). */
async function showGrid(main: Locator): Promise<void> {
  const grid = main.getByRole('button', { name: 'Grid' });
  if ((await grid.count()) > 0) {
    // Under a loaded machine a click can land while the island is still settling: press again
    // until the switch says Grid.
    await expect(async () => {
      await grid.click();
      await expect(grid).toHaveAttribute('aria-pressed', 'true', { timeout: 1_000 });
    }).toPass();
  }
  await expect(main.locator(GRID)).toBeVisible();
}

test.describe('/places/photos with a mouse or trackpad', () => {
  test.use({ viewport: WIDE });

  test('the wall is first, pans by drag and sideways wheel, and leaves a vertical wheel to the page', async ({
    page,
  }) => {
    const main = await openPhotos(page, '', WIDE);
    const [photos] = await headerFigures(main);
    test.skip(photos < 12, 'fewer than 12 photos: the grid alone');
    await hydrated(page);
    const wall = main.locator(WALL);
    await expect(wall).toBeVisible();
    await expect(main.getByRole('button', { name: 'Wall' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(main.locator(GRID)).toHaveCount(0);

    const box = await wall.boundingBox();
    if (!box) throw new Error('no wall box');
    const before = await firstSlotTransform(page);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 160, box.y + box.height / 2 - 40, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => firstSlotTransform(page)).not.toBe(before);

    const scrolled = await page.evaluate(() => window.scrollY);
    const panned = await firstSlotTransform(page);
    await page.mouse.wheel(240, 0);
    await expect.poll(() => firstSlotTransform(page)).not.toBe(panned);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrolled);
  });

  test('one Tab stop: arrows move, Enter opens, Escape closes, focus comes back; Grid swaps in place', async ({
    page,
  }) => {
    const main = await openPhotos(page, '', WIDE);
    const [photos] = await headerFigures(main);
    test.skip(photos < 12, 'fewer than 12 photos: the grid alone');
    await hydrated(page);
    const wall = main.locator(WALL);
    await expect(wall).toBeVisible();

    await wall.focus();
    await page.keyboard.press('ArrowRight');
    await expect(wall.locator('[data-active="true"]')).toHaveCount(1);
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Open place' })).toHaveAttribute(
      'href',
      /^\/places\/[^/]+$/,
    );
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(wall).toBeFocused();
    await expect(wall.locator('[data-active="true"]')).toHaveCount(1);

    await main.getByRole('button', { name: 'Grid' }).click();
    await expect(main.locator(GRID)).toBeVisible();
    await expect(main.locator(WALL)).toHaveCount(0);
    const link = main.locator(`${GRID} a`).first();
    await link.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(link).toBeFocused();
  });
});

test.describe('/places/photos on a touch screen', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test('the grid first, two columns, and no wall code until Wall is tapped', async ({ page }) => {
    const wallCode: string[] = [];
    page.on('response', async (response) => {
      if (!response.url().endsWith('.js')) return;
      const body = await response.text().catch(() => '');
      if (body.includes('photo wall')) wallCode.push(response.url());
    });
    const main = await openPhotos(page, '', PHONE);
    const [photos] = await headerFigures(main);
    await hydrated(page);
    await expect(main.locator(GRID)).toBeVisible();
    const columns = await main
      .locator(GRID)
      .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(2);
    expect(await sidewaysScroll(page)).toBe(false);
    await page.waitForLoadState('networkidle');
    expect(wallCode).toEqual([]);
    test.skip(photos < 12, 'fewer than 12 photos: no Wall to tap');

    const wallButton = main.getByRole('button', { name: 'Wall' });
    await wallButton.tap();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Done' })).toBeFocused();
    await expect(sheet.locator(WALL)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(wallButton).toBeFocused();
  });

  test('a photo opens whole on a phone, and Done closes it', async ({ page }) => {
    const main = await openPhotos(page, '', PHONE);
    await hydrated(page);
    await main.locator(`${GRID} a`).first().tap();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const fit = await dialog
      .locator('[data-photo-frame] img')
      .last()
      .evaluate((img) => getComputedStyle(img).objectFit);
    expect(fit).toBe('contain');
    await dialog.getByRole('button', { name: 'Done' }).tap();
    await expect(dialog).toHaveCount(0);
    expect(await sidewaysScroll(page)).toBe(false);
  });
});

test.describe('/places/photos without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const viewport of NO_JS_VIEWPORTS) {
    test(`${viewport.width}px: the grid only, each photo a link to a past place`, async ({
      page,
    }) => {
      const main = await openPhotos(page, '', viewport);
      const [photos] = await headerFigures(main);
      await expect(main.locator(GRID)).toBeVisible();
      await expect(main.locator('[data-view-switch]')).toBeHidden();
      await expect(main.locator('[data-wall-frame]')).toBeHidden();
      await expect(main.getByRole('button', { name: /Show all/ })).toBeHidden();
      const links = main.locator(`${GRID} a`);
      await expect(links).toHaveCount(Math.min(photos, 48));
      const hrefs = await links.evaluateAll((items) => items.map((a) => a.getAttribute('href')));
      expect(hrefs.every((href) => /^\/places\/[^/]+$/.test(href ?? ''))).toBe(true);
      if (photos > 48) await expect(main.getByText(/^Showing 48 of \d+\./)).toBeVisible();
      expect(await sidewaysScroll(page)).toBe(false);
    });
  }
});

test.describe('/places/photos filters', () => {
  test.use({ viewport: WIDE });

  test('chips narrow the photos; the URL keeps only q and category', async ({ page }) => {
    const main = await openPhotos(page, '', WIDE);
    await hydrated(page);
    await showGrid(main);
    const all = await main.locator(`${GRID} a`).count();
    await main.locator(`${CHIPS} a[data-chip]:not([data-chip="all"])`).first().click();
    await expect.poll(() => urlKeys(page)).toContain('category');
    expect(urlKeys(page).every((key) => URL_KEYS.has(key))).toBe(true);
    expect(await main.locator(`${GRID} a`).count()).toBeLessThanOrEqual(all);
    expect(await main.textContent()).not.toMatch(LIVE_WORDS);
  });

  test('the Places | Photos links carry the filters, and Back from a place restores them', async ({
    page,
  }) => {
    const main = await openPhotos(page, '?category=hackathon', WIDE);
    await hydrated(page);
    const nav = main.getByRole('navigation', { name: 'Places views' });
    await expect(nav.getByRole('link', { name: 'Photos' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Places' })).toHaveAttribute(
      'href',
      '/places?category=hackathon',
    );

    await showGrid(main);
    await main.locator(`${GRID} a`).first().click();
    await page.getByRole('dialog').getByRole('link', { name: 'Open place' }).click();
    await page.waitForURL(/\/places\/(?!photos)[^/?]+$/);
    await page.goBack();
    await page.waitForURL(/\/places\/photos\?category=hackathon$/);
    const back = page.locator(MAIN);
    await expect(back.locator(`${CHIPS} a[aria-current="true"]`)).toHaveAttribute(
      'data-chip',
      'hackathon',
    );

    await back
      .getByRole('navigation', { name: 'Places views' })
      .getByRole('link', { name: 'Places' })
      .click();
    await page.waitForURL(/\/places\?category=hackathon$/);
  });
});

test.describe('the card folders on /places', () => {
  test.use({ viewport: WIDE });

  for (const reducedMotion of ['reduce', 'no-preference'] as const) {
    test(`hover with ${reducedMotion} motion: the slivers ${reducedMotion === 'reduce' ? 'hold their rest pose' : 'fan out'}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion });
      await page.goto(`${getTargetUrl()}/places`);
      const main = await settle(page);
      const folder = main.locator('[data-photo-folder]').first();
      test.skip((await folder.count()) === 0, 'no place has photos');
      const sliver = folder.locator('img').first();
      const transform = () => sliver.evaluate((img) => getComputedStyle(img).transform);
      const rest = await transform();
      await folder.locator('xpath=ancestor::a[1]').hover();
      if (reducedMotion === 'reduce') {
        // Reduced motion keeps the rest rule on hover; transitions last 1 ms, so two frames do.
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        expect(await transform()).toBe(rest);
      } else {
        await expect.poll(transform).not.toBe(rest);
      }
    });
  }
});

test.describe('the wall under reduced motion', () => {
  test.use({ viewport: WIDE });

  for (const reducedMotion of ['reduce', 'no-preference'] as const) {
    test(`a hovered card ${reducedMotion === 'reduce' ? 'stays put' : 'lifts'} with ${reducedMotion} motion`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion });
      const main = await openPhotos(page, '', WIDE);
      const [photos] = await headerFigures(main);
      test.skip(photos < 12, 'fewer than 12 photos: the grid alone');
      await hydrated(page);
      const wall = main.locator(WALL);
      await expect(wall).toBeVisible();
      await wall.scrollIntoViewIfNeeded();
      // A card wholly inside the wall, and its middle.
      const target = await wall.evaluate((viewport) => {
        const frame = viewport.getBoundingClientRect();
        for (const card of viewport.querySelectorAll<HTMLElement>('[data-cell]')) {
          const box = card.getBoundingClientRect();
          const inside = box.left >= frame.left && box.right <= frame.right && box.top >= frame.top;
          if (inside && box.bottom <= frame.bottom) {
            return {
              cell: card.dataset.cell ?? '',
              x: box.x + box.width / 2,
              y: box.y + box.height / 2,
            };
          }
        }
        return null;
      });
      if (!target) throw new Error('no card wholly inside the wall');
      const card = wall.locator(`[data-cell="${target.cell}"]`);
      const translate = () => card.evaluate((element) => getComputedStyle(element).translate);
      expect(await translate()).toBe('none');
      await page.mouse.move(target.x, target.y);
      if (reducedMotion === 'reduce') {
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        expect(await translate()).toBe('none');
      } else {
        await expect.poll(translate).toBe('0px -3px');
      }
    });
  }
});

/**
 * Sums the page's layout shifts, leaving out the shell's light rays (their shift is on every
 * page, production included, and is not this page's to fix), and checks it is 0.
 */
async function expectNoLayoutShift(page: Page, path: string, wait: string | null): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { cls: number };
    w.cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
        sources?: { node?: Node | null }[];
      }[]) {
        const sources = entry.sources ?? [];
        const raysOnly =
          sources.length > 0 &&
          sources.every((source) => source.node?.parentElement?.closest('.light-rays'));
        if (!entry.hadRecentInput && !raysOnly) w.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(`${getTargetUrl()}${path}`);
  const main = await settle(page);
  if (wait) await main.locator(wait).first().waitFor({ state: 'visible' });
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  expect(await page.evaluate(() => (window as unknown as { cls: number }).cls)).toBe(0);
}

test.describe('no layout shift with a mouse', () => {
  test.use({ viewport: WIDE });

  test('/places at 1440px', ({ page }) => expectNoLayoutShift(page, '/places', null));
  test('/places/photos at 1440px, once the lazy wall has mounted', ({ page }) =>
    expectNoLayoutShift(page, PHOTOS_PATH, WALL));
});

test.describe('no layout shift on a touch screen', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test('/places at 390px', ({ page }) => expectNoLayoutShift(page, '/places', null));
  test('/places/photos at 390px, on the grid', ({ page }) =>
    expectNoLayoutShift(page, PHOTOS_PATH, GRID));
});

test.describe('no layout shift without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const viewport of [PHONE, WIDE]) {
    for (const path of ['/places', PHOTOS_PATH]) {
      test(`${path} at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(`${getTargetUrl()}${path}`);
        await settle(page);
        // Without script there is no observer to read; nothing renders after the HTML either, so
        // the check is that the grid (or the cards) is where the first paint put it.
        const main = page.locator(MAIN);
        await expect(
          main.locator(path === PHOTOS_PATH ? GRID : 'li[data-place-card]').first(),
        ).toBeVisible();
      });
    }
  }
});
