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
 * @file The phone's Filters sheet on every list page with the FilterBar (/projects,
 * /certifications, /places, /places/photos), on a touch screen, against the live data:
 * - A tap on the dimmed page around the open sheet only closes it: the link under the finger
 *   never gets the click, nothing opens, the page stays where it was, and Back still goes to the
 *   page before (the tap added no entry). A second tap, the sheet closed, works as normal.
 * - A chip in the sheet still filters, Show N and Escape still close it, and the next tap on the
 *   page works as normal after each.
 * - Turning the phone so the page reaches 48rem closes the open sheet, focus staying on its chip,
 *   now in the bar; turning it back puts focus on the Filters button (the chip is hidden again).
 *   A desktop window narrowed across 48rem does the same, and widened again, the chip has it.
 * - With a mouse, a middle-click on the dimmed page only closes the sheet, as a left click does.
 * - The command palette (Ctrl+K) opened over the sheet closes it first: its first click works,
 *   and Escape leaves focus on the Filters button.
 * - At 768 on a touch screen the chips sit in the bar (no Filters button), and a tap on the page
 *   reaches what it lands on.
 * The sheet is a native popover: its light dismiss closes it on the tap's pointerup, and the tap's
 * click then lands on whatever the dimmed backdrop (not a hit target) shows. The kit cancels that
 * one click (src/components/console/filter-bar/outside-press.ts).
 * GET only; nothing signs in or writes.
 */

import { expect, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import { hydrated, settle } from '../fixtures/ledger';

const PAGES = ['/projects', '/certifications', '/places', '/places/photos'] as const;
const PHONE = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };
const TABLET = { width: 768, height: 1024 };
/** A window under 48rem with a mouse, where the palette sits beside the sheet. */
const NARROW = { width: 700, height: 844 };
const DESKTOP = { width: 1024, height: 800 };
/** Deep enough that links sit under the bar on every page, short of any page's end. */
const DEEP_PX = 1100;
const SHEET = '[data-filter-part="sheet"]';
const FILTERS = 'main [data-filter-part="filters"]';
/** A page the test arrives from, so Back has somewhere to go. */
const BEFORE_PATH = '/robots.txt';

type Point = { readonly x: number; readonly y: number; readonly href: string };

/**
 * The filter island's effects have run: its chip row is in pill mode. data-pill comes from a
 * second render that the chips' layout effect asks for, and React runs the first commit's effects
 * (the sheet's press, layer and layout-step listeners among them) before it starts that render.
 * hydrated() resolves earlier, on React's props on the search field, while those listeners may not
 * be in yet. Every page with the bar has a chip row, which sets data-pill even inside the closed
 * phone sheet.
 */
const effectsRan = (page: Page): Promise<unknown> =>
  page.waitForFunction(
    () => document.querySelector('main [data-filter-part="chips"][data-pill="on"]') !== null,
  );

/** Opens `path` from BEFORE_PATH, hydrated, scrolled `top` down (DEEP_PX by default). */
async function openDeep(page: Page, path: string, top = DEEP_PX): Promise<number> {
  await page.goto(`${getTargetUrl()}${BEFORE_PATH}`);
  await page.goto(`${getTargetUrl()}${path}`);
  await settle(page);
  await hydrated(page);
  await effectsRan(page);
  return page.evaluate((to) => {
    window.scrollTo({ top: to, behavior: 'instant' });
    return window.scrollY;
  }, top);
}

const sheetOpen = (page: Page): Promise<boolean> =>
  page.locator(SHEET).evaluate((sheet) => sheet.matches(':popover-open'));

/** The focused element's part (filters, chip, …), else its tag (BODY when nothing has focus). */
const focusedPart = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => {
    const active = document.activeElement;
    return active?.getAttribute('data-filter-part') ?? active?.tagName;
  });

/** Opens the sheet with a mouse click on the Filters button and waits until it has risen. */
async function clickOpen(page: Page): Promise<void> {
  const box = await page.locator(FILTERS).boundingBox();
  if (!box) throw new Error('no Filters button');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => sheetOpen(page)).toBe(true);
  await page
    .locator(SHEET)
    .evaluate((sheet) => Promise.all(sheet.getAnimations().map((animation) => animation.finished)));
}

/** Taps the centre of an element without scrolling to it first (Playwright's tap does). */
async function tapCentre(page: Page, selector: string): Promise<void> {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`nothing to tap: ${selector}`);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

