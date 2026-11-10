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
 * @file The scroll edge haze over every route's page column, measured in a real browser at a
 * 390 x 844 phone and a 1280 x 800 laptop:
 * - the shell mounts it once, fixed beside the page column: it ends at the phone bottom bar's
 *   top, starts at the rail's edge (64 px) from lg, its bands as wide as main and centred like it;
 * - the bands fade with the scroll position: at the top of the page the top band is hidden and
 *   the bottom one shown, mid-page both show, at the end the bottom one is gone (the built CSS
 *   keeps the scroll timeline after the animation shorthand, or the bands would sit at full
 *   strength);
 * - it never takes input: at points inside both bands the page under it is hit, as it is with
 *   the haze removed;
 * - the owner's stack: 8 layers of 1 to 6 px blur, or 7 up to 5 px under a coarse pointer;
 * - forced colours draw nothing, reduced transparency drops every blur for a plain scrim, and
 *   reduced motion leaves the scroll fade as it is (nothing in the haze runs on the clock);
 * - an element scrolled into view stops clear of both bands (scroll-padding), and the sticky
 *   filter bars of /projects and /places end inside the top band, so that padding clears them;
 * - a pulsing placeholder or an equaliser pauses while it sits under a band (each of its frames
 *   would blur the band again) and moves again mid-screen; a spinner keeps moving; after a client
 *   navigation no placeholder the last route removed is still observed;
 * - print draws no haze (fixed, it would repeat on every page and blank its last rows) and pads
 *   no page for it;
 * - the page never scrolls sideways.
 * Screenshots of the first screen, mid-page and the end are attached to the report, not compared.
 */

import { expect, type Page, type TestInfo, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';
import { settleBento } from '../fixtures/home-bento';

const MAIN = 'main#main-content';
const HAZE = '.edge-haze';

/** Content still streaming in (see shell-grid.spec.ts): the page can still grow while it shows. */
const PENDING_CONTENT = 'div[hidden][id^="S:"], main [aria-busy="true"]';

const PATHS = ['/', '/certifications', '/projects', '/places'] as const;

const PHONE = { width: 390, height: 844 } as const;
const LAPTOP = { width: 1280, height: 800 } as const;
const VIEWPORTS = [PHONE, LAPTOP] as const;

/** Tailwind's lg: the rail from here up, the bottom bar below. */
const LG_PX = 1024;
const RAIL_PX = 64;

/**
 * The owner's band height: 11% of the screen, held between 77 and 132 px, except that under 550 px
 * of height the floor follows 14% of the screen (owner decision, 2026-11-07).
 */
const bandHeight = (viewportHeight: number) =>
  Math.min(132, Math.max(Math.min(77, viewportHeight * 0.14), viewportHeight * 0.11));

/** Short screens the lab never showed: landscape phones, a laptop at 200% and the WCAG reflow size. */
const SHORT_SCREENS = [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
  { width: 640, height: 400 },
  { width: 320, height: 256 },
] as const;

/** At most this share of the haze may sit under a band on a short screen (it was 47-84%). */
const SHORT_SCREEN_MAX_COVERAGE = 0.4;

/** Blur radii, innermost layer first, as the built CSS computes them. */
const FINE_STACK = ['1px', '1.29px', '1.67px', '2.16px', '2.78px', '3.6px', '4.65px', '6px'];
const COARSE_STACK = ['1px', '1.31px', '1.71px', '2.24px', '2.92px', '3.82px', '5px'];

/** Sub-pixel rounding allowed in a measured edge, and in a scroll-driven opacity. */
const EDGE_TOLERANCE_PX = 1;
const OPACITY_TOLERANCE = 0.01;

type Viewport = { readonly width: number; readonly height: number };

interface BandOpacity {
  /** Every displayed element of the band (layers, tint, cap). */
  readonly top: readonly number[];
  readonly bottom: readonly number[];
}

/** What recordObserverTargets and the sweep test leave on window. */
interface ObserverRecord {
  /** Whether a live IntersectionObserver still holds `element`. */
  __heldByObservers?: (element: Element) => boolean;
  __specGone?: Element;
  __specHaze?: Element | null;
}

/**
 * An init script: every IntersectionObserver the page creates records the elements it holds, so
 * a test can tell whether a removed element is still referenced. Observing is unchanged.
 */
function recordObserverTargets(): void {
  const Native = window.IntersectionObserver;
  const live = new Set<Set<Element>>();
  class Recording extends Native {
    readonly held = new Set<Element>();
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      super(callback, options);
      live.add(this.held);
    }
    observe(target: Element): void {
      this.held.add(target);
      super.observe(target);
    }
    unobserve(target: Element): void {
      this.held.delete(target);
      super.unobserve(target);
    }
    disconnect(): void {
      live.delete(this.held);
      this.held.clear();
      super.disconnect();
    }
  }
  window.IntersectionObserver = Recording;
  (window as unknown as ObserverRecord).__heldByObservers = (element) =>
    [...live].some((held) => held.has(element));
}

