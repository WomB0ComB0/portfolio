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
 * @file The bookshelf's browser budgets, on the real data: what jsdom cannot measure. The
 * deterministic budgets (payload per page, stage DOM, jump commits) are in
 * tests/unit/bookshelf/scale-budgets.test.ts.
 * - Cover bytes on first load (cdn.sanity.io response bodies after networkidle): /bookshelf at
 *   1440 x 900 at most 200 KB at DPR 1 and 450 KB at DPR 2; at 375 x 812, DPR 3, at most 250 KB;
 *   the largest shelf's page at most 120 KB, and at most 7 cover requests at 1440 x 900 (its lazy
 *   covers off the stage stay unloaded: the server's HTML already places every book).
 * - The books are the height measureStage gives them (within 1 px) at 375, 768 and 1440 px wide,
 *   in the server's HTML (JavaScript off) and after hydration: the CSS --book-h is the same
 *   formula, so nothing resizes when the stage hydrates; and no two books share a place.
 * - CLS on /bookshelf at most 0.1 at 1440 x 900 and 375 x 740, the worst of 3 loads (largest
 *   session window of layout shifts without recent input; like the places specs, a shift of the
 *   shell's light rays alone is left out: it is on every page and not the bookshelf's to fix).
 * - At 375 x 740: the shelf chip group at most 48 px tall with its real chips and with chips
 *   cloned to 41; the stage's top at most 560 px; the chip pill transitions neither width nor
 *   height (nor `all`); once the last chip is chosen it sits inside the chip row's visible box,
 *   and the page has not scrolled.
 * - No horizontal page overflow at 375 x 740 or 1440 x 900.
 * - Clicking the shelf chip farthest from the first book puts that shelf's first book in the
 *   live region within 400 ms.
 * - At 1440 x 900 the ring cursor's disc and the slot shadow transition transform (never width,
 *   height or `all`) for a real duration, and a book opened in place wipes in; under reduced
 *   motion the ring sits on the pointer a frame after it moves and the detail does not wipe.
 *
 * How it runs. No CI job runs e2e/performance: build.yml runs Vitest only, and a11y.yml runs
 * e2e/accessibility with its own config. This file runs ONLY when PLAYWRIGHT_TEST_BASE_URL names a
 * server, and only in the `chromium` project (it opens its own contexts, and the layout-shift
 * API is Chromium's); otherwise every test is skipped, so `bun run e2e:ci` and a plain
 * `bunx playwright test` skip it. Against a dev server (port 3000, or a page that loads the
 * hot-reload client or the dev overlay) the byte and CLS budgets are skipped: development
 * builds are neither sized nor laid out like production. Measure a local production build:
 *
 *   bun run build
 *   bunx next start -p 4317
 *   PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:4317 \
 *     bunx playwright test e2e/performance/bookshelf-budgets.spec.ts --project=chromium
 *
 * (The main config still starts, or reuses, its dev server on :3000, as for every spec it runs;
 * these checks never use it.) Every context only reads: requests other than GET and HEAD are
 * aborted, and service workers are blocked.
 */

import {
  type APIRequestContext,
  type Browser,
  type BrowserContextOptions,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test';

import {
  type ApiBook,
  desktop,
  LIVE,
  LIVE_TEXT,
  MAIN,
  openStage,
  phone,
  SHELF_GROUP,
  STAGE,
  tablet,
} from '../fixtures/bookshelf';
import { readOnly } from '../fixtures/console-routes';

/** The server to measure. Unset, every test here is skipped. */
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL?.trim() ?? '';
/** The one project this file runs in: every test opens its own context. */
const ONE_PROJECT = 'chromium';
/** The port of the main config's dev server, never a production build. */
const DEV_SERVER_PORT = '3000';
/** What only a development page loads: the hot-reload client and React Refresh. */
const DEV_ONLY_RESOURCE = /hmr|react-refresh/i;
const SANITY_CDN_HOST = 'cdn.sanity.io';

const KB = 1000;
const BUDGET = {
  desktopCoverBytesDpr1: 200 * KB,
  desktopCoverBytesDpr2: 450 * KB,
  phoneCoverBytesDpr3: 250 * KB,
  shelfPageCoverBytes: 120 * KB,
  shelfPageCoverRequests: 7,
  cls: 0.1,
  bookHeightTolerancePx: 1,
  chipGroupHeightPx: 48,
  stageTopPx: 560,
  jumpMs: 400,
} as const;
/** CLS is the worst of this many fresh loads. */
const CLS_LOADS = 3;
/** The chip count the group must still fit in one row at: 40 shelves and All. */
const CLONED_CHIP_COUNT = 41;
/** CLS session windows (web-vitals): a gap of 1 s ends one, and none runs past 5 s. */
const SESSION_GAP_MS = 1000;
const SESSION_MAX_MS = 5000;
/** Transitions that move layout instead of the compositor. */
const LAYOUT_TRANSITIONS: readonly string[] = ['all', 'width', 'height'];

/** A shelf chip in the 'Shelves' group (SHELF_GROUP). */
const SHELF_CHIP = 'button';
const CHIP_COUNT = '[class*="track-count"]';
const PILL = '[class*="track-pill"]';
/** The shell's light rays, behind every page. */
const LIGHT_RAYS = '.light-rays';
/** The ring cursor's layer (it follows the pointer) and the disc it scales (bookshelf-stage). */
const CURSOR_LAYER = '[class*="cursor-layer"]';
const CURSOR_DISC = '[class*="cursor-disc"]';
/** The shadow under each book slot (bookshelf-book-slot.module.css). */
const SLOT_SHADOW = '[class*="slot-shadow"]';
/** The in-page detail's revealed blocks: each sets its wipe's delay, --d, inline. */
const REVEAL_BLOCK = `${MAIN} [style*="--d"]`;

/** A shelf as /api/v1/sanity/bookshelves answers it. */
interface ApiShelf {
  readonly _id?: string;
  readonly slug?: { readonly current?: string } | null;
}

/** A shelf chip in shelf order (All is chip 0), with the book count it shows. */
interface ShelfChip {
  readonly index: number;
  readonly count: number;
}

const urlOf = (path: string): string => `${BASE_URL}${path}`;

/** True when BASE_URL is a dev server: port 3000, or `page` loaded what only development does. */
async function isDevServer(page: Page): Promise<boolean> {
  if (new URL(BASE_URL).port === DEV_SERVER_PORT) return true;
  return page.evaluate(
    (devOnly) =>
      document.querySelector('nextjs-portal') !== null ||
      performance
        .getEntriesByType('resource')
        .some((entry) => new RegExp(devOnly).test(entry.name)),
    DEV_ONLY_RESOURCE.source,
  );
}

/** Opens a read-only page in a fresh context (empty cache) with `options`, and runs `use`. */
async function withPage<T>(
  browser: Browser,
  options: BrowserContextOptions,
  use: (page: Page) => Promise<T>,
): Promise<T> {
  const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    await readOnly(page);
    return await use(page);
  } finally {
    await context.close();
  }
}

/**
 * The cdn.sanity.io response bytes a fresh load of `path` takes, once the network is idle. A cover
 * request that fails or answers with a non-2xx status fails the measurement instead of counting
 * (or vanishing from) the total, and the page must have loaded at least one cover, so a broken
 * CDN can never pass an upper-bound budget with 0 bytes.
 */
async function coverBytes(
  browser: Browser,
  options: BrowserContextOptions,
  path: string,
): Promise<{ readonly bytes: number; readonly requests: number }> {
  return withPage(browser, options, async (page) => {
    const sizes: Promise<number>[] = [];
    const failures: string[] = [];
    const isCover = (url: string): boolean => new URL(url).hostname === SANITY_CDN_HOST;
    page.on('requestfailed', (request) => {
      if (isCover(request.url()))
        failures.push(`${request.failure()?.errorText ?? 'failed'} ${request.url()}`);
    });
    page.on('requestfinished', (request) => {
      if (!isCover(request.url())) return;
      sizes.push(
        request.response().then(async (response) => {
          const status = response?.status() ?? 0;
          if (status < 200 || status >= 300) {
            failures.push(`HTTP ${status} ${request.url()}`);
            return 0;
          }
          return (await request.sizes()).responseBodySize;
        }),
      );
    });
    await openStage(page, BASE_URL, path);
    const bodies = await Promise.all(sizes);
    expect(failures, `cover requests failed while loading ${path}`).toEqual([]);
    expect(bodies.length, `no covers loaded on ${path}`).toBeGreaterThan(0);
    return { bytes: bodies.reduce((sum, size) => sum + size, 0), requests: bodies.length };
  });
}

/** Records the page's CLS as it loads: its largest session window of unprompted shifts. */
async function trackLayoutShifts(page: Page): Promise<void> {
  await page.addInitScript(
    ({ gapMs, maxMs, rays }) => {
      const tracked = window as unknown as { __bookshelfCls: number };
      tracked.__bookshelfCls = 0;
      let session = 0;
      let sessionStart = 0;
      let lastShift = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as {
          readonly value: number;
          readonly hadRecentInput: boolean;
          readonly startTime: number;
          readonly sources?: readonly { readonly node?: Node | null }[];
        }[]) {
          const sources = entry.sources ?? [];
          const raysOnly =
            sources.length > 0 &&
            sources.every((source) => source.node?.parentElement?.closest(rays));
          if (entry.hadRecentInput || raysOnly) continue;
          if (entry.startTime - lastShift > gapMs || entry.startTime - sessionStart > maxMs) {
            session = 0;
            sessionStart = entry.startTime;
          }
          session += entry.value;
          lastShift = entry.startTime;
          tracked.__bookshelfCls = Math.max(tracked.__bookshelfCls, session);
        }
      }).observe({ type: 'layout-shift', buffered: true });
    },
    { gapMs: SESSION_GAP_MS, maxMs: SESSION_MAX_MS, rays: LIGHT_RAYS },
  );
}

