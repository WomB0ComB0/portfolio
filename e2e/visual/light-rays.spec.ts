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
 * @file The light rays behind every page (src/components/layout/light-rays.tsx and
 * src/styles/light-rays.css), restored after #603, in a real browser at a 390 x 844 phone and a
 * 1280 x 800 laptop:
 * - at the top of the page the rays move under the top band of the edge haze, which is hidden
 *   there (opacity 0, no blur); once the page scrolls and that band shows, the rays under it
 *   pause (pause-under-edge.ts), and they move again back at the top;
 * - a ray whose box ends just above the window pauses too, as its 20 px blur still draws under
 *   the band (the top band's root reaches 64 px above the window);
 * - every ray is part way through its cycle from the first frame (a negative delay), so a ray
 *   paused at once, by a scroll right after load, holds its light instead of a dark delay;
 * - under reduced motion no ray animates, and each holds still at 60% of its peak;
 * - forced colours and print draw neither the rays nor the glows;
 * - where the light is brightest, every text tier keeps 4.5:1: on a page one screen tall (each
 *   ray hangs 12% of the page's height above it, so the shortest page is the brightest), every
 *   ray held at its peak, the content hidden, the brightest 8 x 8 px block of the screenshot.
 * The rays hang from above the page, so on a long page they are off screen: the checks that need
 * them on screen hide main and set the page's height.
 */

import { expect, type Page, test } from '@playwright/test';

import { getTargetUrl } from '../fixtures/base';

const MAIN = 'main#main-content';
const ROOT = '.light-glows';
const RAYS = '.light-rays > i';
const HAZE = '.edge-haze';
const RAY_COUNT = 5;

/** Content still streaming in (see shell-grid.spec.ts): the page can still grow while it shows. */
const PENDING_CONTENT = 'div[hidden][id^="S:"], main [aria-busy="true"]';

/** A light route: no bento to settle. */
const PATH = '/privacy';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const;

type Viewport = (typeof VIEWPORTS)[number];

/** Two screens tall with main hidden: the rays reach about 380 px down at the top of the page. */
const TWO_SCREENS = `main { display: none !important; } ${ROOT} { min-height: 200vh !important; }`;

/** Every ray at its peak and still, with everything but the rays and the glows hidden. */
const LIGHT_ONLY = `
  main { display: none !important; }
  ${RAYS} { animation: none !important; opacity: var(--ray-peak) !important; }
  ${ROOT} > :not(.light-rays), ${HAZE} { visibility: hidden !important; }`;

/** The text tiers that sit on the bare canvas. */
const TEXT_TIERS = ['fg', 'fg-muted', 'fg-faint', 'brand-ink', 'brand'] as const;
const AA_NORMAL_TEXT = 4.5;

/** Under reduced motion each ray holds at this share of its peak. */
const STILL_SHARE = 0.6;
const OPACITY_TOLERANCE = 0.01;

/** The scroll that shows the top band a little (24 px of its 77 to 132 px fade). */
const SMALL_SCROLL_PX = 24;

/**
 * Where the lowest ray's box ends, above the window: its blur(20px) still draws about 30 px into
 * the window, under the top band (pause-under-edge.ts reaches 64 px above the window for it).
 */
const BOX_ABOVE_WINDOW_PX = 30;

/** The brightest ray, paused at once, holds at least this opacity (0.45 or more in the first minute). */
const LIT_OPACITY = 0.3;

async function openAt(page: Page, viewport: Viewport): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto(`${getTargetUrl()}${PATH}`);
  await expect(page.locator(MAIN)).toBeVisible();
  await expect(page.locator(PENDING_CONTENT)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

/** Scrolls instantly, then waits two frames: the watcher reads the scroll once per frame. */
async function scrollToY(page: Page, y: number): Promise<void> {
  await page.evaluate(
    (top) =>
      new Promise<void>((resolve) => {
        window.scrollTo({ top, behavior: 'instant' });
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
    y,
  );
}

interface RayState {
  /** Whether part of the ray, clipped to the page, is on screen. */
  readonly onScreen: boolean;
  /** Whether that part overlaps the top band's box. */
  readonly underTopBand: boolean;
  /** Whether pause-under-edge.ts marked it. */
  readonly marked: boolean;
  /** Its animations' play states. */
  readonly playState: string;
}

interface RaysState {
  /** The top band's opacity (its first blur layer). */
  readonly topBand: number;
  readonly rays: readonly RayState[];
}

function raysState(page: Page): Promise<RaysState> {
  return page.evaluate(
    ({ rays, haze }) => {
      const band = document.querySelector(`${haze} > .t`);
      const bandBox = band?.getBoundingClientRect();
      const layer = band?.querySelector('.l');
      return {
        topBand: layer ? Number(getComputedStyle(layer).opacity) : -1,
        rays: [...document.querySelectorAll(rays)].map((ray) => {
          const box = ray.getBoundingClientRect();
          const clip = ray.parentElement?.getBoundingClientRect() ?? box;
          const top = Math.max(box.top, clip.top, 0);
          const bottom = Math.min(box.bottom, clip.bottom, window.innerHeight);
          return {
            onScreen: bottom > top,
            underTopBand: bottom > top && top < (bandBox?.bottom ?? 0),
            marked: ray.hasAttribute('data-under-edge'),
            playState: ray
              .getAnimations()
              .map((animation) => animation.playState)
              .join(),
          };
        }),
      };
    },
    { rays: RAYS, haze: HAZE },
  );
}

/** sRGB channels, 0 to 255, to relative luminance. */
function luminance(rgb: readonly number[]): number {
  const linear = (value: number) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r = 0, g = 0, b = 0] = rgb.map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: readonly number[], b: readonly number[]): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

interface Brightest {
  /** The brightest 8 x 8 block's mean colour. */
  readonly rgb: readonly number[];
  /** Each text tier's colour, as the page draws it. */
  readonly tiers: Readonly<Record<string, readonly number[]>>;
}

/** The brightest 8 x 8 block of a screenshot, decoded in the page, and the tiers' colours. */
function brightest(page: Page, png: string, tiers: readonly string[]): Promise<Brightest> {
  return page.evaluate(
    async ({ data, names }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('no 2d context');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const block = 8;
      let best = [0, 0, 0];
      let bestWeight = -1;
      for (let y = 0; y + block <= canvas.height; y += block) {
        for (let x = 0; x + block <= canvas.width; x += block) {
          const sum = [0, 0, 0];
          for (let j = 0; j < block; j++) {
            for (let i = 0; i < block; i++) {
              const at = ((y + j) * canvas.width + x + i) * 4;
              for (let c = 0; c < 3; c++) sum[c] = (sum[c] ?? 0) + (pixels[at + c] ?? 0);
            }
          }
          const weight = 0.2126 * (sum[0] ?? 0) + 0.7152 * (sum[1] ?? 0) + 0.0722 * (sum[2] ?? 0);
          if (weight > bestWeight) {
            bestWeight = weight;
            best = sum.map((channel) => channel / (block * block));
          }
        }
      }
      // Each tier's colour as sRGB, by painting it.
      const swatch = document
        .createElement('canvas')
        .getContext('2d', { willReadFrequently: true });
      const colourOf = (token: string): number[] => {
        const probe = document.createElement('span');
        probe.style.color = `var(--${token})`;
        document.body.append(probe);
        const colour = getComputedStyle(probe).color;
        probe.remove();
        if (!swatch) throw new Error('no 2d context');
        swatch.fillStyle = colour;
        swatch.fillRect(0, 0, 1, 1);
        return [...swatch.getImageData(0, 0, 1, 1).data.slice(0, 3)];
      };
      return {
        rgb: best,
        tiers: Object.fromEntries(names.map((token) => [token, colourOf(token)])),
      };
    },
    { data: png, names: [...tiers] },
  );
}

for (const viewport of VIEWPORTS) {
  const size = `${viewport.width}x${viewport.height}`;

  test(`the rays move under the hidden top band at the top of the page, and pause under it once it shows, at ${size}`, async ({
    page,
  }) => {
    await openAt(page, viewport);
    await page.addStyleTag({ content: TWO_SCREENS });
    await scrollToY(page, 0);

    // At the top of the page every ray is on screen inside the top band's box, which draws
    // nothing there: they move.
    await expect
      .poll(() => raysState(page))
      .toEqual({
        topBand: 0,
        rays: Array.from({ length: RAY_COUNT }, () => ({
          onScreen: true,
          underTopBand: true,
          marked: false,
          playState: 'running',
        })),
      });

    // A little scroll: the top band shows, so each ray under it pauses.
    await scrollToY(page, SMALL_SCROLL_PX);
    await expect
      .poll(async () => {
        const { topBand, rays } = await raysState(page);
        return (
          topBand > 0 &&
          rays.every((ray) => !ray.underTopBand || (ray.marked && ray.playState === 'paused'))
        );
      }, 'a ray under the shown top band is still moving')
      .toBe(true);
    expect((await raysState(page)).rays.some((ray) => ray.underTopBand)).toBe(true);

    // Back at the top: moving again.
    await scrollToY(page, 0);
    await expect
      .poll(async () =>
        (await raysState(page)).rays.every((ray) => !ray.marked && ray.playState === 'running'),
      )
      .toBe(true);
  });

  test(`a ray whose box ends just above the window still pauses under the shown top band, where its blur reaches, at ${size}`, async ({
    page,
  }) => {
    await openAt(page, viewport);
    await page.addStyleTag({ content: TWO_SCREENS });
    await scrollToY(page, 0);

    // Scroll until the lowest ray's box ends 30 px above the window: every box is then above it,
    // and each ray's blurred tail still draws under the top band.
    const lowest = await page.evaluate(
      (selector) =>
        Math.max(
          ...[...document.querySelectorAll(selector)].map(
            (ray) => ray.getBoundingClientRect().bottom + window.scrollY,
          ),
        ),
      RAYS,
    );
    await scrollToY(page, Math.round(lowest + BOX_ABOVE_WINDOW_PX));

    await expect
      .poll(() =>
        page.evaluate(
          (selector) =>
            [...document.querySelectorAll(selector)].map((ray) => ({
              aboveWindow: ray.getBoundingClientRect().bottom <= 0,
              marked: ray.hasAttribute('data-under-edge'),
              playState: ray
                .getAnimations()
                .map((animation) => animation.playState)
                .join(),
            })),
          RAYS,
        ),
      )
      .toEqual(
        Array.from({ length: RAY_COUNT }, () => ({
          aboveWindow: true,
          marked: true,
          playState: 'paused',
        })),
      );
  });

  test(`every ray is lit from the first frame, so one that pauses at once under the top band holds its light, at ${size}`, async ({
    page,
  }) => {
    await openAt(page, viewport);
    await page.addStyleTag({ content: TWO_SCREENS });
    await scrollToY(page, SMALL_SCROLL_PX);

    await expect
      .poll(async () =>
        (await raysState(page)).rays.every((ray) => ray.marked && ray.playState === 'paused'),
      )
      .toBe(true);
    const held = await page.evaluate(
      (selector) =>
        [...document.querySelectorAll(selector)].map((ray) => {
          const [animation] = ray.getAnimations();
          return {
            // null while an animation waits out its delay: it draws its base opacity, 0.
            progress: animation?.effect?.getComputedTiming().progress ?? null,
            seconds: Number(animation?.currentTime ?? 0) / 1000,
            opacity: Number(getComputedStyle(ray).opacity),
          };
        }),
      RAYS,
    );
    const summary = held
      .map((ray) => `${ray.opacity.toFixed(2)} at ${ray.seconds.toFixed(1)} s`)
      .join(', ');
    expect(
      held.every((ray) => ray.progress !== null),
      `a ray paused before its first cycle: ${summary}`,
    ).toBe(true);
    expect(Math.max(...held.map((ray) => ray.opacity)), summary).toBeGreaterThanOrEqual(
      LIT_OPACITY,
    );
  });

  test(`under reduced motion the rays hold still at 60% of their peak at ${size}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openAt(page, viewport);

    const rays = await page.evaluate(
      (selector) =>
        [...document.querySelectorAll<HTMLElement>(selector)].map((ray) => ({
          animations: ray.getAnimations().length,
          opacity: Number(getComputedStyle(ray).opacity),
          peak: Number(ray.style.getPropertyValue('--ray-peak')),
        })),
      RAYS,
    );
    expect(rays).toHaveLength(RAY_COUNT);
    for (const ray of rays) {
      expect(ray.animations).toBe(0);
      expect(Math.abs(ray.opacity - ray.peak * STILL_SHARE)).toBeLessThanOrEqual(OPACITY_TOLERANCE);
    }
  });

  for (const emulated of [{ forcedColors: 'active' }, { media: 'print' }] as const) {
    const what = 'media' in emulated ? 'print' : 'forced colours';

    test(`${what} draws neither the rays nor the glows at ${size}`, async ({ page }) => {
      await page.emulateMedia(emulated);
      await openAt(page, viewport);

      const drawn = await page.evaluate(
        ({ root, rays }) => ({
          glows: getComputedStyle(document.querySelector(root) ?? document.body).backgroundImage,
          rays: getComputedStyle(document.querySelector(rays)?.parentElement ?? document.body)
            .display,
        }),
        { root: ROOT, rays: RAYS },
      );
      expect(drawn).toEqual({ glows: 'none', rays: 'none' });
    });
  }

  test(`every text tier keeps 4.5:1 where the light is brightest at ${size}`, async ({ page }) => {
    await openAt(page, viewport);
    await page.addStyleTag({ content: LIGHT_ONLY });
    await scrollToY(page, 0);
    // One screen tall: the rays hang nearest the top, where they are brightest.
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(viewport.height);

    const png = (await page.screenshot()).toString('base64');
    const { rgb, tiers } = await brightest(page, png, TEXT_TIERS);
    for (const tier of TEXT_TIERS) {
      const ratio = contrast(tiers[tier] ?? [], rgb);
      const over = rgb.map((channel) => channel.toFixed(1)).join(' ');
      expect(ratio, `${tier} over rgb(${over}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT,
      );
    }
  });
}
