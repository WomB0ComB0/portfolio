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
 * @file /projects as the open Index (table style 2), against the live data. Nothing hard-codes
 * a count: each check compares the page with its own figures (the header's projects, the chips'
 * counts).
 * - Every project is a row, as many as the header counts, under group h2s (Featured first, then
 *   the years newest first, then Undated) whose counts add up.
 * - Old links still work: ?category=Web Development lands on its kind; a whole old combined
 *   category on its first kind still known (made from the page's own kinds, so editing a
 *   category never breaks it); ?category=bogus shows everything; a single ?tech=Python filters.
 * - A chip and a picker tick filter in place (no navigation) and rewrite the URL, the picker as
 *   repeated ?tech keys. The URL stays the truth: a chip, a project, then Back shows what the
 *   URL names; a navigation to the page's own URL shows every row.
 * - Without JavaScript: the rows are in the first HTML (no loading.tsx), a shared link is
 *   filtered, the search is a GET form, and the picker's Apply submits repeated keys.
 * - At 390 and 1440: no sideways scroll, 60px and 64px rows, the phone's meta line. A row tints
 *   on hover over the motion tokens, and nothing in it moves.
 * - The Kind chips: at 1440 every chip shows; wherever the row scrolls it fades over the clipped
 *   end (data-overflow); a focused chip's ring has room inside the row's clip; on a phone the
 *   sheet's chips wrap, every one inside the sheet.
 * GET only, on the built server (127.0.0.1:3107); nothing signs in or writes.
 */

