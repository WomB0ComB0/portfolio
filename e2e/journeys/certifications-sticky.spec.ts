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
 * - The filter bar sticks above the edge haze, as wide as the record under it, and is painted only
 *   while stuck: at rest the page's glow shows through it (where the browser has scroll-state
 *   queries); stuck, it is opaque, so nothing shows through.
 * - From a 48rem page, an issuer's name stays pinned under the bar while its group scrolls past,
 *   and leaves with the group's last certificate.
 * - Shift+Tab back up the certificates never leaves the focused link or button under the bar or a
 *   pinned name (WCAG 2.2, 2.4.11 Focus Not Obscured).
 * - Focus moving into the stuck bar keeps the page where it is: from a script (a screen reader's
 *   jump), from Shift+Tab, after the only token goes, and when the phone sheet opens and closes.
 *   html's scroll-padding (the edge haze's band) used to make the browser scroll a stuck bar's
 *   control "into view" by hundreds of pixels.
 * - Hydration moves nothing: the header and the bar sit where the server HTML put them.
 */

import { type Browser, expect, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import {
  CURRENT_CHIP,
  DESKTOP,
  hydrated,
  MAIN,
  openAt,
  PATH,
  PHONE,
  settle,
  type Viewport,
  WIDE,
} from '../fixtures/ledger';

const BAR = '[data-filter-part="bar"]';
/** Sub-pixel rounding between two renders of the same layout. */
const SAME_PX = 1;
const ITEM = '[data-cert-item]';
const CLEAR = 'rgba(0, 0, 0, 0)';
/** More focus stops than the record has links and buttons. */
const MAX_STOPS = 400;
/** Enough stops to have crossed several certificates and a group or year boundary. */
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

/** The bar: its box, its z-index against the haze's, and what it paints (itself or ::before). */
function readBar(page: Page) {
  return page.evaluate((clear) => {
    const bar = document.querySelector('[data-filter-part="bar"]') as HTMLElement;
    const own = getComputedStyle(bar).backgroundColor;
    const paint = own === clear ? getComputedStyle(bar, '::before').backgroundColor : own;
    const box = bar.getBoundingClientRect();
    const record = document.querySelector('[data-record]')?.getBoundingClientRect();
    const haze = document.querySelector('.edge-haze');
    return {
      scrollState: CSS.supports('container-type', 'scroll-state'),
      barZ: Number(getComputedStyle(bar).zIndex),
      hazeZ: haze ? Number(getComputedStyle(haze).zIndex) : 0,
      paint,
      left: box.left,
      right: box.right,
      recordLeft: record?.left ?? Number.NaN,
      recordRight: record?.right ?? Number.NaN,
    };
  }, CLEAR);
}

/** Marks the tallest issuer group (the one scrolled through longest) and returns its page top. */
function markTallestGroup(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const groups = [...document.querySelectorAll<HTMLElement>('[data-issuer-group]')];
    const tallest = groups.sort((a, b) => b.offsetHeight - a.offsetHeight)[0];
    tallest?.setAttribute('data-probe', '');
    return tallest ? Math.round(tallest.getBoundingClientRect().top + window.scrollY) : null;
  });
}

/** The bar's bottom, and the marked group's name and edges, in the viewport. */
function readPinned(page: Page) {
  return page.evaluate(() => {
    const bar = document.querySelector('[data-filter-part="bar"]') as HTMLElement;
    const group = document.querySelector('[data-probe]') as HTMLElement;
    const name = group.querySelector('h3') as HTMLElement;
    return {
      barBottom: bar.getBoundingClientRect().bottom,
      nameTop: name.getBoundingClientRect().top,
      headBottom: name.parentElement?.getBoundingClientRect().bottom ?? 0,
      groupBottom: group.getBoundingClientRect().bottom,
    };
  });
}

