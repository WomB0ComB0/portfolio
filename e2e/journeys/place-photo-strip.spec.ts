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
 * @file /places/[placeId]'s photo strip (the owner's pick B in the Aceternity lab review) on a
 * real past place: the past place with the most photos, read from /api/v1/sanity/places (it needs
 * at least 8, so a phone's strip has to scroll). Nothing hard-codes the place or its count, and
 * every request is a GET (each context aborts anything else).
 * - 1440: one row of thumbnails, one per photo, named "Photo n of N", the first current, inside
 *   the frame's edges and centred; no sideways page scroll; each a 320 x 240 Sanity crop.
 * - Pointing at another photo dims the rest (the shown one too) to 0.55 and lights and lifts only
 *   that one; crossing a gap never brightens the others (the dim lifts 60 ms late), with or
 *   without reduced motion; a click shows the photo and says so in the header, and never scrolls
 *   the page.
 * - The keyboard: one Tab stop (the shown photo, after the frame's controls); Right, Left, Home
 *   and End move the focus without changing the photo; Enter and Space show it; the focused one
 *   is lit at once and never lifts, and its ring has room inside the scroller; Tab leaves.
 * - Reduced motion: the light without the lift.
 * - 390 (touch): a sideways strip of 104 px thumbnails, no dimming and no lift; tapping a
 *   thumbnail cut off at the strip's edge shows it and centres it inside the strip without
 *   scrolling the page.
 * - Load and hydration move nothing in the place card at either width; without JavaScript the
 *   first photo shows and the strip (whose buttons could not work) is not drawn.
 *
 * Each check waits until no streamed segment is hidden and nothing in main is aria-busy (as
 * shell-grid.spec.ts does), the fonts are in and the strip is hydrated, before it measures.
 * The file runs in the 'chromium' project only and is skipped in the others: each test opens its
 * own 1440 or 390 context.
 */

import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';

const STRIP = '[data-photo-strip]';
/** The photo frame: the viewer's 16:9 box. */
const FRAME = 'main .aspect-video';
/** A streamed segment not revealed yet, or a skeleton marked busy (shell-grid.spec.ts). */
const PENDING_CONTENT = 'div[hidden][id^="S:"], main [aria-busy="true"]';

/**
 * The one project this file runs in. Every test opens its own 1440 or 390 context, so another
 * project adds nothing: a touch project ('Mobile Chrome') would lend the 1440 contexts its touch
 * screen and mobile user agent, and Firefox cannot open the phone's (isMobile) context.
 */
const ONE_PROJECT = 'chromium';

/** A mouse and a desktop screen, whatever the project's own device. */
const DESKTOP: BrowserContextOptions = {
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
};
const PHONE: BrowserContextOptions = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};

/** Enough photos that 104 px thumbnails overflow a 390 px phone's strip. */
const MIN_PHOTOS = 8;
const DIM = 0.55;
/** The tiles' lift, as getComputedStyle reports `translate: 0 -3px`. */
const LIFTED = '0px -3px';
const REM_PX = 16;
const MIN_THUMB_PX = 4.5 * REM_PX;
const MAX_THUMB_PX = 10 * REM_PX;
const PHONE_THUMB_PX = 104;
/** The focus ring: a 2 px outline 2 px out. */
const RING_PX = 4;
/** Sub-pixel rounding. */
const SAME_PX = 1;

interface ApiPlace {
  readonly _id: string;
  readonly name: string;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly photos?: ReadonlyArray<{ readonly asset?: { readonly _ref?: string } } | null> | null;
}

interface PastPlace {
  readonly id: string;
  readonly name: string;
  readonly photos: number;
}

interface Layers {
  readonly current: boolean;
  /** The shown photo's rim (::before). */
  readonly rim: number;
  /** The canvas dim (::after). */
  readonly dim: number;
  /** The tile hover's light (the light span's ::before). */
  readonly light: number;
  readonly lift: string;
  readonly tabIndex: number;
}

let place: PastPlace;

/** The past place (its last day before today) with the most photos; never one still going on. */
test.beforeAll(async ({ playwright }, testInfo) => {
  // A skip here skips the whole file in that project, before it asks the API anything.
  test.skip(
    testInfo.project.name !== ONE_PROJECT,
    `runs once, in '${ONE_PROJECT}': it opens its own 1440 and 390 contexts`,
  );
  const api = await playwright.request.newContext();
  try {
    const response = await api.get(`${getTargetUrl()}/api/v1/sanity/places`);
    expect(response.ok(), 'GET /api/v1/sanity/places').toBe(true);
    const today = new Date().toISOString().slice(0, 10);
    const past = ((await response.json()) as ApiPlace[])
      .map((candidate) => ({
        id: candidate._id,
        name: candidate.name,
        photos: (candidate.photos ?? []).filter((photo) => photo?.asset?._ref).length,
        lastDay: (candidate.endDate ?? candidate.startDate ?? '').slice(0, 10),
      }))
      .filter((candidate) => candidate.lastDay !== '' && candidate.lastDay < today)
      .sort((a, b) => b.photos - a.photos);
    const [best] = past;
    expect(
      best?.photos ?? 0,
      `a past place with ${MIN_PHOTOS} or more photos`,
    ).toBeGreaterThanOrEqual(MIN_PHOTOS);
    place = { id: best?.id ?? '', name: best?.name ?? '', photos: best?.photos ?? 0 };
  } finally {
    await api.dispose();
  }
});

/** A context that sends nothing but GET and HEAD, opened on the place page. */
async function openPlace(
  browser: Browser,
  options: BrowserContextOptions,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(options);
  await context.route('**/*', (route) =>
    ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort(),
  );
  const page = await context.newPage();
  const response = await page.goto(`${getTargetUrl()}/places/${encodeURIComponent(place.id)}`);
  expect(response?.status()).toBe(200);
  await expect(page.locator('main#main-content')).toBeVisible();
  await expect(page.locator(PENDING_CONTENT)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}

/** Hydrated: the strip's buttons carry React's props. */
async function hydrated(page: Page): Promise<Locator> {
  await page.waitForFunction((selector) => {
    const button = document.querySelector(`${selector} button`);
    return button !== null && Object.keys(button).some((key) => key.startsWith('__reactProps'));
  }, STRIP);
  return page.getByRole('toolbar', { name: `Photos of ${place.name}` });
}

const thumbs = (strip: Locator): Locator => strip.getByRole('button');

/** Every thumbnail's layers and state, in order. */
const layers = (strip: Locator): Promise<Layers[]> =>
  thumbs(strip).evaluateAll((buttons) =>
    buttons.map((button) => ({
      current: button.getAttribute('aria-current') === 'true',
      rim: Number(getComputedStyle(button, '::before').opacity),
      dim: Number(getComputedStyle(button, '::after').opacity),
      light: Number(getComputedStyle(button.querySelector('span') ?? button, '::before').opacity),
      lift: getComputedStyle(button).translate,
      tabIndex: (button as HTMLButtonElement).tabIndex,
    })),
  );

/** Waits for the transitions to settle on what `expected` says of thumbnail `index` and the rest. */
async function settleOn(
  strip: Locator,
  index: number,
  expected: { mine: Partial<Layers>; others: Partial<Layers> },
): Promise<Layers[]> {
  await expect
    .poll(async () => {
      const all = await layers(strip);
      return all.every((layer, i) =>
        Object.entries(i === index ? expected.mine : expected.others).every(
          ([key, value]) => layer[key as keyof Layers] === value,
        ),
      );
    })
    .toBe(true);
  return layers(strip);
}

/** The Sanity file behind a next/image src (its /_next/image?url=…), by path. */
const sanityPath = (src: string | null, base: string): string => {
  const optimised = new URL(src ?? '', base);
  return new URL(optimised.searchParams.get('url') ?? optimised.href).pathname;
};

/** The frame's photo once the slide has finished (one image left in the frame). */
async function framePhotoPath(page: Page): Promise<string> {
  const images = page.locator(`${FRAME} img`);
  await expect(images).toHaveCount(1);
  return sanityPath(await images.getAttribute('src'), page.url());
}

const centre = (box: { x: number; y: number; width: number; height: number }) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

/** Waits one rendered frame, so a pointer move paces like a real one. */
const nextFrame = (page: Page): Promise<void> =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

/** Layout shifts (not caused by input) whose sources lie in the place card, recorded from load. */
async function recordShifts(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const found: { value: number; sources: string[] }[] = [];
    (window as unknown as { __cardShifts: typeof found }).__cardShifts = found;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
        sources?: { node?: Node | null }[];
      }[]) {
        if (entry.hadRecentInput) continue;
        const sources = (entry.sources ?? [])
          .map((source) => source.node)
          .filter((node): node is Element => node instanceof Element)
          .filter((node) => node.closest('main') !== null);
        if (sources.length > 0) {
          found.push({
            value: entry.value,
            sources: sources.map((node) => `${node.tagName}.${node.className}`.slice(0, 80)),
          });
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

test.describe('/places/[placeId]: the photo strip at 1440', () => {
  test('one row of named thumbnails, the first shown, inside the frame and centred', async ({
    browser,
  }) => {
    const { context, page } = await openPlace(browser, DESKTOP);
    const strip = await hydrated(page);
    const count = place.photos;

    await expect(thumbs(strip)).toHaveCount(count);
    const names = await thumbs(strip).evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute('aria-label') ?? ''),
    );
    names.forEach((name, i) => {
      expect(name).toMatch(new RegExp(`^Photo ${i + 1} of ${count}(?:: .+)?$`));
    });
    expect((await layers(strip)).map((layer) => layer.current)).toEqual(
      Array.from({ length: count }, (_, i) => i === 0),
    );
    await expect(page.getByText(`Photo 1 of ${count}`, { exact: true })).toBeVisible();

    const geometry = await page.evaluate(
      ({ stripSelector, frameSelector }) => {
        const stripElement = document.querySelector(stripSelector) as HTMLElement;
        const frame = document.querySelector(frameSelector)?.getBoundingClientRect();
        const boxes = [...stripElement.querySelectorAll('button')].map((b) =>
          b.getBoundingClientRect(),
        );
        return {
          tops: boxes.map((box) => box.top),
          widths: boxes.map((box) => box.width),
          ratios: boxes.map((box) => box.width / box.height),
          first: boxes[0]?.left ?? 0,
          last: boxes.at(-1)?.right ?? 0,
          frameLeft: frame?.left ?? 0,
          frameRight: frame?.right ?? 0,
          scrolls: stripElement.scrollWidth > stripElement.clientWidth,
          pageScroll: document.documentElement.scrollWidth - document.body.clientWidth,
        };
      },
      { stripSelector: STRIP, frameSelector: FRAME },
    );
    const [top] = geometry.tops;
    for (const each of geometry.tops) expect(Math.abs(each - (top ?? 0))).toBeLessThan(SAME_PX);
    for (const ratio of geometry.ratios) expect(ratio).toBeCloseTo(4 / 3, 1);
    for (const width of geometry.widths) {
      expect(width).toBeGreaterThanOrEqual(MIN_THUMB_PX - SAME_PX);
      expect(width).toBeLessThanOrEqual(MAX_THUMB_PX + SAME_PX);
    }
    expect(geometry.pageScroll, 'the page scrolls sideways').toBeLessThanOrEqual(0);
    if (geometry.scrolls) {
      // Only when the thumbnails are at their 4.5 rem floor does the row scroll.
      for (const width of geometry.widths) expect(width).toBeLessThan(MIN_THUMB_PX + SAME_PX);
    } else {
      expect(geometry.first).toBeGreaterThanOrEqual(geometry.frameLeft - SAME_PX);
      expect(geometry.last).toBeLessThanOrEqual(geometry.frameRight + SAME_PX);
      // Centred: as much room on each side.
      expect(
        Math.abs(geometry.first - geometry.frameLeft - (geometry.frameRight - geometry.last)),
      ).toBeLessThanOrEqual(SAME_PX);
    }

    // Each thumbnail is the photo's own 320 x 240 crop, in the best format.
    const sources = await thumbs(strip).evaluateAll((buttons) =>
      buttons.map((button) => button.querySelector('img')?.getAttribute('src') ?? ''),
    );
    for (const src of sources) {
      const sanity = new URL(new URL(src, page.url()).searchParams.get('url') ?? '');
      expect(sanity.hostname).toBe('cdn.sanity.io');
      expect(sanity.searchParams.get('w')).toBe('320');
      expect(sanity.searchParams.get('h')).toBe('240');
      expect(sanity.searchParams.get('fit')).toBe('crop');
      expect(sanity.searchParams.get('auto')).toBe('format');
    }
    await context.close();
  });

  test('pointing at a photo dims the rest, the shown one too, and lights and lifts only it', async ({
    browser,
  }) => {
    const { context, page } = await openPlace(browser, DESKTOP);
    const strip = await hydrated(page);
    await strip.scrollIntoViewIfNeeded();
    const pointed = 5;

    const atRest = await layers(strip);
    expect(atRest.map((layer) => [layer.rim, layer.dim, layer.light])).toEqual(
      atRest.map((_, i) => [i === 0 ? 1 : 0, 0, 0]),
    );

    const box = await thumbs(strip).nth(pointed).boundingBox();
    if (!box) throw new Error('no box for the thumbnail pointed at');
    await page.mouse.move(centre(box).x, centre(box).y);
    const lit = await settleOn(strip, pointed, {
      mine: { dim: 0, light: 1, lift: LIFTED },
      others: { dim: DIM, light: 0 },
    });

    // The shown photo keeps its rim, dimmed with the rest; it does not lift.
    expect(lit[0]).toMatchObject({ current: true, rim: 1, dim: DIM, light: 0, lift: 'none' });
    await context.close();
  });

  // Under reduced motion too: the dim switches rather than fades there, so a gap without the
  // 60 ms delay would flash the whole strip to full brightness.
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    test(`crossing the gap between two thumbnails never brightens the others (motion: ${reducedMotion})`, async ({
      browser,
    }) => {
      await crossTheGap(browser, reducedMotion);
    });
  }

  async function crossTheGap(
    browser: Browser,
    reducedMotion: 'no-preference' | 'reduce',
  ): Promise<void> {
    const { context, page } = await openPlace(browser, { ...DESKTOP, reducedMotion });
    const strip = await hydrated(page);
    await strip.scrollIntoViewIfNeeded();
    const from = 5;
    const to = 6;
    const fromBox = await thumbs(strip).nth(from).boundingBox();
    const toBox = await thumbs(strip).nth(to).boundingBox();
    if (!fromBox || !toBox) throw new Error('no boxes for the two thumbnails');
    const y = centre(fromBox).y;
    await page.mouse.move(centre(fromBox).x, y);
    await settleOn(strip, from, { mine: { light: 1 }, others: { dim: DIM } });

    await page.evaluate((selector) => {
      const buttons = [...document.querySelectorAll(`${selector} button`)];
      const record = window as unknown as { __dims: number[][]; __sampling: boolean };
      record.__dims = [];
      record.__sampling = true;
      const tick = () => {
        if (!record.__sampling) return;
        record.__dims.push(buttons.map((b) => Number(getComputedStyle(b, '::after').opacity)));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, STRIP);
    // To the middle of the gap, two frames there (under the 60 ms delay), then on to the next.
    const gap = (fromBox.x + fromBox.width + toBox.x) / 2;
    await page.mouse.move(gap, y, { steps: 6 });
    await nextFrame(page);
    await nextFrame(page);
    await page.mouse.move(centre(toBox).x, y, { steps: 6 });
    await settleOn(strip, to, { mine: { light: 1, dim: 0 }, others: { dim: DIM } });
    const samples = await page.evaluate(() => {
      const record = window as unknown as { __dims: number[][]; __sampling: boolean };
      record.__sampling = false;
      return record.__dims;
    });

    expect(samples.length).toBeGreaterThan(3);
    const others = samples.flatMap((row) => row.filter((_, i) => i !== from && i !== to));
    expect(Math.min(...others), 'another thumbnail brightened in the gap').toBeGreaterThanOrEqual(
      DIM - 0.001,
    );

    // Leaving the strip, the dim lifts after its 60 ms delay.
    await page.mouse.move(centre(toBox).x, y - 300);
    await expect
      .poll(() =>
        thumbs(strip)
          .nth(0)
          .evaluate((button) => getComputedStyle(button, '::after').transitionDelay),
      )
      .toBe('0.06s');
    await settleOn(strip, to, { mine: { dim: 0, light: 0 }, others: { dim: 0 } });
    await context.close();
  }

  test('a click shows the photo and says so in the header, without scrolling the page', async ({
    browser,
  }) => {
    const { context, page } = await openPlace(browser, DESKTOP);
    const strip = await hydrated(page);
    await strip.scrollIntoViewIfNeeded();
    const picked = place.photos - 2;
    const target = thumbs(strip).nth(picked);
    const wanted = sanityPath(await target.locator('img').getAttribute('src'), page.url());
    const scrollY = await page.evaluate(() => window.scrollY);

    await target.click();

    await expect(
      page.getByText(`Photo ${picked + 1} of ${place.photos}`, { exact: true }),
    ).toBeVisible();
    await expect(target).toHaveAttribute('aria-current', 'true');
    await expect(strip.locator('[aria-current="true"]')).toHaveCount(1);
    expect(await framePhotoPath(page)).toBe(wanted);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    await context.close();
  });

  test('the keyboard: one Tab stop, arrows move, Enter and Space show, Tab leaves', async ({
    browser,
  }) => {
    const { context, page } = await openPlace(browser, DESKTOP);
    const strip = await hydrated(page);
    const count = place.photos;
    const focusedName = () =>
      page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    const inStrip = () =>
      page.evaluate((selector) => Boolean(document.activeElement?.closest(selector)), STRIP);

    // After the frame's own controls, the strip is one stop: the photo shown.
    await page.getByRole('button', { name: 'Enter fullscreen' }).focus();
    await page.keyboard.press('Tab');
    expect(await focusedName()).toBe(`Photo 1 of ${count}`);
    expect((await layers(strip)).filter((layer) => layer.tabIndex === 0)).toHaveLength(1);

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await focusedName()).toMatch(new RegExp(`^Photo 3 of ${count}`));
    await expect(thumbs(strip).nth(0)).toHaveAttribute('aria-current', 'true');
    // Lit at once, never lifted; the rest dim, the shown one too.
    const focused = await settleOn(strip, 2, {
      mine: { light: 1, dim: 0, lift: 'none' },
      others: { dim: DIM, light: 0 },
    });
    expect(focused[0]).toMatchObject({ current: true, rim: 1 });

    await page.keyboard.press('Enter');
    await expect(thumbs(strip).nth(2)).toHaveAttribute('aria-current', 'true');
    await expect(page.getByText(`Photo 3 of ${count}`, { exact: true })).toBeVisible();

    // The focus ring has room inside the scroller, at both ends of the row.
    for (const [key, index] of [
      ['End', count - 1],
      ['Home', 0],
    ] as const) {
      await page.keyboard.press(key);
      expect(await focusedName()).toMatch(new RegExp(`^Photo ${index + 1} of ${count}`));
      await expect
        .poll(() =>
          page.evaluate(
            ({ selector, at, ring }) => {
              const scroller = document.querySelector(selector) as HTMLElement;
              const outer = scroller.getBoundingClientRect();
              const box = scroller.querySelectorAll('button')[at]?.getBoundingClientRect();
              if (!box) return false;
              return (
                box.top - ring >= outer.top - 0.5 &&
                box.bottom + ring <= outer.bottom + 0.5 &&
                box.left - ring >= outer.left - 0.5 &&
                box.right + ring <= outer.right + 0.5
              );
            },
            { selector: STRIP, at: index, ring: RING_PX },
          ),
        )
        .toBe(true);
    }

    await page.keyboard.press(' ');
    await expect(thumbs(strip).nth(0)).toHaveAttribute('aria-current', 'true');
    await expect(page.getByText(`Photo 1 of ${count}`, { exact: true })).toBeVisible();

    await page.keyboard.press('Tab');
    expect(await inStrip()).toBe(false);
    await page.keyboard.press('Shift+Tab');
    expect(await focusedName()).toBe(`Photo 1 of ${count}`);
    await context.close();
  });

  test('reduced motion: the light and the dim, without the lift', async ({ browser }) => {
    const { context, page } = await openPlace(browser, { ...DESKTOP, reducedMotion: 'reduce' });
    const strip = await hydrated(page);
    await strip.scrollIntoViewIfNeeded();
    const box = await thumbs(strip).nth(3).boundingBox();
    if (!box) throw new Error('no box for the thumbnail');

    await page.mouse.move(centre(box).x, centre(box).y);

    await settleOn(strip, 3, {
      mine: { light: 1, dim: 0, lift: 'none' },
      others: { dim: DIM, lift: 'none' },
    });
    await context.close();
  });
});

test.describe('/places/[placeId]: the photo strip on a 390 px phone', () => {
  test('a sideways strip of 104 px thumbnails, with no dimming and no lift', async ({
    browser,
  }) => {
    const { context, page } = await openPlace(browser, PHONE);
    const strip = await hydrated(page);

    const geometry = await strip.evaluate((element) => ({
      widths: [...element.querySelectorAll('button')].map((b) => b.getBoundingClientRect().width),
      tops: [...element.querySelectorAll('button')].map((b) => b.getBoundingClientRect().top),
      scrolls: element.scrollWidth > element.clientWidth,
      pageScroll: document.documentElement.scrollWidth - document.body.clientWidth,
    }));
    for (const width of geometry.widths) expect(width).toBeCloseTo(PHONE_THUMB_PX, 0);
    expect(new Set(geometry.tops.map(Math.round)).size, 'one row').toBe(1);
    expect(geometry.scrolls, `${place.photos} thumbnails overflow a phone`).toBe(true);
    expect(geometry.pageScroll, 'the page scrolls sideways').toBeLessThanOrEqual(0);
    await context.close();
  });

  test('tapping a thumbnail cut off at the edge shows it and centres it, without scrolling the page', async ({
    browser,
  }) => {
    const { context, page } = await openPlace(browser, PHONE);
    const strip = await hydrated(page);
    await strip.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    const scrollY = await page.evaluate(() => window.scrollY);

    // The first thumbnail the strip's right edge cuts off, tapped on the part that shows.
    const target = await strip.evaluate((element) => {
      const edge = element.getBoundingClientRect().right;
      const buttons = [...element.querySelectorAll('button')];
      const index = buttons.findIndex((b) => b.getBoundingClientRect().right > edge);
      const box = buttons[index]?.getBoundingClientRect();
      return box
        ? { index, x: (box.left + Math.min(box.right, edge)) / 2, y: box.top + box.height / 2 }
        : null;
    });
    if (!target || target.index < 1) throw new Error('no thumbnail is cut off at the edge');

    await page.touchscreen.tap(target.x, target.y);

    await expect(thumbs(strip).nth(target.index)).toHaveAttribute('aria-current', 'true');
    await expect(
      page.getByText(`Photo ${target.index + 1} of ${place.photos}`, { exact: true }),
    ).toBeVisible();
    // Centred inside the strip (or as near as its scroll range allows).
    await expect
      .poll(() =>
        strip.evaluate((element, at) => {
          const outer = element.getBoundingClientRect();
          const box = element.querySelectorAll('button')[at]?.getBoundingClientRect();
          if (!box) return Number.POSITIVE_INFINITY;
          const off = box.left + box.width / 2 - (outer.left + outer.width / 2);
          const max = element.scrollWidth - element.clientWidth;
          const pinned =
            (off > 0 && element.scrollLeft >= max - 1) || (off < 0 && element.scrollLeft <= 1);
          return pinned ? 0 : Math.abs(off);
        }, target.index),
      )
      .toBeLessThanOrEqual(SAME_PX);
    expect(await strip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);

    // No hover on a phone: nothing dims and nothing lifts.
    for (const layer of await layers(strip)) {
      expect(layer).toMatchObject({ dim: 0, light: 0, lift: 'none' });
    }
    await context.close();
  });
});

test.describe('/places/[placeId]: loading, hydration and no JavaScript', () => {
  for (const [label, options] of [
    ['1440', DESKTOP],
    ['390', PHONE],
  ] as const) {
    test(`${label}: loading and hydrating move nothing in the place card`, async ({ browser }) => {
      const context = await browser.newContext(options);
      await recordShifts(context);
      await context.route('**/*', (route) =>
        ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort(),
      );
      const page = await context.newPage();
      await page.goto(`${getTargetUrl()}/places/${encodeURIComponent(place.id)}`);
      await expect(page.locator(PENDING_CONTENT)).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      const strip = await hydrated(page);
      // The thumbnails load lazily: bring the strip in and let every thumbnail it shows arrive
      // (scrolling is not a layout shift), so their own boxes are part of the check. Those past
      // a phone strip's edge load only when the strip scrolls to them.
      await strip.evaluate((element) => element.scrollIntoView({ block: 'center' }));
      await expect
        .poll(() =>
          strip.evaluate((element) => {
            const shown = element.getBoundingClientRect();
            const inView = [...element.querySelectorAll('img')].filter((image) => {
              const box = image.getBoundingClientRect();
              return box.right > shown.left && box.left < shown.right;
            });
            return (
              inView.length > 0 && inView.every((image) => image.complete && image.naturalWidth > 0)
            );
          }),
        )
        .toBe(true);
      await nextFrame(page);

      const shifts = await page.evaluate(
        () =>
          (window as unknown as { __cardShifts: { value: number; sources: string[] }[] })
            .__cardShifts,
      );
      expect(shifts, JSON.stringify(shifts)).toEqual([]);
      await context.close();
    });

    test(`${label}: without JavaScript the first photo shows, and no strip`, async ({
      browser,
    }) => {
      const { context, page } = await openPlace(browser, { ...options, javaScriptEnabled: false });

      const photo = page.locator(`${FRAME} img`);
      await expect(photo).toHaveCount(1);
      await expect(photo).toBeVisible();
      await expect
        .poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth))
        .toBeGreaterThan(0);
      await expect(page.locator(STRIP)).toBeHidden();
      await expect(page.getByRole('button', { name: /^Photo \d+ of \d+/ })).toHaveCount(0);
      await context.close();
    });
  }
});