/** One fresh load's CLS, once the network, the fonts and two frames have settled. */
async function loadCls(browser: Browser, options: BrowserContextOptions): Promise<number> {
  return withPage(browser, options, async (page) => {
    await trackLayoutShifts(page);
    await openStage(page, BASE_URL);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    return page.evaluate(() => (window as unknown as { __bookshelfCls: number }).__bookshelfCls);
  });
}

/** The slug of the shelf with the most books, from the public JSON (no hard-coded slug). */
async function largestShelfSlug(request: APIRequestContext): Promise<string> {
  const [booksRes, shelvesRes] = await Promise.all([
    request.get(urlOf('/api/v1/sanity/books')),
    request.get(urlOf('/api/v1/sanity/bookshelves')),
  ]);
  expect(booksRes.ok() && shelvesRes.ok(), 'GET the books and shelves JSON').toBe(true);
  const books = (await booksRes.json()) as ApiBook[];
  const shelves = (await shelvesRes.json()) as ApiShelf[];
  const counts = new Map<string, number>();
  for (const book of books) {
    if (book.shelfId) counts.set(book.shelfId, (counts.get(book.shelfId) ?? 0) + 1);
  }
  const countOf = (shelf: ApiShelf | null): number => counts.get(shelf?._id ?? '') ?? 0;
  const largest = shelves
    .filter((shelf) => shelf._id && shelf.slug?.current)
    .reduce<ApiShelf | null>(
      (best, shelf) => (countOf(shelf) > countOf(best) ? shelf : best),
      null,
    );
  const slug = largest?.slug?.current;
  if (!slug) throw new Error('no shelf with books in the public JSON');
  return slug;
}

