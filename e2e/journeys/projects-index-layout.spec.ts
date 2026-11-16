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
 * @file /projects' layout details, against the live data (the journeys are in
 * projects-index.spec.ts). Nothing hard-codes a count.
 * - On a 375 or 390 phone the chapter links fit one row, each 44px tall under a finger.
 * - On a touch screen Live and Code are 44px tall, and no story is taller for it.
 * - Index: one rule over each year's first row; the hairlines only part later rows.
 * - Screens: its Wall / Grid row sits right under the filter bar (the same pause as the jump
 *   links' row on Stories), with the view switch at its end. Grid on a mouse (1440, 1024, 768) is
 *   a contact sheet: each row one height, tiles of different widths, the last row no taller than
 *   the rest and starting at the left, a project named once per run of its images and the rest
 *   'Fig. n', each such link's name starting with the 'Fig. n' it shows; no name splits inside a
 *   word, at a hyphen ('(PG-FMS)') or not, when it would fit its line whole.
 * - At 200% text in a 320 or 390 window no Screens name or line is clipped, past its card or
 *   split inside a word that would fit its line; no name is under the normal 14px and no line is
 *   larger than its name.
 * GET only, on the lab guard (127.0.0.1:3131); nothing signs in or writes.
 */

import { type Browser, expect, type Locator, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import {
  hydrated,
  openAt,
  PATH,
  PHONE,
  settle,
  type Viewport,
  WIDE,
} from '../fixtures/project-index';

const CHAPTER = 'section[data-chapter]';
const CARDS = '[data-grid-block] a[data-photo-key]';
/** Sub-pixel rounding between two renders of the same layout. */
const SAME_PX = 1;
/** A grid name's normal size: enlarged text never sets one smaller. */
const NAME_PX = 14;
const NARROW: Viewport = { width: 320, height: 640 };

/** How far the page scrolls sideways (0 or less: none). */
const sideways = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/**
 * The Screens grid's shown words (a card's name, its line, its figure number) that are cut: clipped
 * by their box, past their card's edge, or split across two lines inside a word (at a hyphen or
 * not) that would have fitted its line whole. A word wider than its line may break.
 */
const cutCardWords = (main: Locator): Promise<string[]> =>
  main.locator(CARDS).evaluateAll((cards) => {
    const cut: string[] = [];
    /**
     * Whether the word around `at` (between spaces) fits a line `width` wide, whole, with a pixel
     * to spare: its pieces' widths add up to the word's within a fraction of a pixel.
     */
    const fitsWhole = (node: Text, at: number, width: number): boolean => {
      let start = at;
      while (start > 0 && (node.data[start - 1] ?? ' ').trim() !== '') start -= 1;
      let end = at;
      while (end < node.length && (node.data[end] ?? ' ').trim() !== '') end += 1;
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      return [...range.getClientRects()].reduce((sum, rect) => sum + rect.width, 0) < width - 1;
    };
    for (const card of cards) {
      const edge = card.getBoundingClientRect().right;
      for (const part of card.querySelectorAll<HTMLElement>(':scope > span:not(.sr-only)')) {
        if (part.querySelector('img')) continue;
        const text = (part.textContent ?? '').trim();
        const clipped =
          part.scrollWidth > part.clientWidth + 1 || part.scrollHeight > part.clientHeight + 1;
        if (clipped || part.getBoundingClientRect().right > edge + 1) cut.push(text);
        const range = document.createRange();
        const walker = document.createTreeWalker(part, NodeFilter.SHOW_TEXT);
        // The top of the last character, while inside a word (a space ends the word).
        let lastTop: number | null = null;
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const words = node as Text;
          if (words.parentElement?.closest('.sr-only')) continue;
          for (let at = 0; at < words.length; at += 1) {
            if ((words.data[at] ?? ' ').trim() === '') {
              lastTop = null;
              continue;
            }
            range.setStart(words, at);
            range.setEnd(words, at + 1);
            const top = range.getClientRects()[0]?.top;
            if (top === undefined) continue;
            if (lastTop !== null && top > lastTop + 2 && fitsWhole(words, at, part.clientWidth)) {
              cut.push(text);
            }
            lastTop = top;
          }
        }
      }
    }
    return [...new Set(cut)];
  });

/**
 * The contact sheet: its tiles in order (frame box, link, shown words), its rows (each tile's
 * height and the row's first left edge) and the sheet's own left edge.
 */
const readSheet = (main: Locator) =>
  main.locator('[data-grid-block] ul').evaluate((list) => {
    const tiles = [...list.querySelectorAll(':scope > li')].map((cell) => {
      const frame = (
        cell.querySelector('[data-grid-frame]') as HTMLElement
      ).getBoundingClientRect();
      const link = cell.querySelector('a') as HTMLAnchorElement;
      return {
        top: Math.round(frame.top),
        left: frame.left,
        width: Math.round(frame.width),
        height: Math.round(frame.height),
        href: link.getAttribute('href') ?? '',
        shown: [...link.querySelectorAll(':scope > span:not(.sr-only)')]
          .map((part) => (part.textContent ?? '').trim())
          .filter(Boolean)
          .join(' '),
      };
    });
    const rows = new Map<number, { readonly left: number; readonly heights: number[] }>();
    for (const tile of tiles) {
      const row = rows.get(tile.top);
      rows.set(tile.top, {
        left: row?.left ?? tile.left,
        heights: [...(row?.heights ?? []), tile.height],
      });
    }
    return { tiles, rows: [...rows.values()], left: list.getBoundingClientRect().left };
  });

/** A pattern for a name that starts with `shown` ('Fig. 2', not 'Fig. 21'). */
const startingWith = (shown: string): RegExp =>
  new RegExp(`^${shown.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\d)`);

/** Each named card's name and the line under it, in px (a 'Fig. n' card has neither shown). */
const cardSizes = (main: Locator) =>
  main.locator(CARDS).evaluateAll((cards) =>
    cards.flatMap((card) => {
      const [name, line] = [
        ...card.querySelectorAll<HTMLElement>(':scope > span:not(.sr-only)'),
      ].filter((part) => !part.querySelector('img'));
      if (!name || !line) return [];
      const px = (part: HTMLElement) => parseFloat(getComputedStyle(part).fontSize);
      return [{ text: (name.textContent ?? '').trim(), name: px(name), line: px(line) }];
    }),
  );

interface ContextOptions {
  /** A touch screen (pointer: coarse); below 768px by default. */
  readonly touch?: boolean;
  /** A phone's browser (overlay scrollbars, the viewport meta); as `touch` by default. */
  readonly mobile?: boolean;
  /** The browser's own text size in px (32 is 200%). */
  readonly textSize?: number;
}

/** Opens a page in a fresh context, runs `check`, and closes it. */
async function inContext(
  browser: Browser,
  viewport: Viewport,
  check: (page: Page) => Promise<void>,
  options: ContextOptions = {},
): Promise<void> {
  const touch = options.touch ?? viewport.width < 768;
  const context = await browser.newContext({
    viewport,
    hasTouch: touch,
    isMobile: options.mobile ?? touch,
  });
  const page = await context.newPage();
  try {
    if (options.textSize) {
      // The browser's own text size (its settings' font size), as a visitor at 200% has it.
      const cdp = await context.newCDPSession(page);
      await cdp.send('Page.setFontSizes', {
        fontSizes: { standard: options.textSize, fixed: Math.round(options.textSize * 0.8125) },
      });
    }
    await check(page);
  } finally {
    await context.close();
  }
}

test.describe('/projects on a phone', () => {
  for (const width of [375, 390]) {
    test(`a ${width}px phone: the chapter links fit one row, each 44px tall under a finger`, async ({
      browser,
    }) => {
      await inContext(browser, { width, height: 812 }, async (page) => {
        await page.goto(`${getTargetUrl()}${PATH}`);
        const main = await settle(page);
        const links = await main
          .getByRole('navigation', { name: 'In this issue' })
          .getByRole('link')
          .evaluateAll((all) =>
            all.map((link) => {
              const box = link.getBoundingClientRect();
              return { top: Math.round(box.top), height: box.height, right: box.right };
            }),
          );

        expect(links.length).toBeGreaterThan(1);
        expect(new Set(links.map(({ top }) => top)).size, 'rows of chapter links').toBe(1);
        for (const { height } of links) expect(height).toBeGreaterThanOrEqual(44);
        expect(Math.max(...links.map(({ right }) => right))).toBeLessThanOrEqual(width);
      });
    });
  }

  test('on a touch screen Live and Code are 44px tall, and no row is taller for it', async ({
    browser,
  }) => {
    // The same phone browser (one width, overlay scrollbars) with and without a finger.
    const rows = async (touch: boolean) => {
      let found: { links: number[]; rows: number[] } = { links: [], rows: [] };
      await inContext(
        browser,
        PHONE,
        async (page) => {
          await page.goto(`${getTargetUrl()}${PATH}`);
          const main = await settle(page);
          found = await main.locator('[data-project-story]').evaluateAll((stories) => ({
            links: stories.flatMap((story) =>
              [...story.querySelectorAll('[data-project-link]')].map(
                (link) => link.getBoundingClientRect().height,
              ),
            ),
            rows: stories.map((story) => Math.round(story.getBoundingClientRect().height)),
          }));
        },
        { touch, mobile: true },
      );
      return found;
    };
    const [finger, mouse] = [await rows(true), await rows(false)];

    expect(finger.links.length).toBeGreaterThan(0);
    for (const height of finger.links) expect(height).toBeGreaterThanOrEqual(44);
    // Under a mouse they stay 32px, so the rows below are a real comparison.
    for (const height of mouse.links) expect(height).toBeLessThan(44);
    expect(finger.rows).toEqual(mouse.rows);
  });
});

test.describe('/projects: Index and Screens', () => {
  test('Index: one rule over each year’s first row, the hairlines only between rows', async ({
    page,
  }) => {
    const main = await openAt(page, '?view=index', WIDE);
    const lines = await main.locator(CHAPTER).evaluateAll((sections) =>
      sections.map((section) => {
        const entries = [...section.querySelectorAll('[data-project-entry]')];
        const top = Math.min(...entries.map((entry) => entry.getBoundingClientRect().top));
        const inFirstRow = (entry: Element) => entry.getBoundingClientRect().top <= top + 1;
        const ruled = (entry: Element) => getComputedStyle(entry, '::after').display !== 'none';
        const later = entries.filter((entry) => !inFirstRow(entry));
        return {
          firstRowLines: entries.filter(inFirstRow).filter(ruled).length,
          laterLines: later.filter(ruled).length,
          later: later.length,
        };
      }),
    );

    for (const { firstRowLines, laterLines, later } of lines) {
      expect(firstRowLines, 'a hairline right under the year’s rule').toBe(0);
      expect(laterLines).toBe(later);
    }
  });

  test('Screens: its Wall / Grid row sits right under the filter bar, the view switch at its end', async ({
    page,
  }) => {
    const main = await openAt(page, '?view=screens', WIDE);
    await hydrated(page);
    const row = main.locator('[data-screens-bar]');
    const [bar, box, views] = await Promise.all([
      main.locator('[data-filter-part="bar"]').boundingBox(),
      row.boundingBox(),
      row.getByRole('navigation', { name: 'Project views' }).boundingBox(),
    ]);

    await expect(main.getByRole('navigation', { name: 'Project views' })).toHaveCount(1);
    // The same pause as the jump links' row under the bar on Stories: no empty band.
    const stories = await openAt(page, '', WIDE);
    const jumpsRow = await stories.locator('[data-projects-part="views"]').boundingBox();
    const storiesBar = await stories.locator('[data-filter-part="bar"]').boundingBox();
    expect((box?.y ?? 0) - ((bar?.y ?? 0) + (bar?.height ?? 0))).toBeCloseTo(
      (jumpsRow?.y ?? 0) - ((storiesBar?.y ?? 0) + (storiesBar?.height ?? 0)),
      0,
    );
    expect(Math.abs((views?.y ?? 0) - (box?.y ?? 0))).toBeLessThanOrEqual(SAME_PX);
    expect((views?.x ?? 0) + (views?.width ?? 0)).toBeCloseTo((box?.x ?? 0) + (box?.width ?? 0), 0);
  });

  for (const viewport of [WIDE, { width: 1024, height: 768 }, { width: 768, height: 1024 }]) {
    test(`Screens on a mouse at ${viewport.width}px: Grid is a contact sheet that names a project once per run`, async ({
      page,
    }) => {
      const main = await openAt(page, '?view=screens', viewport);
      await hydrated(page);
      const grid = main.getByRole('button', { name: 'Grid' });
      await expect(async () => {
        await grid.click();
        await expect(grid).toHaveAttribute('aria-pressed', 'true', { timeout: 1_000 });
      }).toPass();
      const sheet = await readSheet(main);

      // Every tile in a row is one height, and the widths differ: not a grid of equal cards.
      for (const { heights } of sheet.rows) {
        expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(SAME_PX);
      }
      expect(new Set(sheet.tiles.map(({ width }) => width)).size).toBeGreaterThan(2);
      // The last row keeps the sheet's row height, ending early from the left when it is short.
      const last = sheet.rows.at(-1);
      const above = Math.min(...sheet.rows.slice(0, -1).map(({ heights }) => heights[0] ?? 0));
      expect(last?.heights[0] ?? 0, 'the last row against the rows above').toBeLessThanOrEqual(
        above + SAME_PX,
      );
      expect(Math.abs((last?.left ?? 0) - sheet.left)).toBeLessThanOrEqual(SAME_PX);
      // A run's first image shows its project's name; the rest show only 'Fig. n', which their
      // link's name starts with, as a voice user would say it.
      const cards = main.locator(CARDS);
      for (const [at, tile] of sheet.tiles.entries()) {
        const runs = sheet.tiles[at - 1]?.href === tile.href;
        if (!runs) {
          expect(tile.shown).not.toMatch(/^Fig\./);
          continue;
        }
        expect(tile.shown).toMatch(/^Fig\. \d+$/);
        await expect(cards.nth(at)).toHaveAccessibleName(startingWith(tile.shown));
      }
      expect(await cutCardWords(main), 'names split where they would fit').toEqual([]);
    });
  }

  for (const viewport of [NARROW, PHONE]) {
    test(`at 200% text in a ${viewport.width}px window no Screens name or line is cut`, async ({
      browser,
      browserName,
    }) => {
      test.skip(browserName !== 'chromium', 'the browser text size is set through Chromium’s CDP');
      await inContext(
        browser,
        viewport,
        async (page) => {
          await page.goto(`${getTargetUrl()}${PATH}?view=screens`);
          const main = await settle(page);
          await expect(main.locator('[data-grid-block] a[data-photo-key]').first()).toBeVisible();

          expect(await sideways(page)).toBeLessThanOrEqual(0);
          expect(await cutCardWords(main), 'names or lines cut').toEqual([]);
          // Enlarged text shrinks a long name only down to its normal size, and the line under a
          // name never outgrows it.
          const sizes = await cardSizes(main);
          expect(sizes.length).toBeGreaterThan(0);
          expect(Math.min(...sizes.map(({ name }) => name))).toBeGreaterThanOrEqual(NAME_PX - 0.01);
          expect(
            sizes.filter(({ name, line }) => line > name + 0.01).map(({ text }) => text),
          ).toEqual([]);
        },
        { textSize: 32 },
      );
    });
  }
});