/** Opens the sheet from the Filters button and waits until it has risen. */
async function openSheet(page: Page): Promise<void> {
  await tapCentre(page, FILTERS);
  await expect.poll(() => sheetOpen(page)).toBe(true);
  await page
    .locator(SHEET)
    .evaluate((sheet) => Promise.all(sheet.getAnimations().map((animation) => animation.finished)));
}

/**
 * A point under the bar and above the sheet (or in the screen's top half while it is closed),
 * over a link in the results: a project, a certificate, a place or a photo, never one of the
 * bar's own controls (a chip, a token, Clear all), whose change would run a view transition.
 */
function linkPoint(page: Page): Promise<Point | null> {
  return page.evaluate(() => {
    const sheet = document.querySelector('[data-filter-part="sheet"]');
    const bar = document.querySelector('[data-filter-part="bar"]');
    const top = (bar?.getBoundingClientRect().bottom ?? 0) + 12;
    const open = sheet?.matches(':popover-open') ?? false;
    const bottom = (open ? (sheet?.getBoundingClientRect().top ?? 0) : innerHeight / 2) - 12;
    for (let y = top; y < bottom; y += 14) {
      for (let x = 24; x < innerWidth - 24; x += 20) {
        const link = document.elementFromPoint(x, y)?.closest('a[href]');
        if (link?.closest('[data-filter-part="results"]')) {
          return { x, y, href: link.getAttribute('href') ?? '' };
        }
      }
    }
    return null;
  });
}

/**
 * A point over the results: over a link where one shows (linkPoint), else over anything in them
 * (under a mouse the photo wall has no links), with an empty href.
 */
async function resultsPoint(page: Page): Promise<Point | null> {
  const link = await linkPoint(page);
  if (link) return link;
  return page.evaluate(() => {
    const sheet = document.querySelector('[data-filter-part="sheet"]');
    const bar = document.querySelector('[data-filter-part="bar"]');
    const top = (bar?.getBoundingClientRect().bottom ?? 0) + 12;
    const bottom = (sheet?.getBoundingClientRect().top ?? innerHeight / 2) - 12;
    for (let y = top; y < bottom; y += 14) {
      for (let x = 24; x < innerWidth - 24; x += 20) {
        if (document.elementFromPoint(x, y)?.closest('[data-filter-part="results"]')) {
          return { x, y, href: '' };
        }
      }
    }
    return null;
  });
}

type LinkWatch = { clicks: boolean[]; stop?: () => void };

/**
 * Records the clicks and auxclicks (a middle press's) that reach the link at `point`, or what is
 * there when no link is (on it, before the page's own handlers), each with whether it arrived
 * cancelled; with `hold`, cancels them afterwards, so the page stays put. A later watch replaces
 * the one before.
 */
function watchLink(page: Page, point: Point, hold: boolean): Promise<void> {
  return page.evaluate(
    ({ x, y, keep }) => {
      const box = window as unknown as { __linkWatch?: LinkWatch };
      box.__linkWatch?.stop?.();
      const under = document.elementFromPoint(x, y);
      const link = under?.closest('a[href]') ?? under;
      const watch: LinkWatch = { clicks: [] };
      const record = (event: Event): void => {
        watch.clicks.push(event.defaultPrevented);
        if (keep) event.preventDefault();
      };
      for (const type of ['click', 'auxclick']) link?.addEventListener(type, record);
      watch.stop = () => {
        for (const type of ['click', 'auxclick']) link?.removeEventListener(type, record);
      };
      box.__linkWatch = watch;
    },
    { x: point.x, y: point.y, keep: hold },
  );
}

const linkClicks = (page: Page): Promise<boolean[]> =>
  page.evaluate(() => (window as unknown as { __linkWatch?: LinkWatch }).__linkWatch?.clicks ?? []);

/** Taps `point` with the sheet closed: the link gets one click, not cancelled. */
async function expectTapLands(page: Page, point: Point | null): Promise<void> {
  expect(point, 'a link to tap under the bar').not.toBeNull();
  if (!point) return;
  await watchLink(page, point, true);
  await page.touchscreen.tap(point.x, point.y);
  await expect.poll(() => linkClicks(page), { message: 'the link gets the tap' }).toEqual([false]);
}