/** The shelf chips (All first) with their counts, in shelf order. */
async function shelfChips(group: Locator): Promise<readonly ShelfChip[]> {
  return group.locator(SHELF_CHIP).evaluateAll(
    (chips, countSelector) =>
      chips.map((chip, index) => ({
        index,
        count: Number(chip.querySelector(countSelector)?.textContent?.trim() ?? Number.NaN),
      })),
    CHIP_COUNT,
  );
}

let devServer = false;

test.beforeAll(async ({ browser }, testInfo) => {
  // A skip here skips the whole file, before it opens anything.
  test.skip(!BASE_URL, 'set PLAYWRIGHT_TEST_BASE_URL to a production build (see the file header)');
  test.skip(
    testInfo.project.name !== ONE_PROJECT,
    `runs once, in '${ONE_PROJECT}': it opens its own contexts`,
  );
  devServer = await withPage(browser, desktop(1), async (page) => {
    await openStage(page, BASE_URL);
    return isDevServer(page);
  });
});

test.describe('bookshelf cover bytes on first load', () => {
  test.beforeEach(() => {
    test.skip(devServer, 'a dev server does not size or serve covers like production');
  });

  for (const [label, options, budget] of [
    ['1440 x 900 at DPR 1', desktop(1), BUDGET.desktopCoverBytesDpr1],
    ['1440 x 900 at DPR 2', desktop(2), BUDGET.desktopCoverBytesDpr2],
    ['375 x 812 at DPR 3', phone(812), BUDGET.phoneCoverBytesDpr3],
  ] as const) {
    test(`/bookshelf at ${label} loads at most ${budget / KB} KB of covers`, async ({
      browser,
    }) => {
      const { bytes, requests } = await coverBytes(browser, options, '/bookshelf');
      test.info().annotations.push({ type: 'covers', description: `${requests} for ${bytes} B` });
      expect(bytes).toBeLessThanOrEqual(budget);
    });
  }

  test(`the largest shelf's page requests at most ${BUDGET.shelfPageCoverRequests} covers at 1440 x 900`, async ({
    browser,
    request,
  }) => {
    const slug = await largestShelfSlug(request);
    const { bytes, requests } = await coverBytes(browser, desktop(1), `/bookshelf/shelf/${slug}`);
    test.info().annotations.push({ type: 'covers', description: `${requests} for ${bytes} B` });
    expect(requests).toBeLessThanOrEqual(BUDGET.shelfPageCoverRequests);
  });

  test(`the largest shelf's page loads at most ${BUDGET.shelfPageCoverBytes / KB} KB of covers`, async ({
    browser,
    request,
  }) => {
    const slug = await largestShelfSlug(request);
    for (const options of [desktop(2), phone(812)]) {
      const width = options.viewport?.width;
      const { bytes, requests } = await coverBytes(browser, options, `/bookshelf/shelf/${slug}`);
      test.info().annotations.push({
        type: 'covers',
        description: `${slug} at ${width}px: ${requests} for ${bytes} B`,
      });
      expect
        .soft(bytes, `/bookshelf/shelf/${slug} at ${width}px`)
        .toBeLessThanOrEqual(BUDGET.shelfPageCoverBytes);
    }
  });
});

