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
 * @file The light rays' stylesheet (src/styles/light-rays.css): LightRays as it was before #603
 * (`count={5} blur={20}`), rebuilt in CSS with no animation library, as the owner chose in the
 * background lab (option 0 at its defaults, animated).
 *
 * The two glows on the shell root, sized to the page as before, at the strength LightRays painted
 * them: rgba(88, 68, 188, 0.2) mixed to 45% and 35%, in layers at 60% opacity. The rays under the
 * content, 70vh long, 20 px blur, the colour at 70%, each fading in and out while it swings and
 * resting a tenth of its cycle, by opacity and rotate alone. They hang from 12% of a fixed page
 * height (the home page's, as it was), never of the page's own: as a streamed list replaced its
 * skeleton, `top: -12%` moved them and Chrome scored a layout shift. Under reduced motion they
 * hold still at 60% of their peak (the global rule would end them at 0 after 1 ms); forced colours
 * and print draw neither. The stylesheet is read as text (Vitest runs no PostCSS); where a ray
 * lands is resolved from it for each viewport and page height, as a browser would lay it out.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { isPausableAnimation } from '@/components/layout/pause-under-edge';
import {
  type CssRule,
  declarations,
  declaredValue,
  findRule,
  type LengthContext,
  resolveLength,
  styleRules,
} from './css-rules';

// Vitest runs from the repository root; under jsdom import.meta.url is not a file: URL.
const STYLES = join(process.cwd(), 'src/styles');
/** The stylesheet without its comments, which name what it avoids. */
const RAYS_CSS = readFileSync(join(STYLES, 'light-rays.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);
const GLOBALS_CSS = readFileSync(join(STYLES, 'globals.css'), 'utf8');

const RULES = styleRules(RAYS_CSS);
const rule = (selector: string, conditions: readonly string[] = []): CssRule =>
  findRule(RULES, selector, conditions);

const MEDIA_REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)';
const MEDIA_NO_LIGHTS = '@media (forced-colors: active), print';
const RAY = '.light-rays > i';

/** LightRays' colour before #603: rgba(88, 68, 188, 0.2). */
const SOURCE_ALPHA = 0.2;
/** Its glows: the colour mixed to 45% and 35%, each in a layer at 60% opacity. */
const GLOW_ALPHAS = [SOURCE_ALPHA * 0.45 * 0.6, SOURCE_ALPHA * 0.35 * 0.6] as const;
/** Its rays: the colour mixed to 70%. */
const RAY_ALPHA = SOURCE_ALPHA * 0.7;

/** A percentage as the stylesheet writes it: at most two decimals. */
const percent = (share: number): string => `${Math.round(share * 10_000) / 100}%`;

/** The rays' colour at `alpha`, by relative colour syntax: never color-mix(), which Tailwind rewrites. */
const lit = (alpha: number): string => `oklch(from var(--light-rays) l c h / ${percent(alpha)})`;

type Viewport = LengthContext['viewport'];

/** Phones, a phone on its side, a tablet each way up, the 1440 desktop and tall desktops. */
const VIEWPORTS: readonly Viewport[] = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
];

/**
 * Page heights, in px: one screen, /media's skeleton (1,145 at 390 px), the home page (2,040),
 * /media with all 74 rows (4,861) and far past it. Never shorter than the screen (min-h-dvh).
 */
const PAGE_HEIGHTS = [0, 1145, 2040, 4861, 20_000] as const;

/** Whether an at-rule holds at a width: only `@media (width >= Nrem)` can; motion, forced colours and print do not. */
const holdsAtWidth = (condition: string, width: number): boolean => {
  const min = /^@media \(width >= ([\d.]+)rem\)$/.exec(condition)?.[1];
  return min !== undefined && width >= Number(min) * 16;
};

/** The custom properties the layer hands its rays at a width: its rule, then each width query it meets, in order. */
const layerVars = (width: number): Record<string, string> =>
  Object.fromEntries(
    RULES.filter(
      ({ selector, conditions }) =>
        selector === '.light-rays' && conditions.every((c) => holdsAtWidth(c, width)),
    ).flatMap(({ body }) => declarations(body).filter(([name]) => name.startsWith('--'))),
  );

/** How a ray's lengths resolve at a viewport on a page this tall (never shorter than the screen). */
const layout = (viewport: Viewport, pageHeight: number): LengthContext => ({
  viewport,
  // The layer is `inset: 0` in the shell root, as tall as the page: a percentage top is of that.
  percentOf: Math.max(pageHeight, viewport.height),
  vars: layerVars(viewport.width),
});

/** Where a ray's top lands, in px from the top of the page. */
const rayTop = (viewport: Viewport, pageHeight: number): number =>
  resolveLength(declaredValue(rule(RAY), 'top') ?? '', layout(viewport, pageHeight));

/** A ray's length, in px. */
const rayLength = (viewport: Viewport, pageHeight: number): number =>
  resolveLength(declaredValue(rule(RAY), 'height') ?? '', layout(viewport, pageHeight));

describe('light-rays.css', () => {
  it('is imported by globals.css, after the edge haze', () => {
    const haze = GLOBALS_CSS.search(/^@import "\.\/edge-haze\.css";$/m);
    const rays = GLOBALS_CSS.search(/^@import "\.\/light-rays\.css";$/m);

    expect(haze).toBeGreaterThan(-1);
    expect(rays).toBeGreaterThan(haze);
  });

  it("keeps LightRays' own colour", () => {
    expect(declaredValue(rule(':root'), '--light-rays')).toBe('rgb(88 68 188)');
    expect(RAYS_CSS).not.toMatch(/color-mix/);
  });

  it('paints the two glows where and as strongly as LightRays did, across the whole page', () => {
    const glows = rule('.light-glows');

    expect(GLOW_ALPHAS.map(percent)).toEqual(['5.4%', '4.2%']);
    expect(declaredValue(glows, 'background-image')).toBe(
      [
        `radial-gradient(circle at 20% 15%, ${lit(GLOW_ALPHAS[0])}, transparent 70%)`,
        `radial-gradient(circle at 80% 10%, ${lit(GLOW_ALPHAS[1])}, transparent 75%)`,
      ].join(', '),
    );
    // Sized to the root's box, the whole page, as before: no one-screen size or fixed attachment.
    expect(declarations(glows.body).map(([name]) => name)).toEqual(['background-image']);
  });

  it('lays the rays under the content in the isolated root, clipped to the page, taking no input', () => {
    const layer = rule('.light-rays');

    expect(declaredValue(layer, 'position')).toBe('absolute');
    expect(declaredValue(layer, 'inset')).toBe('0');
    expect(declaredValue(layer, 'z-index')).toBe('-1');
    expect(declaredValue(layer, 'overflow')).toBe('hidden');
    expect(declaredValue(layer, 'pointer-events')).toBe('none');
  });

  it('draws each ray as LightRays did: 70vh long, its own width, blurred 20 px', () => {
    const drawn = declarations(rule(RAY).body).filter(([name]) => name !== 'animation');

    expect(Object.fromEntries(drawn)).toEqual({
      '--ray-cycle': 'calc(var(--ray-duration) * 1.1)',
      position: 'absolute',
      top: 'calc(max(var(--ray-page), 100vh) * -0.12)',
      left: 'var(--ray-left)',
      width: 'var(--ray-width)',
      height: '70vh',
      'border-radius': '9999px',
      background: `linear-gradient(to bottom, ${lit(RAY_ALPHA)}, transparent)`,
      filter: 'blur(20px)',
      opacity: '0',
      translate: '-50% 0',
      rotate: 'var(--ray-rotate)',
      'transform-origin': '50% 0',
    });
  });

  it('hangs every ray in the same place however tall the page is or grows', () => {
    // The control: LightRays' `top: -12%` lands somewhere else at every page height, which moved
    // the rays (and scored a layout shift) when /media's list replaced its skeleton.
    const phone = { width: 390, height: 844 };
    const before = PAGE_HEIGHTS.map((height) => resolveLength('-12%', layout(phone, height)));
    expect(new Set(before).size).toBe(PAGE_HEIGHTS.length);

    for (const viewport of VIEWPORTS) {
      const at = `${viewport.width}x${viewport.height}`;
      const tops = PAGE_HEIGHTS.map((height) => rayTop(viewport, height));
      const lengths = PAGE_HEIGHTS.map((height) => rayLength(viewport, height));

      expect(tops, at).toEqual(tops.map(() => tops[0]));
      expect(lengths, at).toEqual(lengths.map(() => lengths[0]));
    }
  });

  it("keeps the home page's first screen: the rays hang where they hung on it", () => {
    // Measured on a production build before the change: the home page was 2,041 px tall at
    // 390 x 844, its rays at -244.9 px, and 954 px tall at 1440 x 900, its rays at -114.5 px.
    expect(rayTop({ width: 390, height: 844 }, 4861)).toBeCloseTo(-244.9, 0);
    expect(rayTop({ width: 1440, height: 900 }, 4861)).toBeCloseTo(-114.5, 0);
    // A screen taller than the home page: 12% of the screen, as the shell is never shorter.
    expect(rayTop({ width: 1920, height: 1080 }, 0)).toBeCloseTo(-129.6, 1);
    expect(rayTop({ width: 2560, height: 1440 }, 0)).toBeCloseTo(-172.8, 1);
  });

  it('starts every ray above the page and ends it on the first screen, lit for a stretch of it', () => {
    for (const viewport of VIEWPORTS) {
      const at = `${viewport.width}x${viewport.height}`;
      const top = rayTop(viewport, 4861);
      const end = top + rayLength(viewport, 4861);

      expect(top, at).toBeLessThan(0);
      expect(end, at).toBeLessThan(viewport.height);
      expect(end, at).toBeGreaterThan(viewport.height / 4);
    }
  });

  it("fades each ray in and out while it swings, then rests a tenth of its cycle (motion's repeatDelay)", () => {
    // One cycle earlier than its delay: every ray is already in its cycle at the first paint, with
    // no dark wait, and the haze never pauses one before it has lit. The phase at any time t is
    // (t - delay) mod cycle, as motion's delay and repeatDelay gave it once running.
    expect(declaredValue(rule(RAY), 'animation')).toBe(
      'light-ray var(--ray-cycle) ease-in-out calc(var(--ray-delay) - var(--ray-cycle)) infinite',
    );
    // The peak halfway through the swing (0.5 / 1.1), back to nothing at its end (1 / 1.1).
    const swing = (sign: '+' | '-') => `rotate: calc(var(--ray-rotate) ${sign} var(--ray-swing));`;
    expect(rule('@keyframes light-ray').body.trim()).toBe(
      [
        `0% { opacity: 0; ${swing('-')} }`,
        `${(50 / 1.1).toFixed(2)}% { opacity: var(--ray-peak); ${swing('+')} }`,
        `${(100 / 1.1).toFixed(2)}%, 100% { opacity: 0; ${swing('-')} }`,
      ].join(' '),
    );
  });

  it('moves the rays by opacity and rotate alone, under a name the edge haze pauses', () => {
    const keyframes = rule('@keyframes light-ray').body;
    const animated = new Set([...keyframes.matchAll(/([a-z-]+):/g)].map(([, name]) => name));

    expect([...animated].sort()).toEqual(['opacity', 'rotate']);
    expect(isPausableAnimation('light-ray')).toBe(true);
    // The shorthand resets animation-play-state, which the haze's `:root [data-under-edge]`
    // (0,2,0) outranks over `.light-rays > i` (0,1,1): nothing here may set it again.
    expect(RAYS_CSS).not.toMatch(/animation-play-state/);
  });

  it('holds the rays still at 60% of their peak under reduced motion, over the global 1 ms rule', () => {
    const still = rule(RAY, [MEDIA_REDUCED_MOTION]);

    expect(declaredValue(still, 'animation-name')).toBe('none !important');
    expect(declaredValue(still, 'opacity')).toBe('calc(var(--ray-peak) * 0.6)');
    // Nothing else: a still ray hangs where a moving one does, and never moves as the page grows.
    expect(declarations(still.body).map(([name]) => name)).toEqual(['animation-name', 'opacity']);

    // globals.css cuts every animation to 1 ms, one iteration, with !important: a ray would end
    // at its 0% frame, opacity 0. It never sets animation-name or opacity, so nothing outranks
    // the `none` above, and the still opacity applies.
    const global = findRule(styleRules(GLOBALS_CSS), '*, *::before, *::after', [
      MEDIA_REDUCED_MOTION,
    ]);
    const globalProperties = declarations(global.body).map(([name]) => name);
    expect(globalProperties).toContain('animation-duration');
    expect(globalProperties).not.toContain('animation-name');
    expect(globalProperties).not.toContain('animation');
    expect(globalProperties).not.toContain('opacity');
  });

  it('draws neither glows nor rays in forced colours or in print', () => {
    expect(declaredValue(rule('.light-glows', [MEDIA_NO_LIGHTS]), 'background-image')).toBe('none');
    expect(declaredValue(rule('.light-rays', [MEDIA_NO_LIGHTS]), 'display')).toBe('none');
  });

  it('runs one animation and asks for no transition or will-change', () => {
    expect(RULES.filter(({ selector }) => selector.startsWith('@keyframes'))).toHaveLength(1);
    expect(RAYS_CSS).not.toMatch(/transition|will-change/);
  });
});
