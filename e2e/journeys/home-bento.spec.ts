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
 * @file The home bento in a real browser. Every check holds whatever the data sources answer: the
 * dev server may have no API keys, and then the tiles show their designed error states.
 * - At 320, 375, 600, 768, 1024, 1280 and 1440 px: nothing scrolls sideways or runs past its slot;
 *   the page's one h1 is 'Mike Odnis', inside main#main-content; the ten slots show, in the DOM
 *   order, which is also their reading order (top to bottom, then left to right), and none
 *   overlaps another; the grid has the 2, 6 or 12 columns bento.module.css picks at that width; in
 *   the 6- and 12-column layouts the hero is the largest slot. At 600 px the bento still has 2
 *   columns, but the site index once set four cells across there and a name ran past its cell.
 * - Every link in main has a name, none goes to '#' or nowhere, and each one that opens a new tab
 *   says so and drops the opener.
 * - The skip link, then Tab, focuses 'Email me', the hero's first link.
 * - Under reduced motion no status dot runs an animation; without it, a pulsing live dot does
 *   (checked only while one is on screen: something playing, or every service up).
 * - Loading the page logs no console error, page error or hydration warning, up to the moment the
 *   hero's 'Jump to…' opens the palette, which proves React has hydrated.
 * - Without JavaScript the hero's h1 and links show at once, and the HTML holds every tile's
 *   content. A tile that resolves after the first flush is streamed into a hidden element that
 *   only JavaScript moves into its slot (React does this even when the tile is ready within
 *   milliseconds), so without JavaScript its skeleton stays on screen; its content is still in
 *   the document, which is what a crawler reads. So those checks assert presence, not display,
 *   comparing each slot's headings with the ones the hydrated page shows.
 *
 * Every check first waits for every slot to finish loading: a tile's skeleton is aria-busy until
 * the tile, or its error state, replaces it. Slots are found by data-bento-slot, because CSS module
 * class names are hashed. The area list is repeated here: home-page.tsx is a server module that
 * Playwright's process cannot load.
 */

import {
  type APIRequestContext,
  type Browser,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';

/** The shell's one `<main>` (src/components/animations/pages/page-transition.tsx). */
const MAIN = 'main#main-content';

const SLOT = '[data-bento-slot]';

/** BENTO_AREAS in src/app/_components/home/home-page.tsx: the slots in DOM order. */
const BENTO_AREAS = [
  'hero',
  'now',
  'status',
  'leet',
  'type',
  'gh',
  'proj',
  'place',
  'role',
  'strip',
] as const;

type BentoArea = (typeof BENTO_AREAS)[number];

/**
 * The columns bento.module.css gives the bento at each viewport width: 2 below a 40rem bento, 6 up
 * to 67.5rem, then 12. The bento is main less the page gutters, and main sits beside the 64 px rail
 * from 1024 px up, so 1024 px is still the 6-column layout.
 */
const LAYOUTS = [
  { width: 320, columns: 2 },
  { width: 375, columns: 2 },
  // A 560 px bento: the full-width site index once set four cells across from a 480 px tile.
  { width: 600, columns: 2 },
  { width: 768, columns: 6 },
  { width: 1024, columns: 6 },
  { width: 1280, columns: 12 },
  { width: 1440, columns: 12 },
] as const;

/** The stacked layout, where every slot but two spans the width and the tallest is largest. */
const NARROW_COLUMNS = 2;

const VIEWPORT_HEIGHT_PX = 900;

/** Sub-pixel rounding allowed in each measured edge. */
const TOLERANCE_PX = 1;

/** A tile still loading (its skeleton) marks itself busy. */
const BUSY = '[aria-busy="true"]';

const HERO_NAME = 'Mike Odnis';
const FIRST_HERO_LINK = 'Email me';
const SKIP_LINK = 'Skip to content';
/** The hero's palette button (PALETTE_HINT_LABEL in tiles/palette-hint.tsx). */
const PALETTE_BUTTON = 'Jump to…';
/** The palette's search field (PALETTE_SEARCH_LABEL in src/components/cmd.tsx). */
const PALETTE_SEARCH = 'Search pages and commands';
/** How long one try at opening the palette waits for it before clicking again. */
const PALETTE_TIMEOUT_MS = 2_000;

/** What a link that opens a new tab says to screen readers (NEW_TAB_LABEL in tile-link.tsx). */
const NEW_TAB_NAME = /\(opens in a new tab\)/;

/**
 * The browser's own line for a failed request. Upstream failures are the data sources' business:
 * each tile shows its error state for them, and this spec must pass without API keys.
 */
const NETWORK_FAILURE = /^Failed to load resource\b/;
/**
 * Vercel serves /_vercel/insights and /_vercel/speed-insights only on its own platform. A local
 * production build (next start, standalone) answers them with a text 404, which the browser refuses
 * to run as a script. That is the host, not the page.
 */
const VERCEL_ONLY_SCRIPT = /Refused to execute script from '[^']*\/_vercel\//;
const HYDRATION = /hydrat/i;

