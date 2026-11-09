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
 * @file /certifications' sticky parts, and focus under and into them, against the live data:
 * - The filter bar sticks above the edge haze, with each year's bar and its column labels under
 *   it. All three are one width (the table's), and they are painted only while stuck: at rest the
 *   page's glow shows through them (where the browser has scroll-state queries); stuck, they are
 *   opaque, so no row shows through.
 * - At a year's end the column labels slide under the year bar, which stays readable until it
 *   leaves with the year's last row.
 * - Shift+Tab back up the rows never leaves the focused link or button under the bar, the year
 *   bar or the labels (WCAG 2.2, 2.4.11 Focus Not Obscured).
 * - Focus moving into the stuck bar keeps the page where it is: from a script (a screen reader's
 *   jump), from Shift+Tab, after the only token goes, and when the phone sheet opens and closes.
 *   html's scroll-padding (the edge haze's band) used to make the browser scroll a stuck bar's
 *   control "into view" by hundreds of pixels.
 */

import { expect, type Page, test } from '@playwright/test';

import {
  CURRENT_CHIP,
  DESKTOP,
  hydrated,
  openAt,
  PATH,
  PHONE,
  ROW,
  WIDE,
} from '../fixtures/ledger';

const BAR = '[data-filter-part="bar"]';
const CLEAR = 'rgba(0, 0, 0, 0)';
/** How far the labels have slid into the year bar's band at a year's end. */
const SLID_PX = 16;
/** More focus stops than the list has links and buttons. */
const MAX_STOPS = 400;
/** Enough stops to have crossed several rows and a year boundary. */
const MIN_STOPS = 20;

const scrollY = (page: Page): Promise<number> => page.evaluate(() => window.scrollY);

/** Two frames: whatever a focus change scrolls or paints has happened. */
const frames = (page: Page): Promise<unknown> =>
  page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );

/** The centre of a box, for a pointer that never scrolls first (Playwright's click does). */
const centre = (box: { x: number; y: number; width: number; height: number } | null) => ({
  x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
  y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
});

/** Scrolls to a share of the page's scroll range and waits until the bar holds the top edge. */
async function scrollToStuck(page: Page, share: number): Promise<number> {
  const y = await page.evaluate((part) => {
    const top = Math.round((document.documentElement.scrollHeight - window.innerHeight) * part);
    window.scrollTo({ top, behavior: 'instant' });
    return window.scrollY;
  }, share);
  await expect
    .poll(() => page.locator(BAR).evaluate((e) => Math.round(e.getBoundingClientRect().top)))
    .toBe(0);
  return y;
}

/** Whether focus is in the filter bar. */
const focusInBar = (page: Page): Promise<boolean> =>
  page.evaluate(() => Boolean(document.activeElement?.closest('[data-filter-part="bar"]')));

/**
 * The bar, a year bar and its first column label: their boxes and what they paint (their own
 * background, or the ::before that paints them only while stuck). The year is the one stuck right
 * under the bar, else the first.
 */
function readSticky(page: Page) {
  return page.evaluate((clear) => {
    const paint = (element: Element | null): string => {
      if (!element) return clear;
      const own = getComputedStyle(element).backgroundColor;
      return own === clear ? getComputedStyle(element, '::before').backgroundColor : own;
    };
    const edges = (element: Element | null) => {
      const box = element?.getBoundingClientRect();
      return box ? { top: box.top, bottom: box.bottom, left: box.left, right: box.right } : null;
    };
    const bar = document.querySelector('[data-filter-part="bar"]') as HTMLElement;
    const barBottom = bar.getBoundingClientRect().bottom;
    const years = [...document.querySelectorAll('section[data-index-part="group"] > h2')];
    const year =
      years.find((h2) => Math.abs(h2.getBoundingClientRect().top - barBottom) <= 1) ?? years[0];
    const label = year?.nextElementSibling?.querySelector('thead th') ?? null;
    // A phone hides the <thead>; its cells still compute display: table-cell.
    const labelShows = label?.checkVisibility() ?? false;
    const haze = document.querySelector('.edge-haze');
    return {
      scrollState: CSS.supports('container-type', 'scroll-state'),
      barZ: Number(getComputedStyle(bar).zIndex),
      hazeZ: haze ? Number(getComputedStyle(haze).zIndex) : 0,
      bar: { box: edges(bar), paint: paint(bar) },
      year: { box: edges(year ?? null), paint: paint(year ?? null) },
      label: labelShows ? { box: edges(label), paint: paint(label) } : null,
      table: edges(year?.nextElementSibling ?? null),
    };
  }, CLEAR);
}

