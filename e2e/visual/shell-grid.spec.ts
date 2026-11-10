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
 * @file The shell's page column, measured in a real browser at phone to wide-desktop widths:
 * - nothing in main runs past the visible page (measured inside the shell root's overflow-x-clip,
 *   which would otherwise hide it from the document's scrollWidth), and the page never scrolls
 *   sideways;
 * - below lg, the first heading and paragraph keep a gutter from both screen edges;
 * - main#main-content is at most 1200 px (max-w-shell) wide, centred in the space beside the
 *   64 px rail from lg (1024 px) up, and the full width below lg (the old shell squeezed it into a
 *   60% or 2/3 column);
 * - the footer is as wide as main and centred the same way;
 * - below lg, the end of the page scrolls clear of the fixed bottom bar;
 * - scrolling to the end of '/' again does not make the page taller (a scroll-linked transform
 *   that the y axis does not clip grows the document on every scroll);
 * - on a phone, /projects' filter bar scrolls away with the page instead of covering the list.
 * Screenshots at 320, 768, 1024 and 1440 px are attached to the report for review, not compared.
 */

import { expect, type Locator, type Page, type TestInfo, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import { settleBento } from '../fixtures/home-bento';

/** The shell's one `<main>` (src/components/animations/pages/page-transition.tsx). */
const MAIN = 'main#main-content';

const PATHS = ['/', '/projects'] as const;

const WIDTHS = [320, 375, 768, 1024, 1280, 1440, 1920] as const;

/** Widths whose screenshots are attached to the report. */
const SCREENSHOT_WIDTHS: ReadonlySet<number> = new Set([320, 768, 1024, 1440]);

const VIEWPORT_HEIGHT_PX = 900;

/** Tailwind's `lg` breakpoint: the rail shows from here up, the bottom bar below it. */
const LG_BREAKPOINT_PX = 1024;

/** The rail's width (w-16) and the column's offset beside it (lg:pl-16). */
const RAIL_WIDTH_PX = 64;

/** max-w-shell: --container-shell, 75rem. */
const SHELL_MAX_WIDTH_PX = 1200;

/** Sub-pixel rounding allowed in each measured edge. */
const TOLERANCE_PX = 1;

/** Below lg, text closer than this to a screen edge reads as touching it. */
const MIN_GUTTER_PX = 12;

/** How many offending elements a failure lists (enough to find them, short enough to read). */
const MAX_REPORTED_ELEMENTS = 5;

/** A short wait after two frames for a scroll's React update to land (it renders in a task). */
const SETTLE_MS = 200;

/** A small phone and a common laptop: the heights where a page's end is furthest down. */
const PHONE = { width: 375, height: 667 } as const;
const LAPTOP = { width: 1366, height: 768 } as const;

/** Far enough down /projects at phone size that a non-sticky filter bar would be out of view. */
const FILTER_BAR_SCROLL_PX = 1400;

/** The shared FilterBar kit's sticky <search> on /projects (search and the Filters button). */
const PROJECTS_FILTER_BAR = '[data-filter-part="bar"]';

interface Viewport {
  readonly width: number;
  readonly height: number;
}

interface ColumnBox {
  readonly x: number;
  readonly width: number;
}

interface ElementBox extends ColumnBox {
  readonly y: number;
  readonly height: number;
}

/** The horizontal span content must stay inside. */
interface Span {
  readonly left: number;
  readonly right: number;
}

/**
 * Where main (and the footer) must sit: in the space right of the rail from lg up (the whole
 * width below lg), at most the shell width, centred in that space.
 */
function expectedColumn(viewportWidth: number, clientWidth: number): ColumnBox {
  const offset = viewportWidth >= LG_BREAKPOINT_PX ? RAIL_WIDTH_PX : 0;
  const space = clientWidth - offset;
  const width = Math.min(SHELL_MAX_WIDTH_PX, space);
  return { x: offset + (space - width) / 2, width };
}

/** The part of the screen a page can show content in: right of the rail from lg up. */
function visibleSpan(viewportWidth: number, clientWidth: number): Span {
  return { left: viewportWidth >= LG_BREAKPOINT_PX ? RAIL_WIDTH_PX : 0, right: clientWidth };
}

function expectNear(actual: number, expected: number, what: string): void {
  expect(
    Math.abs(actual - expected),
    `${what}: ${actual} px, expected ${expected} px`,
  ).toBeLessThanOrEqual(TOLERANCE_PX);
}

async function boxOf(locator: Locator): Promise<ElementBox> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('the element is not displayed');
  return box;
}

/**
 * The layout width the shell gets, and the document's content width. The body's width, not the
 * root's clientWidth: with `scrollbar-gutter: stable` some browsers (headless Chromium among them)
 * report the root's clientWidth including the reserved gutter, while the body is laid out without it.
 */
function documentWidths(page: Page): Promise<{ clientWidth: number; scrollWidth: number }> {
  return page.evaluate(() => ({
    clientWidth: document.body.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
}

/**
 * How far main's content reaches past main's right edge. Main is overflow: visible, so its
 * scrollWidth counts descendants that stick out, which the clipped root's scrollWidth never does
 * (nor does a page wrapper's own overflow-clip, which the element check below sees through).
 */
function mainOverflowPx(main: Locator): Promise<number> {
  return main.evaluate((element) => element.scrollWidth - element.clientWidth);
}

/**
 * The visible elements in main that the screen edge (or the rail) cuts off, described as
 * `tag#id.classes [left, right]`. scrollWidth never counts overflow to the left, so this also
 * catches content pushed off the left edge or under the rail.
 * - Inside a horizontal scroller (overflow-x auto or scroll) content is reachable, so it is skipped.
 * - A box that crops (overflow hidden or clip) cuts its content at its own edges. Content it cuts
 *   inside the page (a rounded image, a truncated line) is a deliberate crop and is skipped, but a
 *   page-wide wrapper's crop falls on the screen edge, so what reaches past it still counts.
 */
function elementsOutside(main: Locator, span: Span): Promise<string[]> {
  return main.evaluate(
    (root, { left, right, slack, max }) => {
      /** Where the ancestors below main crop `element`, or null inside a scroller. */
      const cropOf = (element: Element): { left: number; right: number } | null => {
        let crop = { left: Number.NEGATIVE_INFINITY, right: Number.POSITIVE_INFINITY };
        for (let node = element.parentElement; node && node !== root; node = node.parentElement) {
          const { overflowX } = getComputedStyle(node);
          if (overflowX === 'auto' || overflowX === 'scroll') return null;
          if (overflowX === 'hidden' || overflowX === 'clip') {
            const box = node.getBoundingClientRect();
            crop = { left: Math.max(crop.left, box.left), right: Math.min(crop.right, box.right) };
          }
        }
        return crop;
      };
      /** True when `rect` runs past a span edge that its crop does not stop short of. */
      const cutAtEdge = (rect: DOMRect, crop: { left: number; right: number }): boolean =>
        (rect.right > right + slack && crop.right >= right - slack) ||
        (rect.left < left - slack && crop.left <= left + slack);
      const labelOf = (element: Element, rect: DOMRect): string => {
        const id = element.id ? `#${element.id}` : '';
        const classes = [...element.classList].slice(0, 4).join('.');
        const edges = `[${Math.round(rect.left)}, ${Math.round(rect.right)}]`;
        return `${element.tagName.toLowerCase()}${id}.${classes} ${edges}`;
      };
      // Both spellings of each option: browsers that know only the older names ignore the newer.
      const shown: CheckVisibilityOptions = {
        checkOpacity: true,
        checkVisibilityCSS: true,
        opacityProperty: true,
        visibilityProperty: true,
      };
      const found: string[] = [];
      for (const element of root.querySelectorAll('*')) {
        const rect = element.getBoundingClientRect();
        const inside = rect.left >= left - slack && rect.right <= right + slack;
        if (inside || rect.width === 0 || rect.height === 0) continue;
        const crop = cropOf(element);
        if (!crop || !cutAtEdge(rect, crop) || !element.checkVisibility(shown)) continue;
        found.push(labelOf(element, rect));
        if (found.length >= max) break;
      }
      return found;
    },
    { ...span, slack: TOLERANCE_PX, max: MAX_REPORTED_ELEMENTS },
  );
}

/** Below lg main is the full width, so a legacy page without its own gutter touches the edges. */
async function expectGutter(locator: Locator, clientWidth: number, what: string): Promise<void> {
  const box = await boxOf(locator);
  const right = clientWidth - (box.x + box.width);
  expect(box.x, `${what} touches the left edge`).toBeGreaterThanOrEqual(MIN_GUTTER_PX);
  expect(right, `${what} touches the right edge`).toBeGreaterThanOrEqual(MIN_GUTTER_PX);
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

/** Scrolls so that `top` is the top of the viewport, at once (no smooth scrolling to wait for). */
function scrollToY(page: Page, top: number): Promise<void> {
  return page.evaluate((y) => {
    window.scrollTo({ top: y, behavior: 'instant' });
  }, top);
}

/** Scrolls to the very end of the page at once. */
function scrollToEnd(page: Page): Promise<void> {
  return page.evaluate(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
  });
}

/**
 * Waits for a scroll's consequences: the scroll event fires on the next frame, a scroll listener's
 * React state update renders in a later task, and the frame after that lays it out.
 */
function settle(page: Page): Promise<void> {
  return page.evaluate(
    (ms) =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, ms)));
      }),
    SETTLE_MS,
  );
}