/** A pulsing dot: StatusDot's motion-safe:animate-live-pulse. */
const PULSING_DOT = '[data-status-dot][class*="animate-live-pulse"]';

interface SlotBox {
  readonly area: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface SlotHeadings {
  readonly area: string;
  readonly headings: readonly string[];
}

const urlOf = (path = '/'): string => `${getTargetUrl()}${path}`;

const slotOf = (main: Locator, area: BentoArea): Locator =>
  main.locator(`[data-bento-slot="${area}"]`);

/**
 * Requests '/' once and reads the whole response. The HTML stream ends only after every tile's
 * loader has answered or hit its deadline, so the browser's load next finds them cached (and,
 * under `next dev`, the route compiled).
 */
async function warmLoaders(request: APIRequestContext): Promise<void> {
  const response = await request.get(urlOf());
  await response.body();
}

/** Loads '/' (at `width`, when given) and waits for the shell's main to show. */
async function openHome(page: Page, width?: number): Promise<Locator> {
  if (width !== undefined) await page.setViewportSize({ width, height: VIEWPORT_HEIGHT_PX });
  await page.goto(urlOf());
  const main = page.locator(MAIN);
  await expect(main).toBeVisible();
  return main;
}

/** Waits until all ten slots hold their tile or its error state: no skeleton is left. */
async function expectTilesSettled(main: Locator): Promise<void> {
  await expect(main.locator(SLOT)).toHaveCount(BENTO_AREAS.length);
  await expect(main.locator(`${SLOT} ${BUSY}`)).toHaveCount(0);
}

/** The page's h1s in the document (not in a dev tool's shadow root), and main's one h1. */
async function expectOneHeroHeading(page: Page, main: Locator): Promise<void> {
  expect(await page.evaluate(() => document.querySelectorAll('h1').length)).toBe(1);
  await expect(main.locator('h1')).toHaveText(HERO_NAME);
}

/** The columns the bento grid (the slots' parent) lays out, as resolved track sizes. */
function gridColumnCount(main: Locator): Promise<number> {
  return slotOf(main, 'hero').evaluate((slot) => {
    const grid = slot.parentElement;
    if (!grid) return 0;
    return getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
  });
}

/** Each slot's area name and box, in DOM order. */
function slotBoxes(main: Locator): Promise<SlotBox[]> {
  return main.locator(SLOT).evaluateAll((slots) =>
    slots.map((slot) => {
      const { x, y, width, height } = slot.getBoundingClientRect();
      return { area: slot.getAttribute('data-bento-slot') ?? '', x, y, width, height };
    }),
  );
}

/** The areas as a reader meets them: by row (top edge), then left to right. */
const readingOrder = (boxes: readonly SlotBox[]): string[] =>
  [...boxes].sort((a, b) => Math.round(a.y) - Math.round(b.y) || a.x - b.x).map((box) => box.area);

const overlaps = (a: SlotBox, b: SlotBox): boolean =>
  a.x + a.width - TOLERANCE_PX > b.x &&
  b.x + b.width - TOLERANCE_PX > a.x &&
  a.y + a.height - TOLERANCE_PX > b.y &&
  b.y + b.height - TOLERANCE_PX > a.y;

/** Every pair of slots whose boxes overlap, as 'a/b'. */
const overlappingPairs = (boxes: readonly SlotBox[]): string[] =>
  boxes.flatMap((a, index) =>
    boxes
      .slice(index + 1)
      .filter((b) => overlaps(a, b))
      .map((b) => `${a.area}/${b.area}`),
  );

/** The slot with the largest box. */
const largestSlot = (boxes: readonly SlotBox[]): string | undefined =>
  [...boxes].sort((a, b) => b.width * b.height - a.width * a.height)[0]?.area;

/**
 * Nothing scrolls sideways: not the page (the body's width, as shell-grid.spec.ts measures it),
 * not main (the shell root's overflow-x-clip would hide main's overflow from the page), and no
 * slot's content past the slot's own edge (a long CMS string that does not wrap or clamp).
 */
async function expectNoSidewaysOverflow(page: Page, main: Locator): Promise<void> {
  const { clientWidth, scrollWidth } = await page.evaluate(() => ({
    clientWidth: document.body.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(scrollWidth, 'the page scrolls sideways').toBeLessThanOrEqual(clientWidth);
  expect(
    await main.evaluate((element) => element.scrollWidth - element.clientWidth),
    "main's content runs past its right edge",
  ).toBeLessThanOrEqual(TOLERANCE_PX);
  const overflowing = await main
    .locator(SLOT)
    .evaluateAll(
      (slots, slack) =>
        slots
          .filter((slot) => slot.scrollWidth - slot.clientWidth > slack)
          .map(
            (slot) =>
              `${slot.getAttribute('data-bento-slot')}: ${slot.scrollWidth - slot.clientWidth} px`,
          ),
      TOLERANCE_PX,
    );
  expect(overflowing, 'content runs past its slot').toEqual([]);
}

/** Every anchor in main whose href is missing, empty or '#', as a short piece of its markup. */
function anchorsWithoutDestination(main: Locator): Promise<string[]> {
  return main.locator('a').evaluateAll((anchors) =>
    anchors
      .filter((anchor) => {
        const href = anchor.getAttribute('href')?.trim() ?? '';
        return href === '' || href === '#';
      })
      .map((anchor) => anchor.outerHTML.slice(0, 160)),
  );
}

/** The dots among `dots` that run an animation (theirs or a pseudo-element's), by tone. */
function animatedDots(dots: Locator): Promise<string[]> {
  return dots.evaluateAll((elements) =>
    elements
      .filter((element) => element.getAnimations({ subtree: true }).length > 0)
      .map((element) => element.getAttribute('data-tone') ?? 'unknown'),
  );
}

/**
 * Opens the palette with the hero's 'Jump to…' button. The button works only once React has
 * hydrated it, so the click is retried until the palette's search shows, and never repeated
 * while the palette is open (a second click would close it).
 */
async function openPaletteFromHero(page: Page, main: Locator): Promise<void> {
  const button = main.getByRole('button', { name: PALETTE_BUTTON });
  const search = page.getByRole('combobox', { name: PALETTE_SEARCH });
  await expect(async () => {
    if (!(await search.isVisible())) await button.click();
    await expect(search).toBeVisible({ timeout: PALETTE_TIMEOUT_MS });
  }).toPass();
}

/**
 * Asserts that `locator` is displayed and that no entrance animation left it, or an ancestor, at
 * opacity 0 (Playwright counts an opacity-0 element as visible).
 */
async function expectOpaque(locator: Locator, what: string): Promise<void> {
  await expect(locator).toBeVisible();
  const isTransparent = await locator.evaluate((element) => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      if (getComputedStyle(node).opacity === '0') return true;
    }
    return false;
  });
  expect(isTransparent, `${what} or an ancestor is at opacity 0`).toBe(false);
}

/**
 * Each slot's headings (h1 to h3, whitespace collapsed) as a JavaScript visitor sees them once
 * every tile has loaded, read in a browser context of their own. That context turns JavaScript
 * on by name: a bare newContext() takes the test's options, so inside a describe that turns it
 * off it would be off here too. The palette opening from the hero then proves React hydrated, so
 * this can never quietly be a second no-JavaScript read.
 */
async function hydratedHeadings(browser: Browser): Promise<SlotHeadings[]> {
  const context = await browser.newContext({ javaScriptEnabled: true });
  try {
    const page = await context.newPage();
    const main = await openHome(page);
    await expectTilesSettled(main);
    await openPaletteFromHero(page, main);
    return await main.locator(SLOT).evaluateAll((slots) =>
      slots.map((slot) => ({
        area: slot.getAttribute('data-bento-slot') ?? '',
        headings: [...slot.querySelectorAll('h1, h2, h3')].map((heading) =>
          (heading.textContent ?? '').replace(/\s+/g, ' ').trim(),
        ),
      })),
    );
  } finally {
    await context.close();
  }
}

/**
 * The expected headings the document lacks, as 'area: heading'. A heading counts when it is in
 * main or in a streamed chunk (a hidden element React fills after the first flush), and not in a
 * skeleton, since a skeleton shows its tile's label too.
 */
function missingHeadings(page: Page, expected: readonly SlotHeadings[]): Promise<string[]> {
  return page.evaluate(
    ({ slots, busy }) => {
      const present = new Set(
        [...document.querySelectorAll('h1, h2, h3')]
          .filter((heading) => heading.closest('main, [hidden]') && !heading.closest(busy))
          .map((heading) => (heading.textContent ?? '').replace(/\s+/g, ' ').trim()),
      );
      return slots.flatMap(({ area, headings }) =>
        headings.filter((heading) => !present.has(heading)).map((heading) => `${area}: ${heading}`),
      );
    },
    { slots: expected, busy: BUSY },
  );
}

test.beforeEach(async ({ request }) => {
  await warmLoaders(request);
});

test.describe('home bento layout', () => {
  for (const { width, columns } of LAYOUTS) {
    test(`${width} px: ${columns} columns, one h1, ten slots in reading order, no overlap or overflow`, async ({
      page,
    }) => {
      const main = await openHome(page, width);
      await expectTilesSettled(main);

      expect(await gridColumnCount(main), 'the bento layout for this width').toBe(columns);
      await expectOneHeroHeading(page, main);
      for (const area of BENTO_AREAS) await expect(slotOf(main, area)).toBeVisible();

      const boxes = await slotBoxes(main);
      expect(boxes.map((box) => box.area)).toEqual([...BENTO_AREAS]);
      expect(readingOrder(boxes), 'the reading order differs from the DOM order').toEqual([
        ...BENTO_AREAS,
      ]);
      expect(overlappingPairs(boxes), 'slots overlap').toEqual([]);
      await expectNoSidewaysOverflow(page, main);
      if (columns !== NARROW_COLUMNS) {
        expect(largestSlot(boxes), 'the hero is not the largest slot').toBe('hero');
      }
    });
  }
});

test.describe('home bento links and keyboard', () => {
  test('every link in main has a name and a destination, and says when it opens a new tab', async ({
    page,
  }) => {
    const main = await openHome(page);
    await expectTilesSettled(main);

    const links = await main.getByRole('link').all();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) await expect(link).toHaveAccessibleName(/\S/);
    expect(await anchorsWithoutDestination(main), "links to '#' or nowhere").toEqual([]);

    const newTabLinks = await main.locator('a[target="_blank"]').filter({ visible: true }).all();
    for (const link of newTabLinks) {
      await expect(link).toHaveAccessibleName(NEW_TAB_NAME);
      await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
    }
  });

  test(`the skip link, then Tab, focuses '${FIRST_HERO_LINK}'`, async ({ page }) => {
    const main = await openHome(page);
    const firstLink = main.getByRole('link', { name: FIRST_HERO_LINK, exact: true });
    await expect(firstLink).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: SKIP_LINK })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(main).toBeFocused();
    await page.keyboard.press('Tab');

    await expect(firstLink).toBeFocused();
  });
});