test.describe('/certifications: the sticky bar and the year bars', () => {
  for (const viewport of [PHONE, DESKTOP, WIDE]) {
    test(`${viewport.width}px: one width, above the haze, painted only while stuck`, async ({
      page,
    }) => {
      await openAt(page, '', viewport);
      await hydrated(page);

      const rest = await readSticky(page);
      if (rest.scrollState) {
        expect(rest.bar.paint, 'the bar at rest is a darker band over the glow').toBe(CLEAR);
        expect(rest.year.paint, 'a year bar at rest is a darker band').toBe(CLEAR);
        if (rest.label) expect(rest.label.paint, 'labels at rest are a darker band').toBe(CLEAR);
      }

      await scrollToStuck(page, 0.4);
      // A scroll-state query answers on the frame after the scroll that made it true.
      await frames(page);
      const stuck = await readSticky(page);
      const bar = stuck.bar.box;
      const year = stuck.year.box;

      expect(stuck.barZ).toBeGreaterThan(stuck.hazeZ);
      expect(stuck.bar.paint, 'rows show through the stuck bar').not.toBe(CLEAR);
      expect(stuck.year.paint, 'rows show through the stuck year bar').not.toBe(CLEAR);
      expect(Math.abs((year?.top ?? 0) - (bar?.bottom ?? 0)), 'year under the bar').toBeLessThan(1);
      // One extent: the bar, the year bar and the table line up on both edges.
      expect(Math.abs((bar?.left ?? 0) - (year?.left ?? 0)), 'left edges').toBeLessThan(1);
      expect(Math.abs((bar?.right ?? 0) - (year?.right ?? 0)), 'right edges').toBeLessThan(1);
      expect(Math.abs((stuck.table?.left ?? 0) - (year?.left ?? 0)), 'table edge').toBeLessThan(1);
      if (stuck.label) {
        expect(stuck.label.paint, 'rows show through the stuck labels').not.toBe(CLEAR);
        expect(Math.abs((stuck.label.box?.top ?? 0) - (year?.bottom ?? 0))).toBeLessThan(1);
      }
    });
  }

  for (const viewport of [DESKTOP, WIDE]) {
    test(`${viewport.width}px: at a year's end its labels slide under the year bar, which stays readable`, async ({
      page,
    }) => {
      await openAt(page, '', viewport);
      await hydrated(page);
      // The first year (with another after it) whose end comes after the bar has stuck.
      const target = await page.evaluate((slid) => {
        const bar = document.querySelector('[data-filter-part="bar"]') as HTMLElement;
        const barTop = bar.getBoundingClientRect().top + window.scrollY;
        const barHeight = bar.getBoundingClientRect().height;
        const groups = [...document.querySelectorAll('section[data-index-part="group"]')];
        for (const [index, group] of groups.slice(0, -1).entries()) {
          const h2 = group.querySelector('h2') as HTMLElement;
          const table = group.querySelector('table') as HTMLElement;
          const th = table.querySelector('thead th') as HTMLElement;
          const end = table.getBoundingClientRect().bottom + window.scrollY;
          const y = Math.round(end - (barHeight + h2.offsetHeight + th.offsetHeight) + slid);
          if (y > barTop + h2.offsetHeight) return { index, y };
        }
        return null;
      }, SLID_PX);
      expect(target, 'a year that ends below the stuck bar').not.toBeNull();

      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), target?.y ?? 0);
      await frames(page);
      const seen = await page.evaluate((index) => {
        const group = document.querySelectorAll('section[data-index-part="group"]')[index];
        const h2 = group?.querySelector('h2') as HTMLElement;
        const th = group?.querySelector('thead th') as HTMLElement;
        // The year's middle, and the foot of its glyphs, where the labels arrive first.
        const year = (h2.firstElementChild ?? h2).getBoundingClientRect();
        const hits = [year.top + year.height / 2, year.bottom - 4].map((y) =>
          document.elementFromPoint(year.left + year.width / 2, y),
        );
        const covering = hits.find((hit) => hit === null || !h2.contains(hit));
        return {
          labelsTop: th.getBoundingClientRect().top,
          yearBottom: h2.getBoundingClientRect().bottom,
          inYear: covering === undefined,
          hit: covering
            ? `${covering.tagName} ${(covering.textContent ?? '').trim().slice(0, 30)}`
            : '',
        };
      }, target?.index ?? 0);

      expect(seen.labelsTop, 'the labels have reached the year bar').toBeLessThan(seen.yearBottom);
      expect(seen.inYear, `the year number is under ${seen.hit}`).toBe(true);
    });
  }

  for (const viewport of [PHONE, DESKTOP, WIDE]) {
    test(`${viewport.width}px: Shift+Tab up the rows never leaves focus under the sticky bars`, async ({
      page,
    }) => {
      const main = await openAt(page, '', viewport);
      await hydrated(page);
      // The last control that shows (a phone hides the cells beyond the title).
      await main.locator(`${ROW} :is(a, button)`).filter({ visible: true }).last().focus();

      const hidden: string[] = [];
      let stops = 0;
      for (; stops < MAX_STOPS; stops++) {
        await page.keyboard.press('Shift+Tab');
        const stop = await page.evaluate(() => {
          const element = document.activeElement;
          if (!(element instanceof HTMLElement) || !element.closest('tr[data-cert-row]')) {
            return null;
          }
          const box = element.getBoundingClientRect();
          const hit = document.elementFromPoint(
            box.left + Math.min(box.width / 2, 40),
            box.top + box.height / 2,
          );
          const shows =
            hit !== null && (hit === element || element.contains(hit) || hit.contains(element));
          const name = (element.getAttribute('aria-label') ?? element.textContent ?? '').trim();
          return shows ? '' : `${name.slice(0, 40)} at ${Math.round(box.top)}: ${hit?.tagName}`;
        });
        if (stop === null) break;
        if (stop !== '') hidden.push(stop);
      }

      expect(stops, 'Shift+Tab went up through several rows').toBeGreaterThan(MIN_STOPS);
      expect(hidden, 'focused controls hidden under the sticky bars').toEqual([]);
    });
  }

  for (const viewport of [PHONE, DESKTOP]) {
    test(`${viewport.width}px: focus moving into the stuck bar keeps the page where it is`, async ({
      page,
    }) => {
      const main = await openAt(page, '', viewport);
      await hydrated(page);
      const y = await scrollToStuck(page, 0.6);
      const second =
        viewport === PHONE ? 'button[popovertarget]' : '[data-chip]:not([aria-current="true"])';
      const jumps: Record<string, number> = {};
      const measure = async (label: string, act: () => Promise<unknown>): Promise<void> => {
        await page.evaluate((top) => {
          (document.activeElement as HTMLElement | null)?.blur();
          window.scrollTo({ top, behavior: 'instant' });
        }, y);
        await frames(page);
        await act();
        await frames(page);
        jumps[label] = y - (await scrollY(page));
      };

      await measure('script focus: search', () =>
        page.evaluate(() =>
          (document.querySelector('main input[type="search"]') as HTMLElement).focus(),
        ),
      );
      await measure(`script focus: ${second}`, () =>
        page.evaluate((s) => (document.querySelector(`main ${s}`) as HTMLElement).focus(), second),
      );
      await measure('Shift+Tab from the first row', async () => {
        await main
          .locator(`${ROW} a`)
          .first()
          .evaluate((link) => (link as HTMLElement).focus({ preventScroll: true }));
        await page.keyboard.press('Shift+Tab');
        expect(await focusInBar(page), 'Shift+Tab from the first row reaches the bar').toBe(true);
      });

      expect(jumps).toEqual({
        'script focus: search': 0,
        [`script focus: ${second}`]: 0,
        'Shift+Tab from the first row': 0,
      });
    });

    test(`${viewport.width}px: removing the only token with the bar stuck keeps the page where it is`, async ({
      page,
    }) => {
      let main = await openAt(page, '', viewport);
      const chip = main.locator('[data-filter-part="chips"] a[data-chip]').nth(1);
      const href = (await chip.getAttribute('href')) ?? '';
      expect(href).toMatch(/^\/certifications\?issuer=/);
      main = await openAt(page, href.slice(PATH.length), viewport);
      await hydrated(page);
      const token = main.getByRole('list', { name: 'Applied filters' }).getByRole('link').first();
      // Just stuck: the bar holds the top edge, and the token shows right under it.
      const y = await page.evaluate(() => {
        const bar = document.querySelector('[data-filter-part="bar"]') as HTMLElement;
        const top = Math.ceil(bar.getBoundingClientRect().top + window.scrollY) + 2;
        window.scrollTo({ top, behavior: 'instant' });
        return window.scrollY;
      });
      await frames(page);
      const box = await token.boundingBox();
      const barBottom = await page.locator(BAR).evaluate((e) => e.getBoundingClientRect().bottom);
      expect(box?.y ?? 0, 'the token shows under the stuck bar').toBeGreaterThanOrEqual(barBottom);

      const point = centre(box);
      await page.mouse.click(point.x, point.y);

      await expect(page).not.toHaveURL(/issuer=/);
      await expect.poll(() => focusInBar(page), 'focus moved into the bar').toBe(true);
      await frames(page);
      expect(await scrollY(page), 'the page jumped when focus moved into the bar').toBe(y);
    });
  }

  test('phone: the sheet opens and closes over a stuck bar without moving the page', async ({
    page,
  }) => {
    const main = await openAt(page, '', PHONE);
    await hydrated(page);
    const y = await scrollToStuck(page, 0.6);
    const point = centre(await main.getByRole('button', { name: /^Filters/ }).boundingBox());
    const sheet = page.locator('[data-filter-part="sheet"]');

    await page.mouse.click(point.x, point.y);
    await expect(sheet).toBeVisible();
    await expect(sheet.locator(CURRENT_CHIP)).toBeFocused();
    await frames(page);
    expect(await scrollY(page), 'opening the sheet moved the page').toBe(y);

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await frames(page);
    expect(await scrollY(page), 'closing the sheet moved the page').toBe(y);
  });
});