/** Scrolls to the end, lets the page react, and returns the document's height. */
async function heightAfterScrollingToEnd(page: Page): Promise<number> {
  await scrollToEnd(page);
  await settle(page);
  return page.evaluate(() => document.documentElement.scrollHeight);
}

/** The top band's end (the edge haze's top strip), or html's scroll-padding-top without one. */
async function topBandEnd(page: Page): Promise<number> {
  return page.evaluate(() => {
    const band = document.querySelector('.edge-haze > .t');
    const padding = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
    return band ? band.getBoundingClientRect().bottom : padding;
  });
}

/**
 * Content that is still on its way: a Suspense segment React streamed into a hidden div and has
 * not revealed yet, or a skeleton that marks itself busy. React reveals streamed segments in
 * batches, after the load event, so a page measured straight after goto can still grow by
 * thousands of pixels (seen on /projects, /experience and the home bento).
 */
const PENDING_CONTENT = 'div[hidden][id^="S:"], main [aria-busy="true"]';

/**
 * Loads `path` at `viewport` and waits for the page's main to show with its streamed content. On
 * the home page it also waits for the bento to settle: its masonry island can still add a 2 px row
 * once a font or an image lands, after the streamed content is in, and a page that grows under a
 * check that has scrolled to its end puts the footer's end below the bottom bar (1 run in about 16
 * at 375 px on a phone).
 */