test.describe('bookshelf stage geometry', () => {
  for (const [label, options] of [
    ['375 x 740', phone(740)],
    ['768 x 1024', tablet],
    ['1440 x 900', desktop(1)],
  ] as const) {
    for (const javaScriptEnabled of [false, true]) {
      const html = javaScriptEnabled ? 'after hydration' : "in the server's HTML";
      test(`/bookshelf at ${label} draws the books measureStage's height ${html}`, async ({
        browser,
      }) => {
        await withPage(browser, { ...options, javaScriptEnabled }, async (page) => {
          await openStage(page, BASE_URL);
          const geometry = await page.locator(STAGE).evaluate((stage) => {
            // measureShelf (_lib/shelf-geometry.ts), on the stage's own box.
            const nextH = Math.round(
              Math.max(220, Math.min(stage.clientHeight * 0.84, 410, stage.clientWidth * 0.88)),
            );
            const slots = [...stage.querySelectorAll<HTMLElement>('[data-pool-index]')];
            const centre = stage.getBoundingClientRect().left + stage.clientWidth / 2;
            return {
              nextH,
              heights: slots.map((slot) => Number.parseFloat(getComputedStyle(slot).height)),
              places: slots.map((slot) => {
                const box = slot.getBoundingClientRect();
                return Math.round(box.left + box.width / 2 - centre);
              }),
            };
          });

          expect(geometry.heights.length).toBeGreaterThan(0);
          for (const height of geometry.heights) {
            expect(
              Math.abs(height - geometry.nextH),
              `${height} px against ${geometry.nextH}`,
            ).toBeLessThanOrEqual(BUDGET.bookHeightTolerancePx);
          }
          expect(new Set(geometry.places).size, `book places ${geometry.places.join(', ')}`).toBe(
            geometry.places.length,
          );
        });
      });
    }
  }
});