test.describe('home bento motion', () => {
  test('no status dot runs an animation under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const main = await openHome(page);
    await expectTilesSettled(main);

    // The status tile always shows one dot: idle while checking, its state's colour after.
    await expect(slotOf(main, 'status').locator('[data-status-dot]')).toHaveCount(1);
    expect(await animatedDots(main.locator('[data-status-dot]'))).toEqual([]);
  });

  test('a pulsing live dot animates when motion is allowed', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const main = await openHome(page);
    await expectTilesSettled(main);

    const pulsing = main.locator(PULSING_DOT);
    const count = await pulsing.count();
    test.skip(
      count === 0,
      'no live dot pulses now: nothing is playing and not every service is up',
    );
    expect(await animatedDots(pulsing)).toHaveLength(count);
  });
});

test.describe('home bento console', () => {
  test('loads without console errors, page errors or hydration warnings', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      const isError =
        message.type() === 'error' && !NETWORK_FAILURE.test(text) && !VERCEL_ONLY_SCRIPT.test(text);
      const isHydrationWarning = message.type() === 'warning' && HYDRATION.test(text);
      if (isError || isHydrationWarning) problems.push(`${message.type()}: ${text}`);
    });
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

    const main = await openHome(page);
    await expectTilesSettled(main);
    await openPaletteFromHero(page, main);

    expect(problems).toEqual([]);
  });
});

test.describe('home bento without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test("shows the hero at once, and the HTML holds every tile's content", async ({
    browser,
    page,
  }) => {
    const expected = await hydratedHeadings(browser);
    expect(expected.map((slot) => slot.area)).toEqual([...BENTO_AREAS]);

    const response = await page.goto(urlOf());
    expect(response?.status()).toBe(200);
    const main = page.locator(MAIN);

    // The hero has no Suspense of its own, so its h1 and links are in the first flush.
    await expectOpaque(main.locator('h1'), 'the h1');
    await expectOneHeroHeading(page, main);
    await expect(main.getByRole('link', { name: FIRST_HERO_LINK, exact: true })).toBeVisible();

    // Each slot is in the first flush too, holding its tile or, until JavaScript, its skeleton.
    for (const area of BENTO_AREAS) await expect(slotOf(main, area)).toBeVisible();
    expect(await missingHeadings(page, expected), 'tile content missing from the HTML').toEqual([]);
  });
});