async function openAt(page: Page, path: string, viewport: Viewport): Promise<Locator> {
  await page.setViewportSize(viewport);
  await page.goto(`${getTargetUrl()}${path}`);
  const main = page.locator(MAIN);
  await expect(main).toBeVisible();
  await expect(page.locator(PENDING_CONTENT)).toHaveCount(0);
  if (path === '/') await settleBento(page, main);
  return main;
}

/** Content stays inside the visible page, measured inside the root's clip as well as outside it. */
async function expectNoSidewaysOverflow(page: Page, main: Locator, width: number): Promise<void> {
  const { clientWidth, scrollWidth } = await documentWidths(page);
  // A guard for what lives outside main (portals, fixed bars): the root clip hides main's overflow.
  expect(scrollWidth, 'the page scrolls sideways').toBeLessThanOrEqual(clientWidth);
  expect(await mainOverflowPx(main), "main's content runs past its right edge").toBeLessThanOrEqual(
    TOLERANCE_PX,
  );
  const outside = await elementsOutside(main, visibleSpan(width, clientWidth));
  expect(outside, 'content in main is cut off at the screen edge or the rail').toEqual([]);
}

const slugOf = (path: string): string => (path === '/' ? 'home' : path.slice(1));

for (const path of PATHS) {
  test.describe(`shell grid on ${path}`, () => {
    for (const width of WIDTHS) {
      test(`${width} px: nothing runs past the page edges; main and footer share the centred column`, async ({
        page,
      }, testInfo) => {
        const main = await openAt(page, path, { width, height: VIEWPORT_HEIGHT_PX });
        await expectNoSidewaysOverflow(page, main, width);

        const { clientWidth } = await documentWidths(page);
        const expected = expectedColumn(width, clientWidth);
        const mainBox = await boxOf(main);
        expectNear(mainBox.width, expected.width, 'main width');
        expectNear(mainBox.x, expected.x, 'main left edge');
        if (width >= LG_BREAKPOINT_PX) {
          expect(mainBox.x, 'main overlaps the rail').toBeGreaterThanOrEqual(RAIL_WIDTH_PX);
        } else {
          expect(mainBox.width, 'main is narrower than the page').toBeGreaterThanOrEqual(
            clientWidth - TOLERANCE_PX,
          );
          await expectGutter(main.locator('h1, h2, h3').first(), clientWidth, 'the first heading');
          await expectGutter(main.locator('p').first(), clientWidth, 'the first paragraph');
        }

        const footerBox = await boxOf(page.getByRole('contentinfo'));
        expectNear(footerBox.width, mainBox.width, 'footer width');
        expectNear(footerBox.x, mainBox.x, 'footer left edge');

        if (SCREENSHOT_WIDTHS.has(width)) {
          await attachScreenshot(page, testInfo, `${slugOf(path)}-${width}`);
        }
      });
    }

    for (const width of WIDTHS.filter((each) => each < LG_BREAKPOINT_PX)) {
      test(`${width} px: the end of the page scrolls clear of the bottom bar`, async ({ page }) => {
        await openAt(page, path, { width, height: VIEWPORT_HEIGHT_PX });
        const bar = page.getByRole('navigation', { name: 'Mobile navigation' });
        await expect(bar).toBeVisible();

        await scrollToEnd(page);

        const footerBox = await boxOf(page.getByRole('contentinfo'));
        const barBox = await boxOf(bar);
        expect(
          footerBox.y + footerBox.height,
          'the bottom bar covers the end of the footer',
        ).toBeLessThanOrEqual(barBox.y + TOLERANCE_PX);
      });
    }
  });
}