test.describe('/certifications: the sticky bar and the pinned issuer names', () => {
  for (const viewport of [PHONE, DESKTOP, WIDE]) {
    test(`${viewport.width}px: as wide as the record, above the haze, painted only while stuck`, async ({
      page,
    }) => {
      await openAt(page, '', viewport);
      await hydrated(page);

      const rest = await readBar(page);
      if (rest.scrollState) {
        expect(rest.paint, 'the bar at rest is a darker band over the glow').toBe(CLEAR);
      }

      await scrollToStuck(page, 0.4);
      // A scroll-state query answers on the frame after the scroll that made it true.
      await frames(page);
      const stuck = await readBar(page);

      expect(stuck.barZ).toBeGreaterThan(stuck.hazeZ);
      expect(stuck.paint, 'the record shows through the stuck bar').not.toBe(CLEAR);
      expect(Math.abs(stuck.left - stuck.recordLeft), 'left edges').toBeLessThan(1);
      expect(Math.abs(stuck.right - stuck.recordRight), 'right edges').toBeLessThan(1);
    });
  }

  for (const viewport of [DESKTOP, WIDE]) {
    test(`${viewport.width}px: an issuer's name stays pinned under the bar, and leaves with its group`, async ({
      page,
    }) => {
      await openAt(page, '', viewport);
      await hydrated(page);
      const top = await markTallestGroup(page);
      expect(top, 'a busy year with issuer groups').not.toBeNull();

      // Into the group: the name holds just under the bar.
      await page.evaluate((y) => window.scrollTo({ top: y + 240, behavior: 'instant' }), top ?? 0);
      await frames(page);
      const inside = await readPinned(page);
      expect(inside.nameTop, 'the name is under the bar').toBeGreaterThanOrEqual(inside.barBottom);
      expect(inside.nameTop - inside.barBottom, 'and pinned close under it').toBeLessThan(40);

      // Near the group's end: the name leaves with it, never over the next group.
      await page.evaluate(() => {
        const group = document.querySelector('[data-probe]') as HTMLElement;
        const end = group.getBoundingClientRect().bottom + window.scrollY;
        window.scrollTo({ top: end - 120, behavior: 'instant' });
      });
      await frames(page);
      const leaving = await readPinned(page);
      expect(leaving.headBottom).toBeLessThanOrEqual(leaving.groupBottom + 1);
    });
  }

  for (const viewport of [PHONE, DESKTOP, WIDE]) {
    test(`${viewport.width}px: Shift+Tab up the certificates never leaves focus under the sticky parts`, async ({
      page,
    }) => {
      const main = await openAt(page, '', viewport);
      await hydrated(page);
      // The last control that shows (a phone keeps Copy ID out of the groups).
      await main.locator(`${ITEM} :is(a, button)`).filter({ visible: true }).last().focus();

      const hidden: string[] = [];
      let stops = 0;
      for (; stops < MAX_STOPS; stops++) {
        await page.keyboard.press('Shift+Tab');
        const stop = await page.evaluate(() => {
          const element = document.activeElement;
          if (!(element instanceof HTMLElement) || !element.closest('[data-cert-item]')) {
            return null;
          }
          const box = element.getBoundingClientRect();
          const hit = document.elementFromPoint(
            box.left + Math.min(box.width / 2, 40),
            box.top + Math.min(box.height / 2, 12),
          );
          const shows =
            hit !== null && (hit === element || element.contains(hit) || hit.contains(element));
          const name = (element.getAttribute('aria-label') ?? element.textContent ?? '').trim();
          return shows ? '' : `${name.slice(0, 40)} at ${Math.round(box.top)}: ${hit?.tagName}`;
        });
        if (stop === null) break;
        if (stop !== '') hidden.push(stop);
      }

      expect(stops, 'Shift+Tab went up through several certificates').toBeGreaterThan(MIN_STOPS);
      expect(hidden, 'focused controls hidden under the sticky parts').toEqual([]);
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
      // The year jumps are the first controls after the bar.
      await measure('Shift+Tab from the first year jump', async () => {
        await main
          .getByRole('navigation', { name: 'By year' })
          .getByRole('link')
          .first()
          .evaluate((link) => (link as HTMLElement).focus({ preventScroll: true }));
        await page.keyboard.press('Shift+Tab');
        expect(await focusInBar(page), 'Shift+Tab from the first jump reaches the bar').toBe(true);
      });

      expect(jumps).toEqual({
        'script focus: search': 0,
        [`script focus: ${second}`]: 0,
        'Shift+Tab from the first year jump': 0,
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

  /** The header's height, and the bar's offset under the header's top. */
  async function footprint(
    browser: Browser,
    viewport: Viewport,
    javaScriptEnabled: boolean,
  ): Promise<{ header: number; toolbar: number | null }> {
    const context = await browser.newContext({ viewport, javaScriptEnabled });
    try {
      const page = await context.newPage();
      await page.goto(`${getTargetUrl()}${PATH}`);
      if (javaScriptEnabled) {
        await settle(page);
        // CodeRabbit on #613: measure after hydration and the island's first effects (the
        // toolbar reveal), or both runs could read the server layout.
        await hydrated(page);
        await frames(page);
      } else await page.waitForLoadState('load');
      await page.evaluate(() => document.fonts.ready);
      const header = page.locator(`${MAIN} header`).filter({ visible: true }).first();
      const toolbar = page.locator(`${MAIN} ${BAR}`).filter({ visible: true }).first();
      const featured = await page.locator(`${MAIN} [data-featured]`).count();
      const headerBox = await header.boundingBox();
      const toolbarBox = featured === 0 ? await toolbar.boundingBox() : null;
      if (!headerBox) throw new Error('no visible header');
      return {
        header: headerBox.height,
        toolbar: toolbarBox ? toolbarBox.y - headerBox.y : null,
      };
    } finally {
      await context.close();
    }
  }

  for (const viewport of [PHONE, DESKTOP]) {
    test(`${viewport.width}px: hydration keeps the header and bar where the server HTML put them`, async ({
      browser,
    }) => {
      // Without JavaScript the page stays as the server sent it, so it can be measured as it shows.
      const server = await footprint(browser, viewport, false);
      const hydrated = await footprint(browser, viewport, true);

      expect(Math.abs(server.header - hydrated.header), 'header height').toBeLessThanOrEqual(
        SAME_PX,
      );
      // The bar is measured only without a Featured chapter (footprint returns null with one).
      if (hydrated.toolbar !== null && server.toolbar !== null) {
        expect(Math.abs(server.toolbar - hydrated.toolbar), 'toolbar top').toBeLessThanOrEqual(
          SAME_PX,
        );
      }
    });
  }
});