test.describe('the phone Filters sheet: a tap outside it only closes it', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  for (const path of PAGES) {
    test(`${path}: the link under the dimmed page never opens, Back is unchanged, the next tap works`, async ({
      page,
      context,
    }) => {
      const opened: string[] = [];
      context.on('page', (other) => opened.push(other.url()));
      const deep = await openDeep(page, path);
      await openSheet(page);
      const point = await linkPoint(page);
      expect(point, 'a link shows above the sheet').not.toBeNull();
      if (!point) return;
      await watchLink(page, point, false);
      await page.evaluate(() => {
        (window as unknown as { sheetMark: boolean }).sheetMark = true;
      });

      await page.touchscreen.tap(point.x, point.y);

      await expect.poll(() => sheetOpen(page), { message: 'the tap closes the sheet' }).toBe(false);
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-filter-part')), {
          message: 'focus comes back to the Filters button',
        })
        .toBe('filters');
      // Long enough for a navigation or a new tab to have started.
      await page.waitForTimeout(800);
      expect(new URL(page.url()).pathname, `stays on ${path}, not ${point.href}`).toBe(path);
      expect(await linkClicks(page), 'the link under the finger gets no click').toEqual([]);
      expect(opened, 'no new tab opens').toEqual([]);
      const marked = await page.evaluate(() => 'sheetMark' in window);
      expect(marked, 'the page did not reload').toBe(true);
      expect(await page.evaluate(() => window.scrollY), 'the page stays where it was').toBe(deep);

      await expectTapLands(page, await linkPoint(page));

      await page.goBack();
      expect(new URL(page.url()).pathname, 'Back goes to the page before').toBe(BEFORE_PATH);
    });

    test(`${path}: a chip still filters, Show N and Escape still close it, and the next tap works`, async ({
      page,
    }) => {
      await openDeep(page, path);
      await openSheet(page);
      const sheet = page.locator(SHEET);
      const chip = sheet.locator('a[data-filter-part="chip"]:not([aria-current="true"])').first();
      const slug = new URL((await chip.getAttribute('href')) ?? '', page.url()).search;
      await tapCentre(page, `${SHEET} a[data-filter-part="chip"]:not([aria-current="true"])`);
      await expect.poll(() => new URL(page.url()).search).toBe(slug);
      expect(await sheetOpen(page), 'a chip keeps the sheet open').toBe(true);

      await tapCentre(page, `${SHEET} button[popovertargetaction="hide"]`);
      await expect.poll(() => sheetOpen(page), { message: 'Show N closes the sheet' }).toBe(false);
      expect(new URL(page.url()).search, 'Show N keeps the filter').toBe(slug);
      await expectTapLands(page, await linkPoint(page));

      await openSheet(page);
      await page.keyboard.press('Escape');
      await expect.poll(() => sheetOpen(page), { message: 'Escape closes the sheet' }).toBe(false);
      await expectTapLands(page, await linkPoint(page));
    });

    test(`${path}: turning the phone so the page reaches 48rem closes the open sheet, and turning it back puts focus on Filters`, async ({
      page,
    }) => {
      await openDeep(page, path);
      await openSheet(page);
      await page.setViewportSize(LANDSCAPE);
      await expect
        .poll(() => sheetOpen(page), { message: 'the sheet closes at 48rem' })
        .toBe(false);
      await expect(page.locator(FILTERS)).toBeHidden();
      expect(await focusedPart(page), 'focus stays on the chip, now in the bar').toBe('chip');

      await page.setViewportSize(PHONE);

      await expect
        .poll(() => focusedPart(page), {
          message: 'the chip is back in the closed sheet: focus goes to the Filters button',
        })
        .toBe('filters');
      // Long enough for the sheet's display to have slid to none and a late blur to have come.
      await page.waitForTimeout(600);
      expect(await focusedPart(page), 'focus stays on the Filters button').toBe('filters');
      expect(await sheetOpen(page), 'the sheet stays closed').toBe(false);
    });
  }
});