async function openAt(page: Page, path: string, viewport: Viewport): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto(`${getTargetUrl()}${path}`);
  const main = page.locator(MAIN);
  await expect(main).toBeVisible();
  await expect(page.locator(PENDING_CONTENT)).toHaveCount(0);
  if (path === '/') await settleBento(page, main);
  await page.evaluate(() => document.fonts.ready);
}

/** Two frames: scroll timelines are sampled once per frame. */
function nextFrames(page: Page): Promise<void> {
  return page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

/** How far the page scrolls, in px. */
function maxScroll(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
}

async function scrollToY(page: Page, y: number): Promise<void> {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  await nextFrames(page);
}

/** Scrolls to the end, again while the page still grows (lazy images, late islands). */
async function scrollToEnd(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      await page.evaluate(() =>
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
      );
      await nextFrames(page);
      return page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight - window.scrollY,
      );
    })
    .toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
}

function bandOpacity(page: Page): Promise<BandOpacity> {
  return page.evaluate((selector) => {
    const haze = document.querySelector(selector);
    const read = (band: string) =>
      [...(haze?.querySelectorAll(`:scope > .${band} > i`) ?? [])]
        .filter((element) => getComputedStyle(element).display !== 'none')
        .map((element) => Number(getComputedStyle(element).opacity));
    return { top: read('t'), bottom: read('b') };
  }, HAZE);
}

