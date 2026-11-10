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
 * @file The /projects hover preview in a real browser (the owner's "Keep A + no lean"):
 * - with a mouse, the card hangs under the hovered row and right of the pointer, inside the
 *   window, never over the row or the stuck filter bar, and glides between rows (intermediate
 *   positions, not a jump);
 * - keyboard focus pins it outside the row with a fade only; reduced motion pins it too;
 * - a keyboard-pinned row scrolled under the stuck bar hides it: it never paints over the bar;
 * - in a zoomed window (200%: 720x450) it never covers the focused link (WCAG 2.4.11);
 * - Escape dismisses it until the pointer reaches another row (WCAG 1.4.13);
 * - touch adds no card and fetches no cover;
 * - any filter change hides it at once, even one that keeps every row;
 * - its colours are palette tokens.
 * GET only, on the built server (127.0.0.1:3107).
 */

import { expect, type Locator, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import {
  BAR,
  CARD,
  DESKTOP,
  openAt,
  PATH,
  PHONE,
  previewReady,
  ROW,
  settle,
  TITLE,
  tokenColour,
  WIDE,
} from '../fixtures/project-index';

type Rect = { top: number; bottom: number; left: number; right: number; width: number };

const CARD_W = 288;
const EDGE_MARGIN = 16;
const POINTER_GAP = 24;
const ROW_GAP = 8;
const SAME_PX = 2;

/** The card's box once it has finished scaling in (its width back to 288). */
async function settledCard(page: Page): Promise<Rect> {
  await expect
    .poll(() =>
      page.evaluate((selector) => {
        const card = document.querySelector(selector);
        return card ? Math.round(card.getBoundingClientRect().width) : 0;
      }, CARD),
    )
    .toBe(CARD_W);
  return page.evaluate((selector) => {
    const box = (document.querySelector(selector) as HTMLElement).getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width };
  }, CARD);
}

const rectOf = (locator: Locator): Promise<Rect> =>
  locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width };
  });

const overlaps = (a: Rect, b: Rect): boolean =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** A window at 200% zoom of 1440x900, in CSS pixels. */
const ZOOMED = { width: 720, height: 450 };

/** The card's box while it shows a row, or null while it is hidden. */
const shownCard = (page: Page): Promise<Rect | null> =>
  page.evaluate((selector) => {
    const card = document.querySelector(selector);
    if (!card || (card.getAttribute('data-shown') ?? '') === '') return null;
    const box = card.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width };
  }, CARD);

const shownId = (page: Page): Promise<string> =>
  page.evaluate(
    (selector) => document.querySelector(selector)?.getAttribute('data-shown') ?? '',
    CARD,
  );

/** Points at a row, `x` px from the window's left, half way down it. */
async function pointAt(page: Page, row: Locator, x: number): Promise<void> {
  const box = await rectOf(row);
  await page.mouse.move(x, (box.top + box.bottom) / 2, { steps: 4 });
}