test.describe('bookshelf layout shift', () => {
  test.beforeEach(() => {
    test.skip(devServer, 'a dev server injects styles and an overlay that shift the page');
  });

  for (const [label, options] of [
    ['1440 x 900', desktop(1)],
    ['375 x 740', phone(740)],
  ] as const) {
    test(`/bookshelf at ${label} keeps CLS at most ${BUDGET.cls} over ${CLS_LOADS} loads`, async ({
      browser,
    }) => {
      const loads: number[] = [];
      for (let load = 0; load < CLS_LOADS; load += 1) loads.push(await loadCls(browser, options));
      test.info().annotations.push({ type: 'cls', description: loads.join(', ') });
      expect(Math.max(...loads)).toBeLessThanOrEqual(BUDGET.cls);
    });
  }
});

test.describe('bookshelf shelf chips on a 375 x 740 phone', () => {
  test('keep one 48 px row at 11 and 41 chips, the stage above 560 px and a compositor pill', async ({
    browser,
  }) => {
    await withPage(browser, phone(740), async (page) => {
      await openStage(page, BASE_URL);
      const group = page.locator(SHELF_GROUP).first();
      await expect(group).toBeVisible();

      const stageTop = await page
        .locator(STAGE)
        .evaluate((stage) => stage.getBoundingClientRect().top + window.scrollY);
      expect.soft(stageTop, 'the stage top').toBeLessThanOrEqual(BUDGET.stageTopPx);

      const realHeight = (await group.boundingBox())?.height ?? Number.POSITIVE_INFINITY;
      expect
        .soft(realHeight, 'the chip group with its real chips')
        .toBeLessThanOrEqual(BUDGET.chipGroupHeightPx);

      const transition = await group
        .locator(PILL)
        .first()
        .evaluate((pill) => getComputedStyle(pill).transitionProperty);
      const animated = transition.split(',').map((property) => property.trim());
      expect
        .soft(
          animated.filter((property) => LAYOUT_TRANSITIONS.includes(property)),
          `the pill's transition-property (${transition})`,
        )
        .toEqual([]);

      await group.evaluate(
        (element, { total, chipSelector }) => {
          const chips = element.querySelectorAll(chipSelector);
          const last = chips[chips.length - 1];
          if (!last) return;
          for (let count = chips.length; count < total; count += 1) {
            element.appendChild(last.cloneNode(true));
          }
        },
        { total: CLONED_CHIP_COUNT, chipSelector: SHELF_CHIP },
      );
      await expect(group.locator(SHELF_CHIP)).toHaveCount(CLONED_CHIP_COUNT);
      const clonedHeight = (await group.boundingBox())?.height ?? Number.POSITIVE_INFINITY;
      expect(clonedHeight, `the chip group with ${CLONED_CHIP_COUNT} chips`).toBeLessThanOrEqual(
        BUDGET.chipGroupHeightPx,
      );
    });
  });
});