function expectAll(values: readonly number[], expected: number, what: string): void {
  expect(values.length, `${what}: no displayed element`).toBeGreaterThan(0);
  for (const value of values) {
    expect(Math.abs(value - expected), `${what}: ${values.join(', ')}`).toBeLessThanOrEqual(
      OPACITY_TOLERANCE,
    );
  }
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

for (const path of PATHS) {
  for (const viewport of VIEWPORTS) {
    const size = `${viewport.width}x${viewport.height}`;

    test(`${path} at ${size}: one haze over the column that fades with the scroll and takes no input`, async ({
      page,
    }, testInfo) => {
      await openAt(page, path, viewport);
      const isPhone = viewport.width < LG_PX;

      // Once, in the shell: right after the page column, outside main.
      const placement = await page.evaluate(
        ({ haze, main }) => {
          const found = document.querySelectorAll(haze);
          const element = found[0];
          return {
            count: found.length,
            ariaHidden: element?.getAttribute('aria-hidden'),
            afterColumn: element?.previousElementSibling?.contains(document.querySelector(main)),
            inMain: Boolean(element?.closest(main)),
          };
        },
        { haze: HAZE, main: MAIN },
      );
      expect(placement).toEqual({ count: 1, ariaHidden: 'true', afterColumn: true, inMain: false });

      // Beside the navs, never over them; the bands as wide as main and centred like it.
      const boxes = await page.evaluate(
        ({ haze, main }) => {
          const box = (element: Element | null | undefined) => {
            const rect = element?.getBoundingClientRect();
            return rect
              ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
              : null;
          };
          const root = document.querySelector(haze);
          return {
            haze: box(root),
            top: box(root?.querySelector(':scope > .t')),
            bottom: box(root?.querySelector(':scope > .b')),
            bar: box(root?.nextElementSibling),
            main: box(document.querySelector(main)),
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
          };
        },
        { haze: HAZE, main: MAIN },
      );
      if (!boxes.haze || !boxes.top || !boxes.bottom || !boxes.main) {
        throw new Error('the haze, its bands or main is not laid out');
      }
      const near = (actual: number, expected: number, what: string) =>
        expect(
          Math.abs(actual - expected),
          `${what}: ${actual}, expected ${expected}`,
        ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
      near(boxes.haze.top, 0, 'haze top');
      if (isPhone) {
        if (!boxes.bar) throw new Error('no bottom bar after the haze');
        near(boxes.haze.bottom, boxes.bar.top, "haze bottom against the bar's top");
        expect(boxes.bar.bottom).toBeGreaterThan(boxes.bar.top);
        near(boxes.haze.left, 0, 'haze left');
      } else {
        near(boxes.haze.left, RAIL_PX, "haze left against the rail's edge");
        near(boxes.haze.bottom, boxes.innerHeight, 'haze bottom');
      }
      for (const band of [boxes.top, boxes.bottom]) {
        near(band.left, boxes.main.left, "band left against main's");
        near(band.right, boxes.main.right, "band right against main's");
      }
      near(boxes.top.bottom - boxes.top.top, bandHeight(viewport.height), 'top band height');
      near(
        boxes.bottom.bottom - boxes.bottom.top,
        bandHeight(viewport.height),
        'bottom band height',
      );
      near(boxes.bottom.bottom, boxes.haze.bottom, 'bottom band at the haze bottom');

      // A page that scrolls: the top band hidden at the top, the bottom one shown.
      expect(await maxScroll(page), `${path} does not scroll`).toBeGreaterThan(
        bandHeight(viewport.height),
      );
      await scrollToY(page, 0);
      let opacity = await bandOpacity(page);
      expectAll(opacity.top, 0, 'top band at the top of the page');
      expectAll(opacity.bottom, 1, 'bottom band at the top of the page');
      await attachScreenshot(page, testInfo, `${path} ${size} first screen`);

      // Mid-page: both bands show, each as far into its fade as the scroll is into its band
      // height (both full once the page scrolls two band heights; less on a short page).
      const range = await maxScroll(page);
      const middle = Math.round(range / 2);
      await scrollToY(page, middle);
      opacity = await bandOpacity(page);
      const topBand = boxes.top.bottom - boxes.top.top;
      const bottomBand = boxes.bottom.bottom - boxes.bottom.top;
      expectAll(opacity.top, Math.min(1, middle / topBand), 'top band mid-page');
      expectAll(opacity.bottom, Math.min(1, (range - middle) / bottomBand), 'bottom band mid-page');
      if (range >= topBand + bottomBand) {
        expectAll(opacity.top, 1, 'top band mid-page of a long page');
        expectAll(opacity.bottom, 1, 'bottom band mid-page of a long page');
      }
      await attachScreenshot(page, testInfo, `${path} ${size} mid-page`);

      // Inside both bands the page is hit, exactly as with the haze gone.
      const hits = await page.evaluate((selector) => {
        const haze = document.querySelector<HTMLElement>(selector);
        if (!haze) return [];
        const points = [':scope > .t', ':scope > .b'].flatMap((band) => {
          const rect = haze.querySelector(band)?.getBoundingClientRect();
          if (!rect) return [];
          return [0.2, 0.5, 0.8].flatMap((fx) =>
            [0.25, 0.5, 0.75].map(
              (fy) => [rect.left + rect.width * fx, rect.top + rect.height * fy] as const,
            ),
          );
        });
        const withHaze = points.map(([x, y]) => document.elementFromPoint(x, y));
        haze.style.display = 'none';
        const withoutHaze = points.map(([x, y]) => document.elementFromPoint(x, y));
        haze.style.display = '';
        return points.map(([x, y], index) => ({
          point: `${Math.round(x)},${Math.round(y)}`,
          hit: withHaze[index]?.tagName ?? null,
          inHaze: Boolean(withHaze[index]?.closest(selector)),
          same: withHaze[index] === withoutHaze[index],
        }));
      }, HAZE);
      expect(hits).toHaveLength(18);
      for (const hit of hits) {
        expect(hit.inHaze, `the haze took the hit at ${hit.point}`).toBe(false);
        expect(hit.same, `the hit at ${hit.point} changed with the haze (${hit.hit})`).toBe(true);
        expect(hit.hit, `nothing hit at ${hit.point}`).not.toBeNull();
      }

      // The end: the bottom band is gone, so the footer is sharp.
      await scrollToEnd(page);
      opacity = await bandOpacity(page);
      expectAll(opacity.top, 1, 'top band at the end');
      expectAll(opacity.bottom, 0, 'bottom band at the end');
      await attachScreenshot(page, testInfo, `${path} ${size} end`);

      // Never sideways.
      const scrollX = await page.evaluate(() => {
        window.scrollTo({ left: 10_000, behavior: 'instant' });
        return window.scrollX;
      });
      expect(scrollX, `${path} scrolls sideways`).toBe(0);
    });
  }
}

for (const viewport of SHORT_SCREENS) {
  test(`${viewport.width}x${viewport.height}: the bands keep most of a short screen clear`, async ({
    page,
  }) => {
    await openAt(page, '/certifications', viewport);
    await scrollToY(page, Math.round((await maxScroll(page)) / 2));

    const heights = await page.evaluate((selector) => {
      const height = (element: Element | null | undefined) =>
        element?.getBoundingClientRect().height ?? 0;
      const root = document.querySelector(selector);
      return {
        haze: height(root),
        top: height(root?.querySelector(':scope > .t')),
        bottom: height(root?.querySelector(':scope > .b')),
      };
    }, HAZE);
    const expected = bandHeight(viewport.height);

    expect(
      Math.abs(heights.top - expected),
      `top band ${heights.top}, expected ${expected}`,
    ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
    expect(
      Math.abs(heights.bottom - expected),
      `bottom band ${heights.bottom}, expected ${expected}`,
    ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
    expect((heights.top + heights.bottom) / heights.haze).toBeLessThanOrEqual(
      SHORT_SCREEN_MAX_COVERAGE,
    );
  });
}

// CodeRabbit on #614: the synthetic `spec_equalise` test can pass while the build names the real
// equaliser's keyframes differently. This one reads the name the build gave them and parks bars
// drawn with it under the bottom band.
test('pauses bars drawn with the real compiled equaliser keyframes under a band', async ({
  page,
}) => {
  await openAt(page, '/', PHONE);
  await scrollToY(page, Math.round((await maxScroll(page)) / 2));

  const names = await page.evaluate(() =>
    [...document.styleSheets].flatMap((sheet) => {
      try {
        return [...sheet.cssRules].flatMap((rule) =>
          rule instanceof CSSKeyframesRule && /equalise/.test(rule.name) ? [rule.name] : [],
        );
      } catch {
        return [];
      }
    }),
  );
  expect(names, 'the home page loads no equaliser keyframes').not.toEqual([]);

  await page.evaluate(
    ({ selector, keyframes }) => {
      const main = document.querySelector('main');
      const band = document.querySelector(`${selector} > .b`)?.getBoundingClientRect();
      if (!main || !band) throw new Error('no main or bottom band');
      const top = band.top + band.height / 2 - main.getBoundingClientRect().top;
      // A one-class rule, as equaliser.module.css draws the real bars: an inline `animation` would
      // outrank the pause rule, which no shipped bar does.
      const style = document.createElement('style');
      style.textContent = keyframes
        .map(
          (name, index) =>
            `.spec-real-bar-${index} { animation: ${name} 0.9s ease-in-out infinite alternate; }`,
        )
        .join('\n');
      document.head.append(style);
      keyframes.forEach((_name, index) => {
        const bar = document.createElement('span');
        bar.id = `spec-real-bar-${index}`;
        bar.className = `spec-real-bar-${index}`;
        Object.assign(bar.style, {
          position: 'absolute',
          left: '50%',
          top: `${top}px`,
          width: '0.5rem',
          height: '0.75rem',
          display: 'block',
          background: 'var(--surface-3)',
        });
        main.append(bar);
      });
    },
    { selector: HAZE, keyframes: names },
  );

  for (const index of names.keys()) {
    const id = `spec-real-bar-${index}`;
    await expect
      .poll(
        () =>
          page.evaluate(
            (elementId) => document.getElementById(elementId)?.hasAttribute('data-under-edge'),
            id,
          ),
        `${names[index]} is not paused under the band`,
      )
      .toBe(true);
    expect(
      await page.evaluate(
        (elementId) =>
          document
            .getElementById(elementId)
            ?.getAnimations()
            .map((animation) => animation.playState)
            .join(),
        id,
      ),
    ).toBe('paused');
  }
});

// /projects' row bar, and /places' slimmer band around its 'bar' tile.
for (const path of ['/projects', '/places'] as const) {
  test(`${path}' sticky filter bar ends inside the top band, so its scroll-padding clears the bar too`, async ({
    page,
  }) => {
    // The shortest lg screen gives the shortest band: 77 px.
    await openAt(page, path, { width: 1024, height: 640 });
    await scrollToY(page, Math.round((await maxScroll(page)) / 2));

    const edges = await page.evaluate((selector) => {
      // The kit's sticky bar, which must come first: the year bars and labels stick under it.
      const bar = document.querySelector('main [data-filter-part="bar"]');
      const firstSticky = [...document.querySelectorAll('main *')].find(
        (element) => getComputedStyle(element).position === 'sticky',
      );
      return {
        barIsFirstSticky: bar !== null && firstSticky === bar,
        barTop: bar?.getBoundingClientRect().top ?? null,
        barBottom: bar?.getBoundingClientRect().bottom ?? null,
        bandEnd: document.querySelector(`${selector} > .t`)?.getBoundingClientRect().bottom ?? 0,
        paddingTop: Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),
      };
    }, HAZE);
    if (edges.barTop === null || edges.barBottom === null) throw new Error('no sticky filter bar');
    expect(edges.barIsFirstSticky, 'another element sticks before the filter bar').toBe(true);
    expect(edges.barTop, 'the filter bar is not stuck to the top').toBeGreaterThanOrEqual(0);
    expect(edges.barBottom).toBeLessThanOrEqual(edges.bandEnd);
    expect(edges.barBottom).toBeLessThanOrEqual(edges.paddingTop);
  });
}

test.describe('the layer stack and its fallbacks', () => {
  for (const viewport of VIEWPORTS) {
    const size = `${viewport.width}x${viewport.height}`;

    test(`the owner's stack at ${size}: 8 layers up to 6 px, or 7 up to 5 px under a coarse pointer`, async ({
      page,
    }) => {
      await openAt(page, '/certifications', viewport);
      const stack = await page.evaluate((selector) => {
        const haze = document.querySelector(selector);
        const radii = (band: string) =>
          [...(haze?.querySelectorAll(`:scope > .${band} > .l`) ?? [])]
            .filter((layer) => getComputedStyle(layer).display !== 'none')
            .map((layer) => /blur\(([^)]+)\)/.exec(getComputedStyle(layer).backdropFilter)?.[1]);
        const cap = haze?.querySelector(':scope > .t > .cap');
        return {
          coarse: matchMedia('(pointer: coarse)').matches,
          top: radii('t'),
          bottom: radii('b'),
          cap: cap ? getComputedStyle(cap).backdropFilter : null,
          hazeZ: haze ? getComputedStyle(haze).zIndex : null,
          pointerEvents: haze ? getComputedStyle(haze).pointerEvents : null,
          position: haze ? getComputedStyle(haze).position : null,
        };
      }, HAZE);
      const expected = stack.coarse ? COARSE_STACK : FINE_STACK;
      expect(stack.top).toEqual(expected);
      expect(stack.bottom).toEqual(expected);
      expect(stack.cap).toBe(`blur(${expected.at(-1)})`);
      expect([stack.hazeZ, stack.pointerEvents, stack.position]).toEqual(['20', 'none', 'fixed']);
    });

    test(`forced colours draw no haze at ${size}`, async ({ page }) => {
      await page.emulateMedia({ forcedColors: 'active' });
      await openAt(page, '/certifications', viewport);

      await expect(page.locator(HAZE)).toBeHidden();
      expect(await page.locator(HAZE).evaluate((haze) => getComputedStyle(haze).display)).toBe(
        'none',
      );
    });

    test(`print draws no haze and pads no page for it at ${size}`, async ({ page }) => {
      await openAt(page, '/certifications', viewport);
      const printed = () =>
        page.evaluate((selector) => {
          const haze = document.querySelector(selector);
          const root = getComputedStyle(document.documentElement);
          return {
            display: haze ? getComputedStyle(haze).display : null,
            paddingTop: root.scrollPaddingTop,
            paddingBottom: root.scrollPaddingBottom,
          };
        }, HAZE);

      await page.emulateMedia({ media: 'print' });
      expect(await printed()).toEqual({ display: 'none', paddingTop: '0px', paddingBottom: '0px' });

      // Back on screen: the haze and its padding return.
      await page.emulateMedia({ media: 'screen' });
      const screen = await printed();
      expect(screen.display).toBe('block');
      expect(Number.parseFloat(screen.paddingTop)).toBeGreaterThanOrEqual(77 - EDGE_TOLERANCE_PX);
    });

    test(`reduced transparency drops every blur for a plain scrim at ${size}`, async ({
      page,
      browserName,
    }) => {
      test.skip(browserName !== 'chromium', 'the media emulation below is a Chromium CDP call');
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
      });
      await openAt(page, '/certifications', viewport);
      await scrollToY(page, Math.round((await maxScroll(page)) / 2));

      const state = await page.evaluate((selector) => {
        const haze = document.querySelector(selector);
        const all = [...(haze?.querySelectorAll('*') ?? [])];
        const tint = haze?.querySelector(':scope > .t > .tn');
        return {
          reduce: matchMedia('(prefers-reduced-transparency: reduce)').matches,
          blurring: all
            .filter((element) => getComputedStyle(element).display !== 'none')
            .map((element) => getComputedStyle(element).backdropFilter)
            .filter((filter) => filter !== 'none'),
          layersShown: all.filter(
            (element) =>
              element.classList.contains('l') && getComputedStyle(element).display !== 'none',
          ).length,
          tint: tint ? getComputedStyle(tint).backgroundImage : '',
          tintMask: tint ? getComputedStyle(tint).maskImage : '',
          tintOpacity: tint ? Number(getComputedStyle(tint).opacity) : 0,
        };
      }, HAZE);
      expect(state.reduce).toBe(true);
      expect(state.blurring).toEqual([]);
      expect(state.layersShown).toBe(0);
      expect(state.tint).toMatch(/^linear-gradient\(/);
      expect(state.tint).toContain('0.94');
      expect(state.tintMask).toBe('none');
      expect(state.tintOpacity).toBe(1);
    });

    test(`reduced motion leaves the scroll fade, and nothing in the haze runs on the clock, at ${size}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openAt(page, '/certifications', viewport);

      await scrollToY(page, 0);
      let opacity = await bandOpacity(page);
      expectAll(opacity.top, 0, 'top band at the top, reduced motion');
      expectAll(opacity.bottom, 1, 'bottom band at the top, reduced motion');
      await scrollToY(page, Math.round((await maxScroll(page)) / 2));
      opacity = await bandOpacity(page);
      expectAll(opacity.top, 1, 'top band mid-page, reduced motion');
      expectAll(opacity.bottom, 1, 'bottom band mid-page, reduced motion');

      const clockDriven = await page.evaluate((selector) => {
        const haze = document.querySelector(selector);
        return document
          .getAnimations()
          .filter((animation) => {
            const target = (animation.effect as KeyframeEffect | null)?.target;
            return target instanceof Element && haze?.contains(target);
          })
          .filter((animation) => !(animation.timeline instanceof ScrollTimeline))
          .map((animation) => (animation as CSSAnimation).animationName);
      }, HAZE);
      expect(clockDriven).toEqual([]);
    });

    test(`an element scrolled into view stops clear of both bands at ${size}`, async ({ page }) => {
      await openAt(page, '/certifications', viewport);
      const clearance = await page.evaluate((selector) => {
        const haze = document.querySelector(selector);
        const topEnd = haze?.querySelector(':scope > .t')?.getBoundingClientRect().bottom ?? 0;
        const bottomStart = haze?.querySelector(':scope > .b')?.getBoundingClientRect().top ?? 0;
        const middle = document.documentElement.scrollHeight / 2;
        const target = [...document.querySelectorAll('main a[href], main h2, main h3')]
          .map((element) => ({ element, y: element.getBoundingClientRect().top + window.scrollY }))
          .sort((a, b) => Math.abs(a.y - middle) - Math.abs(b.y - middle))[0]?.element;
        if (!target) return null;
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
        const atStart = target.getBoundingClientRect().top;
        target.scrollIntoView({ block: 'end', behavior: 'instant' });
        const atEnd = target.getBoundingClientRect().bottom;
        return { topEnd, bottomStart, atStart, atEnd };
      }, HAZE);
      if (!clearance) throw new Error('no heading or link in main to scroll to');
      expect(clearance.atStart).toBeGreaterThanOrEqual(clearance.topEnd - EDGE_TOLERANCE_PX);
      expect(clearance.atEnd).toBeLessThanOrEqual(clearance.bottomStart + EDGE_TOLERANCE_PX);
    });

    test(`pulses and the equaliser pause under a band, and move again clear of it, at ${size}`, async ({
      page,
    }) => {
      await openAt(page, '/certifications', viewport);
      await scrollToY(page, Math.round((await maxScroll(page)) / 2));

      // A Tailwind placeholder, a one-class rule on `…_equalise` keyframes (as the CSS module
      // writes the equaliser's) and a spinner, parked in main under the bottom band.
      await page.evaluate((selector) => {
        const style = document.createElement('style');
        style.textContent = `
          @keyframes spec_equalise { from { transform: scaleY(0.25); } to { transform: scaleY(1); } }
          .spec-bar { animation: spec_equalise 0.9s ease-in-out infinite alternate; }`;
        document.head.append(style);
        const main = document.querySelector('main');
        const band = document.querySelector(`${selector} > .b`)?.getBoundingClientRect();
        if (!main || !band) throw new Error('no main or bottom band');
        const top = band.top + band.height / 2 - main.getBoundingClientRect().top;
        for (const [id, className] of [
          ['spec-pulse', 'animate-pulse'],
          ['spec-bar', 'spec-bar'],
          ['spec-spin', 'animate-spin'],
        ] as const) {
          const element = document.createElement('span');
          element.id = id;
          element.className = className;
          Object.assign(element.style, {
            position: 'absolute',
            left: '50%',
            top: `${top}px`,
            width: '2rem',
            height: '0.75rem',
            display: 'block',
            background: 'var(--surface-3)',
          });
          main.append(element);
        }
      }, HAZE);

      const playState = (id: string) =>
        page.evaluate(
          (elementId) =>
            document
              .getElementById(elementId)
              ?.getAnimations()
              .map((animation) => animation.playState)
              .join(),
          id,
        );
      const marked = (id: string) =>
        page.evaluate(
          (elementId) => document.getElementById(elementId)?.hasAttribute('data-under-edge'),
          id,
        );

      for (const id of ['spec-pulse', 'spec-bar']) {
        await expect.poll(() => marked(id), `${id} is not marked under the band`).toBe(true);
        expect(await playState(id)).toBe('paused');
      }
      expect(await marked('spec-spin')).toBe(false);
      expect(await playState('spec-spin')).toBe('running');

      // Mid-screen, clear of both bands: moving again.
      await page.evaluate(() => {
        const main = document.querySelector('main');
        if (!main) return;
        const top = window.innerHeight / 2 - main.getBoundingClientRect().top;
        for (const id of ['spec-pulse', 'spec-bar']) {
          const element = document.getElementById(id);
          if (element) element.style.top = `${top}px`;
        }
      });
      for (const id of ['spec-pulse', 'spec-bar']) {
        await expect.poll(() => marked(id), `${id} is still marked mid-screen`).toBe(false);
        expect(await playState(id)).toBe('running');
      }
    });

    test(`a client navigation lets go of a placeholder the last route removed at ${size}`, async ({
      page,
    }) => {
      await page.addInitScript(recordObserverTargets);
      await openAt(page, '/certifications', viewport);
      await scrollToY(page, 0);

      // A placeholder pulsing mid-screen, clear of both bands, as a streamed fallback does
      // before its content arrives.
      await page.evaluate((selector) => {
        const main = document.querySelector('main');
        if (!main) throw new Error('no main');
        const placeholder = document.createElement('span');
        placeholder.className = 'animate-pulse';
        Object.assign(placeholder.style, {
          position: 'absolute',
          left: '50%',
          top: `${window.innerHeight / 2 - main.getBoundingClientRect().top}px`,
          width: '2rem',
          height: '0.75rem',
          display: 'block',
          background: 'var(--surface-3)',
        });
        main.append(placeholder);
        const record = window as unknown as ObserverRecord;
        record.__specGone = placeholder;
        record.__specHaze = document.querySelector(selector);
      }, HAZE);
      const held = () =>
        page.evaluate(() => {
          const record = window as unknown as ObserverRecord;
          const gone = record.__specGone;
          return gone && record.__heldByObservers ? record.__heldByObservers(gone) : null;
        });
      await expect.poll(held, 'the haze never watched the placeholder').toBe(true);

      // Its content arrives: it leaves the page clear of the bands, so no band reports it.
      await page.evaluate(() => (window as unknown as ObserverRecord).__specGone?.remove());
      await page.locator('footer a[href="/privacy"]').click();
      await page.waitForURL('**/privacy');
      await expect(page.locator(MAIN)).toBeVisible();

      // A client navigation, under the same haze (a full load or a new haze would prove nothing).
      const after = await page.evaluate((selector) => {
        const record = window as unknown as ObserverRecord;
        return {
          clientSide: record.__specGone !== undefined,
          sameHaze: record.__specHaze === document.querySelector(selector),
        };
      }, HAZE);
      expect(after).toEqual({ clientSide: true, sameHaze: true });
      await expect
        .poll(held, 'the removed placeholder is still observed after the route change')
        .toBe(false);
    });
  }
});