test.describe('a window narrowed and widened across 48rem with focus in the bar', () => {
  test.use({ viewport: DESKTOP });

  for (const path of PAGES) {
    test(`${path}: a chip's focus goes to the Filters button under 48rem, and back to the chip`, async ({
      page,
    }) => {
      await openDeep(page, path, 0);
      await page.locator(`${SHEET} a[data-filter-part="chip"][aria-current="true"]`).focus();
      expect(await focusedPart(page)).toBe('chip');

      await page.setViewportSize(NARROW);
      await expect
        .poll(() => focusedPart(page), { message: 'the chip hides in the sheet: focus on Filters' })
        .toBe('filters');

      await page.setViewportSize(DESKTOP);
      await expect
        .poll(() => focusedPart(page), { message: 'Filters hides: focus on the current chip' })
        .toBe('chip');
    });

    test(`${path}: focus outside the bar never moves across 48rem`, async ({ page }) => {
      await openDeep(page, path, 0);
      const outside = page
        .locator('main [data-filter-part="results"]')
        .locator('a[href], [tabindex="0"]')
        .first();
      await outside.focus();
      await page.evaluate(() => {
        (window as unknown as { focusMark: Element | null }).focusMark = document.activeElement;
      });
      const stillThere = (): Promise<boolean> =>
        page.evaluate(
          () =>
            document.activeElement !== document.body &&
            document.activeElement === (window as unknown as { focusMark: Element }).focusMark,
        );
      expect(await stillThere(), 'focus is on the results').toBe(true);

      await page.setViewportSize(NARROW);
      await page.waitForTimeout(600);
      expect(await stillThere(), 'under 48rem, focus stays where it was').toBe(true);
      await page.setViewportSize(DESKTOP);
      await page.waitForTimeout(600);
      expect(await stillThere(), 'from 48rem again, focus stays where it was').toBe(true);
    });
  }
});

test.describe('the phone-width sheet with a mouse: a middle-click only closes it', () => {
  test.use({ viewport: PHONE });

  for (const path of PAGES) {
    test(`${path}: a middle-click on the dimmed page closes the sheet, opens nothing, focus on Filters`, async ({
      page,
      context,
    }) => {
      const opened: string[] = [];
      context.on('page', (other) => opened.push(other.url()));
      const deep = await openDeep(page, path);
      await clickOpen(page);
      const point = await resultsPoint(page);
      expect(point, 'the results show above the sheet').not.toBeNull();
      if (!point) return;
      await watchLink(page, point, false);

      await page.mouse.click(point.x, point.y, { button: 'middle' });

      await expect
        .poll(() => sheetOpen(page), { message: 'the middle-click closes the sheet' })
        .toBe(false);
      await expect
        .poll(() => focusedPart(page), { message: 'focus comes back to the Filters button' })
        .toBe('filters');
      // Long enough for a navigation or a new tab to have started.
      await page.waitForTimeout(800);
      expect(new URL(page.url()).pathname, `stays on ${path}`).toBe(path);
      expect(await linkClicks(page), 'what is under the pointer gets no press').toEqual([]);
      expect(opened, 'no new tab opens').toEqual([]);
      expect(await page.evaluate(() => window.scrollY), 'the page stays where it was').toBe(deep);
    });
  }
});

test.describe('under 48rem with a mouse: the command palette over the open sheet', () => {
  test.use({ viewport: NARROW });

  /** Opens the palette with its shortcut and waits for its search field to have focus. */
  async function openPalette(page: Page): Promise<void> {
    await page.keyboard.press('ControlOrMeta+K');
    await expect(page.getByRole('combobox')).toBeFocused();
  }

  for (const path of PAGES) {
    test(`${path}: Ctrl+K closes the sheet first, and the palette's first click works`, async ({
      page,
    }) => {
      await openDeep(page, path, 0);
      await clickOpen(page);

      await openPalette(page);

      await expect
        .poll(() => sheetOpen(page), { message: 'the palette closes the sheet' })
        .toBe(false);
      const [option, to] =
        path === '/projects' ? ['Certifications', '/certifications'] : ['Projects', '/projects'];
      await page.locator('[role="option"]', { hasText: option }).first().click();
      await expect
        .poll(() => new URL(page.url()).pathname, {
          message: `the first click on ${option} goes there`,
          timeout: 30_000,
        })
        .toBe(to);
    });

    test(`${path}: Escape closes the palette, focus comes back to Filters, the sheet opens again`, async ({
      page,
    }) => {
      await openDeep(page, path, 0);
      await clickOpen(page);
      await openPalette(page);

      await page.keyboard.press('Escape');

      await expect(page.getByRole('combobox')).toHaveCount(0);
      await expect
        .poll(() => focusedPart(page), { message: 'focus comes back to the Filters button' })
        .toBe('filters');
      expect(await sheetOpen(page), 'the sheet stays closed').toBe(false);
      await clickOpen(page);
    });
  }
});

test.describe('768 on a touch screen: the chips in the bar, every tap lands', () => {
  test.use({ viewport: TABLET, hasTouch: true, isMobile: true });

  for (const path of PAGES) {
    test(`${path}: no Filters button, and a tap on a link reaches it`, async ({ page }) => {
      await openDeep(page, path);

      await expect(page.locator(FILTERS)).toBeHidden();
      await expectTapLands(page, await linkPoint(page));
    });
  }
});