import { expect, type Locator, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import {
  CURRENT_CHIP,
  DESKTOP,
  figure,
  firstKindChip,
  GROUP_HEADING,
  hydrated,
  kindChips,
  MAIN,
  openAt,
  PATH,
  PHONE,
  ROW,
  readChip,
  settle,
  TITLE,
  tokenColour,
  WIDE,
} from '../fixtures/project-index';

/** An old shared link, from the live categories (a GET snapshot of /api/v1/sanity/projects). */
const OLD_SINGLE_CATEGORY = 'Web Development';
/** A later kind no project has: an old combined link made before a category was re-spelt. */
const RETIRED_KIND = 'Retired Kind';
/** Sub-pixel rounding between two renders of the same layout. */
const SAME_PX = 1;
/** A focused chip's ring: a 2px outline at a 2px offset. */
const RING_PX = 4;

type Box = { left: number; right: number; top: number; bottom: number };

/** The kind chips' row: its box, its scroll extent, its overflow mark and each chip's box. */
function chipRow(main: Locator) {
  return kindChips(main).evaluate((list) => {
    const box = ({ left, right, top, bottom }: DOMRect): Box => ({ left, right, top, bottom });
    return {
      box: box(list.getBoundingClientRect()),
      overflows: list.scrollWidth > list.clientWidth + 1,
      overflow: (list as HTMLElement).dataset.overflow ?? null,
      chips: [...list.querySelectorAll('a[data-filter-part="chip"]')].map((chip) => ({
        label: (chip.textContent ?? '').replace(/\s+/g, ' ').trim(),
        box: box(chip.getBoundingClientRect()),
      })),
    };
  });
}

/** Whether `inner`, grown by `slack` on every side, lies inside `outer` (to a pixel). */
const inside = (inner: Box, outer: Box, slack = 0): boolean =>
  inner.left - slack >= outer.left - SAME_PX &&
  inner.right + slack <= outer.right + SAME_PX &&
  inner.top - slack >= outer.top - SAME_PX &&
  inner.bottom + slack <= outer.bottom + SAME_PX;

interface NextWindow {
  next?: { router?: { push: (href: string) => void } };
}

/** What the nav's links and the command palette do: a client navigation through Next's router. */
async function routerPush(page: Page, href: string): Promise<void> {
  await page.waitForFunction(() => Boolean((window as unknown as NextWindow).next?.router));
  await page.evaluate((target) => {
    (window as unknown as NextWindow).next?.router?.push(target);
  }, href);
}

/** The group headings' words: "Featured, 4 projects" as ['Featured', 4]. */
async function groups(main: Locator): Promise<(readonly [string, number])[]> {
  const texts = await main.locator(GROUP_HEADING).allTextContents();
  return texts.map((text) => {
    const match = /^(.*?), (\d+) projects?$/.exec(text.replace(/\s+/g, ' ').trim());
    if (!match) throw new Error(`unreadable group heading: ${text}`);
    return [match[1] ?? '', Number(match[2])] as const;
  });
}

const currentChip = async (main: Locator) =>
  readChip(await kindChips(main).locator(CURRENT_CHIP).textContent());

test.describe('/projects: the open Index', () => {
  test('every project is a row, as many as the header counts, Featured then the years', async ({
    page,
  }) => {
    const main = await openAt(page, '', WIDE);
    const total = await figure(main, 'projects');
    const found = await groups(main);

    await expect(main.locator(ROW)).toHaveCount(total);
    await expect(main.locator('h1')).toHaveText('Projects');
    expect(found.reduce((sum, [, count]) => sum + count, 0)).toBe(total);
    const labels = found.map(([label]) => label);
    const years = labels.filter((label) => /^\d{4}$/.test(label));
    expect(years).toEqual([...years].sort().reverse());
    if (labels.includes('Featured')) expect(labels[0]).toBe('Featured');
    if (labels.includes('Undated')) expect(labels.at(-1)).toBe('Undated');
    for (const table of await main.getByRole('table').all()) {
      await expect(table).toHaveAttribute('data-variant', 'open');
    }
  });

  test('old links: a single category, a whole combined one, a bogus one and a single ?tech', async ({
    page,
  }) => {
    let main = await openAt(page, `?category=${encodeURIComponent(OLD_SINGLE_CATEGORY)}`, WIDE);
    const single = await currentChip(main);
    expect(single.label).toBe(OLD_SINGLE_CATEGORY);
    await expect(main.locator(ROW)).toHaveCount(single.count);

    const kind = await firstKindChip(main);
    const combined = `${kind.label} / ${RETIRED_KIND}`;
    main = await openAt(page, `?category=${encodeURIComponent(combined)}`, WIDE);
    expect((await currentChip(main)).label).toBe(kind.label);

    main = await openAt(page, '?category=bogus&tech=COBOL', WIDE);
    await expect(main.locator(ROW)).toHaveCount(await figure(main, 'projects'));
    await expect(main.locator('[data-filter-part="applied"]')).toHaveCount(0);

    main = await openAt(page, '?tech=Python', WIDE);
    const rows = await main.locator(ROW).count();
    expect(rows).toBeGreaterThan(0);
    expect(rows).toBeLessThan(await figure(main, 'projects'));
    await expect(main.getByRole('link', { name: /Technology: Python/ })).toBeVisible();
  });

  test('a chip and the picker filter in place, with no navigation, and rewrite the URL', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const main = await openAt(page, '', WIDE);
    await hydrated(page);
    await page.evaluate(() => {
      (window as unknown as { indexMarker: boolean }).indexMarker = true;
    });

    const kind = await firstKindChip(main);
    await kind.link.click();
    await expect(main.locator(ROW)).toHaveCount(kind.count);
    await expect(page).toHaveURL(new RegExp(`/projects\\?category=${kind.slug}$`));

    await kindChips(main)
      .getByRole('link', { name: /^All \d+/ })
      .click();
    await main.getByRole('button', { name: /^Technology/ }).click();
    const options = page.locator('[data-filter-part="picker"] input[type="checkbox"]');
    await options.nth(0).check();
    await options.nth(1).check();
    await expect(page).toHaveURL(/\/projects\?tech=[^&]+&tech=[^&]+$/);

    expect(await page.evaluate(() => 'indexMarker' in window), 'the page navigated').toBe(true);
    expect(errors).toEqual([]);
  });

  test.describe('the URL stays the truth', () => {
    test('a chip, a project, then Back: the rows and chip are the ones the URL names', async ({
      page,
    }) => {
      const main = await openAt(page, '', WIDE);
      await hydrated(page);
      const kind = await firstKindChip(main);
      await kind.link.click();
      await expect(page).toHaveURL(new RegExp(`\\?category=${kind.slug}$`));

      await main.locator(TITLE).first().click();
      await expect(page).toHaveURL(/\/projects\/[^/?]+$/);
      await page.goBack();

      await expect(page).toHaveURL(new RegExp(`/projects\\?category=${kind.slug}$`));
      await settle(page);
      await expect(main.locator(ROW)).toHaveCount(kind.count);
      await expect.poll(() => currentChip(main)).toEqual({ label: kind.label, count: kind.count });
    });

    test('a chip, then a navigation to the page’s own URL: every row again', async ({ page }) => {
      const main = await openAt(page, '', WIDE);
      const total = await figure(main, 'projects');
      await hydrated(page);
      const kind = await firstKindChip(main);
      await kind.link.click();
      await expect(main.locator(ROW)).toHaveCount(kind.count);

      await routerPush(page, PATH);

      await expect(page).toHaveURL(/\/projects$/);
      await expect(main.locator(ROW)).toHaveCount(total);
    });
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('every row is in the first HTML, visible, and a shared link is filtered', async ({
      page,
    }) => {
      await page.setViewportSize(WIDE);
      await page.goto(`${getTargetUrl()}${PATH}`);
      const main = page.locator(MAIN);
      await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);
      const total = await figure(main, 'projects');
      const rows = main.locator(ROW);
      expect(await rows.count()).toBe(total);
      const shown = await rows.evaluateAll(
        (elements) => elements.filter((element) => element.checkVisibility()).length,
      );
      expect(shown).toBe(total);

      await page.goto(
        `${getTargetUrl()}${PATH}?category=${encodeURIComponent(OLD_SINGLE_CATEGORY)}`,
      );
      const chip = readChip(await kindChips(main).locator(CURRENT_CHIP).textContent());
      expect(chip.label).toBe(OLD_SINGLE_CATEGORY);
      expect(await rows.count()).toBe(chip.count);
    });

    test('the search is a GET form, and the picker’s Apply submits repeated keys', async ({
      page,
    }) => {
      await page.setViewportSize(WIDE);
      await page.goto(`${getTargetUrl()}${PATH}`);
      const main = page.locator(MAIN);

      await main.getByRole('searchbox').fill('python');
      await main.getByRole('searchbox').press('Enter');
      await expect(page).toHaveURL(/\/projects\?q=python$/);
      expect(await main.locator(ROW).count()).toBeGreaterThan(0);

      await page.goto(`${getTargetUrl()}${PATH}`);
      await main.getByRole('button', { name: /^Technology/ }).click();
      const options = page.locator('[data-filter-part="picker"] input[type="checkbox"]');
      await options.nth(0).check();
      await options.nth(1).check();
      await page
        .locator('[data-filter-part="picker"]')
        .getByRole('button', { name: 'Apply' })
        .click();
      // A native GET form also sends the empty search field.
      await expect(page).toHaveURL(/\/projects\?(?:q=&)?tech=[^&]+&tech=[^&]+$/);
    });
  });

  for (const [name, viewport, rowHeight] of [
    ['phone', PHONE, 60],
    ['wide', WIDE, 64],
  ] as const) {
    test(`${name} ${viewport.width}x${viewport.height}: no sideways scroll, ${rowHeight}px rows`, async ({
      page,
    }) => {
      const main = await openAt(page, '', viewport);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      const height = await main
        .locator(ROW)
        .first()
        .evaluate((row) => row.getBoundingClientRect().height);
      expect(Math.abs(height - rowHeight)).toBeLessThanOrEqual(SAME_PX);
      if (name === 'phone') {
        const meta = main.locator(ROW).first().locator('td').first().locator('span').last();
        await expect(meta).toBeVisible();
        await expect(main.getByRole('columnheader').first()).toBeHidden();
      }
    });
  }

  test.describe('the Kind chips', () => {
    test('at 1440 every chip shows on the one line, with nothing faded', async ({ page }) => {
      const main = await openAt(page, '', WIDE);
      await hydrated(page);
      const row = await chipRow(main);

      expect(row.chips.map(({ label }) => label).join(' | ')).toMatch(/Other \d+ projects?$/);
      for (const { label, box } of row.chips) {
        expect(inside(box, row.box), `${label} is past the row's edge`).toBe(true);
      }
      expect(row.overflows).toBe(false);
      expect(row.overflow).toBeNull();
    });

    test('at 1024 the row fades over each end with chips past it, and only there', async ({
      page,
    }) => {
      const main = await openAt(page, '', DESKTOP);
      await hydrated(page);
      const start = await chipRow(main);
      expect(start.overflow).toBe(start.overflows ? 'end' : null);
      test.skip(!start.overflows, 'every chip fits at 1024 with today’s kinds');

      await kindChips(main).evaluate((list) => {
        list.scrollLeft = list.scrollWidth;
      });

      await expect.poll(async () => (await chipRow(main)).overflow).toBe('start');
    });

    test('a focused chip’s ring has room inside the row’s clip', async ({ page }) => {
      const main = await openAt(page, '', WIDE);
      await hydrated(page);
      await main.getByRole('searchbox').focus();
      // Tab to the first chip, then one more: a chip inside the row, not at its edge.
      for (let step = 0; step < 6; step += 1) {
        await page.keyboard.press('Tab');
        const onChip = await page.evaluate(() =>
          Boolean(document.activeElement?.matches('a[data-filter-part="chip"]')),
        );
        if (onChip) break;
      }
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement;
        const list = active.closest('ul') as HTMLElement;
        const box = ({ left, right, top, bottom }: DOMRect) => ({ left, right, top, bottom });
        return {
          isChip: active.matches('a[data-filter-part="chip"]'),
          outline: getComputedStyle(active).outlineStyle,
          chip: box(active.getBoundingClientRect()),
          list: box(list.getBoundingClientRect()),
        };
      });

      expect(focused.isChip).toBe(true);
      expect(focused.outline).not.toBe('none');
      expect(inside(focused.chip, focused.list, RING_PX)).toBe(true);
    });

    test('on a phone the sheet’s chips wrap, every one inside the sheet, Other included', async ({
      page,
    }) => {
      const main = await openAt(page, '', PHONE);
      await hydrated(page);
      await main.getByRole('button', { name: /^Filters/ }).click();
      const sheet = page.locator('[data-filter-part="sheet"]');
      await expect(sheet).toBeVisible();

      const widths = await sheet.evaluate((element) => ({
        sheet: element.getBoundingClientRect().left + element.clientWidth,
        chips: [...element.querySelectorAll('ul[aria-label="Filter by kind"] a')].map(
          (chip) => chip.getBoundingClientRect().right,
        ),
      }));
      for (const right of widths.chips) expect(right).toBeLessThanOrEqual(widths.sheet + SAME_PX);
      await expect(kindChips(sheet).getByRole('link', { name: /^Other \d+/ })).toBeInViewport();
    });
  });

  test('a row tints on hover over the motion tokens, and nothing in it moves', async ({
    page,
    hasTouch,
  }) => {
    test.skip(hasTouch, 'a touch screen has no hover');
    const main = await openAt(page, '', WIDE);
    const row = main.locator(ROW).nth(2);
    const surface = await tokenColour(page, '--surface-1');
    const before = await row.evaluate((element) => element.getBoundingClientRect().toJSON());
    expect(await row.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe(
      '0.24s',
    );

    await row.hover();

    await expect.poll(() => row.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(surface);
    expect(await row.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe(
      '0.1s',
    );
    expect(await row.evaluate((element) => element.getBoundingClientRect().toJSON())).toEqual(
      before,
    );
  });
});