test.describe('bookshelf chip row and page width', () => {
  test('keeps the chosen last chip in view in a 375 px row, without scrolling the page', async ({
    browser,
  }) => {
    await withPage(browser, phone(740), async (page) => {
      await openStage(page, BASE_URL);
      const group = page.locator(SHELF_GROUP).first();
      const last = group.locator(SHELF_CHIP).last();
      // Scrolled down a little, so a page scroll would show; the row back at its start.
      await page.evaluate(() => window.scrollTo({ top: 120, behavior: 'instant' }));
      await group.evaluate((row) => {
        row.scrollLeft = 0;
      });
      const scrollY = await page.evaluate(() => window.scrollY);

      // A DOM click: Playwright's own click would first scroll the chip into view itself.
      await last.evaluate((chip) => (chip as HTMLElement).click());
      await expect(last).toHaveAttribute('aria-pressed', 'true');

      await expect
        .poll(() =>
          last.evaluate((chip) => {
            const row = chip.parentElement?.getBoundingClientRect();
            const box = chip.getBoundingClientRect();
            return Boolean(row && box.left >= row.left - 0.5 && box.right <= row.right + 0.5);
          }),
        )
        .toBe(true);
      expect(await page.evaluate(() => window.scrollY), 'the page scroll').toBe(scrollY);
    });
  });

  for (const [label, options] of [
    ['375 x 740', phone(740)],
    ['1440 x 900', desktop(1)],
  ] as const) {
    test(`/bookshelf at ${label} has no horizontal page overflow`, async ({ browser }) => {
      await withPage(browser, options, async (page) => {
        await openStage(page, BASE_URL);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    });
  }
});

/** The middle of the stage, in whole px, where the active book stands. */
async function stageCentre(page: Page): Promise<{ readonly x: number; readonly y: number }> {
  const box = await page.locator(STAGE).boundingBox();
  if (!box) throw new Error('the stage has no box');
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}

/** `selector`'s first element's transition: its properties, and the time `transform` takes. */
async function transitionOf(
  page: Page,
  selector: string,
): Promise<{ readonly properties: readonly string[]; readonly transformDuration?: string }> {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const properties = style.transitionProperty.split(',').map((name) => name.trim());
      const durations = style.transitionDuration.split(',').map((time) => time.trim());
      const at = properties.indexOf('transform');
      return { properties, transformDuration: at < 0 ? undefined : durations[at] };
    });
}

/** Opens the book on stage in place, from the keyboard: its detail wipes in block by block. */
async function openBookInPlace(page: Page): Promise<Locator> {
  await page.locator(STAGE).focus();
  await page.keyboard.press('Enter');
  const block = page.locator(REVEAL_BLOCK).first();
  await expect(block).toBeVisible();
  return block;
}