test.describe('page height on /', () => {
  for (const viewport of [PHONE, LAPTOP]) {
    test(`${viewport.width}x${viewport.height}: scrolling to the end again does not grow the page`, async ({
      page,
    }) => {
      await openAt(page, '/', viewport);

      // Two rounds: if the first scroll ran before hydration attached a scroll listener, the
      // second still triggers it, and a page that grows with scrolling grows on every round.
      const first = await heightAfterScrollingToEnd(page);
      const second = await heightAfterScrollingToEnd(page);
      expect(
        second - first,
        `the page grew from ${first} px to ${second} px after scrolling to its end`,
      ).toBeLessThanOrEqual(TOLERANCE_PX);
    });
  }
});

test.describe('filter bar on /projects', () => {
  // The owner's pick for the shared kit: "Sticky (Recommended)". On a phone the bar is one row,
  // the search and a Filters button (the kinds and technologies open in a bottom sheet), so it
  // stays pinned inside the top band at every width.
  test(`${PHONE.width}x${PHONE.height}: the one-row filter bar stays pinned in the top band`, async ({
    page,
  }) => {
    const main = await openAt(page, '/projects', PHONE);
    const bar = main.locator(PROJECTS_FILTER_BAR);
    await expect(bar).toBeVisible();

    await scrollToY(page, FILTER_BAR_SCROLL_PX);
    const scrolled = await page.evaluate(() => window.scrollY);
    expect(
      scrolled,
      `/projects is too short to scroll ${FILTER_BAR_SCROLL_PX} px`,
    ).toBeGreaterThanOrEqual(FILTER_BAR_SCROLL_PX - TOLERANCE_PX);

    const box = await boxOf(bar);
    expect(box.y, 'the filter bar is not pinned to the top').toBeGreaterThanOrEqual(-TOLERANCE_PX);
    expect(box.y, 'the filter bar scrolled away').toBeLessThanOrEqual(TOLERANCE_PX);
    expect(box.y + box.height, 'the filter bar ends past the top band').toBeLessThanOrEqual(
      (await topBandEnd(page)) + TOLERANCE_PX,
    );
  });
});