test.describe('/projects: the hover preview', () => {
  test('hangs under the hovered row, right of the pointer, inside the window, off the row and bar', async ({
    page,
  }) => {
    const main = await openAt(page, '', WIDE);
    await previewReady(page);
    await page.mouse.wheel(0, 600);
    await settle(page);
    const row = main.locator(ROW).nth(8);
    await row.scrollIntoViewIfNeeded();
    const pointerX = 420;

    await pointAt(page, row, pointerX);

    await expect.poll(() => shownId(page)).toBe((await row.getAttribute('data-preview-id')) ?? '');
    const card = await settledCard(page);
    const rowBox = await rectOf(row);
    const bar = await rectOf(main.locator(BAR));
    expect(Math.abs(card.left - (pointerX + POINTER_GAP))).toBeLessThanOrEqual(SAME_PX);
    expect(Math.abs(card.top - (rowBox.bottom + ROW_GAP))).toBeLessThanOrEqual(SAME_PX);
    expect(card.left).toBeGreaterThanOrEqual(EDGE_MARGIN - 1);
    expect(card.right).toBeLessThanOrEqual(WIDE.width - EDGE_MARGIN + 1);
    expect(overlaps(card, rowBox), 'the card covers the hovered row').toBe(false);
    expect(card.top).toBeGreaterThanOrEqual(bar.bottom - 1);
  });

  test('near the bottom of a short window it goes over the row, still under the stuck bar', async ({
    page,
  }) => {
    const main = await openAt(page, '', DESKTOP);
    await previewReady(page);
    await page.mouse.wheel(0, 500);
    await settle(page);
    const rows = await main.locator(ROW).all();
    const visible: Locator[] = [];
    for (const each of rows) {
      const box = await rectOf(each);
      if (box.bottom < DESKTOP.height - 4 && box.top > 0) visible.push(each);
    }
    const row = visible.at(-1);
    if (!row) throw new Error('no row on screen');

    await pointAt(page, row, 300);

    const card = await settledCard(page);
    const rowBox = await rectOf(row);
    const bar = await rectOf(main.locator(BAR));
    expect(card.bottom).toBeLessThanOrEqual(rowBox.top + 1);
    expect(card.top).toBeGreaterThanOrEqual(bar.bottom - 1);
  });

  test('glides between adjacent rows: intermediate positions, not a jump', async ({ page }) => {
    const main = await openAt(page, '', WIDE);
    await previewReady(page);
    const first = main.locator(ROW).nth(1);
    const second = main.locator(ROW).nth(2);
    await pointAt(page, first, 400);
    const start = await settledCard(page);

    const samples = page.evaluate(
      (selector) =>
        new Promise<number[]>((resolve) => {
          const tops: number[] = [];
          const sample = (): void => {
            tops.push(document.querySelector(selector)?.getBoundingClientRect().top ?? 0);
            if (tops.length < 30) requestAnimationFrame(sample);
            else resolve(tops);
          };
          requestAnimationFrame(sample);
        }),
      CARD,
    );
    await pointAt(page, second, 400);
    const tops = await samples;
    const end = await settledCard(page);

    expect(end.top).toBeGreaterThan(start.top + 10);
    const between = tops.filter((top) => top > start.top + 1 && top < end.top - 1);
    expect(between.length, `no intermediate positions in ${tops.join(', ')}`).toBeGreaterThan(0);
  });

  test('keyboard focus pins the card outside the row, fading only (no scale)', async ({ page }) => {
    const main = await openAt(page, '', WIDE);
    await previewReady(page);
    const link = main.locator(TITLE).nth(1);
    await link.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const row = main.locator(ROW).nth(1);

    await expect.poll(() => shownId(page)).toBe((await row.getAttribute('data-preview-id')) ?? '');
    const card = await settledCard(page);
    expect(overlaps(card, await rectOf(row))).toBe(false);
    const transform = await page.evaluate(
      (selector) => getComputedStyle(document.querySelector(selector) as HTMLElement).transform,
      CARD,
    );
    expect(transform).not.toMatch(/matrix\(0\.9/);
  });

  test('a keyboard-pinned row scrolled under the stuck bar hides the card, never over the bar', async ({
    page,
  }) => {
    const main = await openAt(page, '', WIDE);
    await previewReady(page);
    await page.mouse.move(WIDE.width - 4, WIDE.height - 4);
    const link = main.locator(TITLE).nth(3);
    await link.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const row = main.locator(ROW).nth(3);
    await expect.poll(() => shownId(page)).toBe((await row.getAttribute('data-preview-id')) ?? '');

    for (let step = 0; step < 12; step += 1) {
      await page.mouse.wheel(0, 80);
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      const card = await shownCard(page);
      const bar = await rectOf(main.locator(BAR));
      if (card) expect(card.top, `step ${step}`).toBeGreaterThanOrEqual(bar.bottom - 1);
    }
    const rowBox = await rectOf(row);
    const bar = await rectOf(main.locator(BAR));
    expect(rowBox.bottom, 'the row did not reach the bar').toBeLessThanOrEqual(bar.bottom);
    await expect.poll(() => shownId(page)).toBe('');
  });

  test('at 200% zoom (720x450) the card never covers the focused link', async ({ page }) => {
    const main = await openAt(page, '', ZOOMED);
    await previewReady(page);
    await page.mouse.move(ZOOMED.width - 4, 4);
    await main.locator(TITLE).first().focus();
    await page.keyboard.press('Shift+Tab');

    let checked = 0;
    for (let step = 0; step < 24; step += 1) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(80);
      const focused = await page.evaluate(() => {
        const active = document.activeElement;
        const box = active?.getBoundingClientRect();
        return active?.closest('tr[data-project-row]') && box
          ? { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width }
          : null;
      });
      const card = await shownCard(page);
      if (!focused || !card) continue;
      checked += 1;
      expect(overlaps(card, focused), `the card covers the focused link at Tab ${step}`).toBe(
        false,
      );
    }
    expect(checked, 'the card never showed while tabbing').toBeGreaterThan(0);
  });

  test('Escape dismisses the card until the pointer reaches another row', async ({ page }) => {
    const main = await openAt(page, '', WIDE);
    await previewReady(page);
    const first = main.locator(ROW).nth(1);
    const second = main.locator(ROW).nth(2);
    await pointAt(page, first, 400);
    await expect.poll(() => shownId(page)).not.toBe('');

    await page.keyboard.press('Escape');
    await expect.poll(() => shownId(page), { timeout: 1_000 }).toBe('');
    await pointAt(page, first, 600);
    await page.waitForTimeout(200);
    expect(await shownId(page)).toBe('');

    await pointAt(page, second, 600);
    await expect
      .poll(() => shownId(page))
      .toBe((await second.getAttribute('data-preview-id')) ?? '');
  });

  test('reduced motion: the card does not follow the pointer along a row', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const main = await openAt(page, '', WIDE);
    await previewReady(page);
    const row = main.locator(ROW).nth(1);

    await pointAt(page, row, 300);
    const first = await settledCard(page);
    await pointAt(page, row, 800);
    await page.waitForTimeout(300);
    const second = await settledCard(page);

    expect(Math.abs(second.left - first.left)).toBeLessThanOrEqual(SAME_PX);
    expect(Math.abs(second.top - first.top)).toBeLessThanOrEqual(SAME_PX);
  });

  test('a filter change hides the card at once', async ({ page }) => {
    const main = await openAt(page, '', WIDE);
    await previewReady(page);
    await pointAt(page, main.locator(ROW).nth(1), 400);
    await expect.poll(() => shownId(page)).not.toBe('');

    // Focus the search without moving the pointer, then type a word only some projects have:
    // the rows change under the card.
    const before = await main.locator(ROW).count();
    await main.getByRole('searchbox').evaluate((input) => (input as HTMLInputElement).focus());
    await page.keyboard.type('python');
    await expect.poll(() => main.locator(ROW).count()).toBeLessThan(before);

    await expect.poll(() => shownId(page), { timeout: 1_000 }).toBe('');
  });

  test('any filter change hides the card, even one that keeps every row', async ({ page }) => {
    const main = await openAt(page, '', WIDE);
    await previewReady(page);
    await pointAt(page, main.locator(ROW).nth(1), 400);
    await expect.poll(() => shownId(page)).not.toBe('');

    // One letter changes the URL whether or not it changes the rows.
    await main.getByRole('searchbox').evaluate((input) => (input as HTMLInputElement).focus());
    await page.keyboard.type('e');
    await expect(page).toHaveURL(/\?q=e$/);

    await expect.poll(() => shownId(page), { timeout: 1_000 }).toBe('');
  });

  test('its colours are palette tokens', async ({ page }) => {
    const main = await openAt(page, '', WIDE);
    await previewReady(page);
    await pointAt(page, main.locator(ROW).nth(1), 400);
    await settledCard(page);
    const surface = await tokenColour(page, '--surface-2');
    const halo = await tokenColour(page, '--brand-halo');
    const style = await page.evaluate((selector) => {
      const computed = getComputedStyle(document.querySelector(selector) as HTMLElement);
      return { background: computed.backgroundColor, shadow: computed.boxShadow };
    }, CARD);

    expect(style.background).toBe(surface);
    expect(style.shadow).toContain(halo);
  });
});

test.describe('/projects: no preview on touch', () => {
  test('a phone gets no card and fetches no cover', async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: PHONE });
    const page = await context.newPage();
    const covers: string[] = [];
    page.on('request', (request) => {
      const url = decodeURIComponent(request.url());
      if (url.includes('w=576') || url.includes('576x324')) covers.push(url);
    });
    await page.goto(`${getTargetUrl()}${PATH}`);
    await settle(page);
    // A row is one link, so a tap would leave the page: scrolling the list is the touch here.
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(300);

    await expect(page.locator(CARD)).toHaveCount(0);
    await expect(page.locator('[data-hover-preview]')).toHaveAttribute('data-hover-preview', 'off');
    expect(covers).toEqual([]);
    await context.close();
  });
});