test.describe('bookshelf motion on a 1440 x 900 desktop', () => {
  test('moves the ring cursor and the slot shadow on the compositor, and wipes the detail in', async ({
    browser,
  }) => {
    await withPage(browser, desktop(1), async (page) => {
      await openStage(page, BASE_URL);
      const { x, y } = await stageCentre(page);
      await page.mouse.move(x, y);
      await expect(page.locator(CURSOR_DISC).first()).toBeAttached();

      for (const [label, selector] of [
        ['the ring disc', CURSOR_DISC],
        ['a slot shadow', SLOT_SHADOW],
      ] as const) {
        const { properties, transformDuration } = await transitionOf(page, selector);
        expect.soft(properties, `${label} transitions transform`).toContain('transform');
        expect
          .soft(
            properties.filter((property) => LAYOUT_TRANSITIONS.includes(property)),
            `${label}'s transition-property (${properties.join(', ')})`,
          )
          .toEqual([]);
        expect.soft(transformDuration, `${label}'s transform duration`).not.toBe('0s');
      }

      const block = await openBookInPlace(page);
      expect(await block.evaluate((element) => getComputedStyle(element).animationName)).toMatch(
        /rv-wipe/,
      );
    });
  });

  test('under reduced motion, puts the ring on the pointer and the detail in place at once', async ({
    browser,
  }) => {
    await withPage(browser, { ...desktop(1), reducedMotion: 'reduce' }, async (page) => {
      await openStage(page, BASE_URL);
      const { x, y } = await stageCentre(page);
      await page.mouse.move(x - 120, y);
      await page.mouse.move(x, y);

      // Two frames: the move lands, then the cursor loop draws it.
      const transform = await page.evaluate(
        (selector) =>
          new Promise<string>((resolve) => {
            requestAnimationFrame(() =>
              requestAnimationFrame(() =>
                resolve(document.querySelector<HTMLElement>(selector)?.style.transform ?? ''),
              ),
            );
          }),
        CURSOR_LAYER,
      );
      expect(transform, 'the ring, a frame after the pointer moved').toBe(
        `translate3d(${x}px, ${y}px, 0px)`,
      );

      const block = await openBookInPlace(page);
      expect(await block.evaluate((element) => getComputedStyle(element).animationName)).toBe(
        'none',
      );
    });
  });
});

test.describe('bookshelf jump on the real data', () => {
  test(`puts the farthest shelf's first book on stage within ${BUDGET.jumpMs} ms of its chip`, async ({
    browser,
  }) => {
    await withPage(browser, desktop(1), async (page) => {
      await openStage(page, BASE_URL);
      const live = page.locator(LIVE);
      const [, firstLabel, total] = LIVE_TEXT.exec((await live.textContent()) ?? '') ?? [];
      const bookCount = Number(total);
      expect(Number(firstLabel), 'the first book is on stage').toBe(1);

      // Chip 0 is All; each shelf starts where the shelves before it end.
      const group = page.locator(SHELF_GROUP).first();
      const shelves = (await shelfChips(group)).slice(1);
      const starts = shelves.map((_, at) =>
        shelves.slice(0, at).reduce((sum, shelf) => sum + shelf.count, 0),
      );
      const distance = (start: number): number => Math.min(start, bookCount - start);
      const farthestAt = starts.reduce(
        (best, start, at) => (distance(start) > distance(starts[best] ?? 0) ? at : best),
        0,
      );
      const farthest = shelves[farthestAt];
      if (!farthest) throw new Error('no shelf chips');
      const targetStart = starts[farthestAt] ?? 0;
      const targetLabel = String(targetStart + 1).padStart(2, '0');

      await page.evaluate((liveSelector) => {
        const tracked = window as unknown as {
          __clickAt: number;
          __liveAt: Record<string, number>;
        };
        tracked.__liveAt = {};
        document.addEventListener(
          'click',
          () => {
            tracked.__clickAt = performance.now();
          },
          { capture: true, once: true },
        );
        const region = document.querySelector(liveSelector);
        if (!region) return;
        new MutationObserver(() => {
          const label = /^(\d+) of /.exec(region.textContent ?? '')?.[1];
          if (label && tracked.__liveAt[label] === undefined) {
            tracked.__liveAt[label] = performance.now();
          }
        }).observe(region, { childList: true, characterData: true, subtree: true });
      }, LIVE);

      await group.locator(SHELF_CHIP).nth(farthest.index).click();
      await expect(live).toHaveText(new RegExp(`^${targetLabel} of ${bookCount}: `));

      const elapsed = await page.evaluate((label) => {
        const tracked = window as unknown as {
          __clickAt: number;
          __liveAt: Record<string, number>;
        };
        return (tracked.__liveAt[label] ?? Number.POSITIVE_INFINITY) - tracked.__clickAt;
      }, targetLabel);
      test.info().annotations.push({
        type: 'jump',
        description: `${distance(targetStart)} books in ${Math.round(elapsed)} ms`,
      });
      expect(elapsed).toBeLessThanOrEqual(BUDGET.jumpMs);
    });
  });
});
