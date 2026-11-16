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
 * @file The scroll edge haze's stylesheet (src/styles/edge-haze.css) keeps the owner's settings
 * from the blur lab and every fallback.
 *
 * Variant A (Scroll edge) with the settings he picked: bands 11% of the screen tall (77 to
 * 132 px), 8 blur layers up to 6 px, the lighter stack on phones (7 layers up to 5 px), a 59%
 * canvas tint. Each blur and mask keeps its -webkit- twin for Safari; reduced transparency and
 * browsers without backdrop-filter get a plain canvas scrim; forced colours draw nothing; the
 * bands fade with the scroll position only (scroll-driven, or the component's script), so
 * nothing in the haze moves on its own. The stylesheet is read as text (Vitest runs no PostCSS);
 * e2e/visual/edge-haze.spec.ts checks the built CSS in a browser.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { FILTER_SCOPE_CLASS } from '@/components/console/filter-bar';
import { PINNED_BAR_HEIGHT_PROPERTY } from '@/components/console/filter-bar/bar';
import {
  EDGE_HAZE_BAR_SHIFT,
  EDGE_HAZE_BOTTOM_OPACITY,
  EDGE_HAZE_LAYERS,
  EDGE_HAZE_TOP_OPACITY,
  STICKY_FILTER_BAR,
} from '@/components/layout/edge-haze';
import { type CssRule, declarations, declaredValue, findRule, styleRules } from './css-rules';

/** The sticky FilterBar's view timeline, which the top band follows. */
const BAR_TIMELINE = '--filter-bar';

// Vitest runs from the repository root; under jsdom import.meta.url is not a file: URL.
const STYLES = join(process.cwd(), 'src/styles');
const HAZE_CSS = readFileSync(join(STYLES, 'edge-haze.css'), 'utf8');
const GLOBALS_CSS = readFileSync(join(STYLES, 'globals.css'), 'utf8');

const RULES = styleRules(HAZE_CSS);

const MEDIA_LG = '@media (width >= 64rem)';
const MEDIA_COARSE = '@media (pointer: coarse)';
const MEDIA_WIDE = '@media (width >= 85rem) and (pointer: fine)';
const MEDIA_REDUCED_TRANSPARENCY = '@media (prefers-reduced-transparency: reduce)';
const MEDIA_FORCED_COLORS = '@media (forced-colors: active)';
const MEDIA_PRINT = '@media print';
const NO_BACKDROP_FILTER =
  '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))';
const NO_SCROLL_TIMELINE = '@supports not (animation-timeline: scroll())';

/** The one rule with this selector under exactly these at-rules. */
const rule = (selector: string, conditions: readonly string[] = []): CssRule =>
  findRule(RULES, selector, conditions);

/** A property's value in a rule (the last declaration wins, as in CSS). */
const value = declaredValue;

/**
 * The canvas token at `alpha`, never a literal copy of its colour, and never color-mix(): Tailwind
 * gives color-mix() a full-strength var(--canvas) fallback, which would paint a solid band.
 */
const canvas = (alpha: number) => `oklch(from var(--canvas) l c h / ${alpha}%)`;
const canvasAt = (alpha: number, position: number) => `${canvas(alpha)} ${position}%`;

const TINT_RAMP = [
  canvasAt(59, 0),
  canvasAt(47, 18),
  canvasAt(34, 37),
  canvasAt(21, 57),
  canvasAt(9, 78),
  'transparent 100%',
].join(', ');

const SCRIM_RAMP = [
  canvasAt(94, 0),
  canvasAt(86, 22),
  canvasAt(64, 45),
  canvasAt(34, 70),
  'transparent 100%',
].join(', ');

/** The lab's fine-pointer stack: [top or bottom offset, height, blur radius] per layer. */
const DESKTOP_STACK = [
  ['66.67%', '33.33%', '1px'],
  ['55.56%', '33.33%', '1.29px'],
  ['44.44%', '33.33%', '1.67px'],
  ['33.33%', '33.33%', '2.16px'],
  ['22.22%', '33.33%', '2.78px'],
  ['11.11%', '33.33%', '3.6px'],
  ['0%', '33.33%', '4.65px'],
  ['0%', '22.22%', '6px'],
] as const;

/** The lighter stack under a coarse pointer (phones and tablets). */
const PHONE_STACK = [
  ['62.5%', '37.5%', '1px'],
  ['50%', '37.5%', '1.31px'],
  ['37.5%', '37.5%', '1.71px'],
  ['25%', '37.5%', '2.24px'],
  ['12.5%', '37.5%', '2.92px'],
  ['0%', '37.5%', '3.82px'],
  ['0%', '25%', '5px'],
] as const;

/**
 * The owner's 11% bands, 77 to 132 px, with a smaller floor on short screens (owner decision,
 * 2026-11-07): under 550 px of height the floor follows 14svh, so landscape phones and high zoom
 * keep most of the page clear. Every screen 550 px tall or more is unchanged.
 */
const BAND_HEIGHT = 'clamp(min(77px, 14svh), 11svh, 132px)';

describe('edge-haze.css', () => {
  it('is imported by globals.css', () => {
    expect(GLOBALS_CSS).toMatch(/^@import "\.\/edge-haze\.css";$/m);
  });

  it("keeps the owner's band heights: 11% of the screen, 77 to 132 px, top and bottom", () => {
    expect(value(rule(':root'), '--edge-haze-top')).toBe(BAND_HEIGHT);
    expect(value(rule(':root'), '--edge-haze-bottom')).toBe(BAND_HEIGHT);
    expect(value(rule('.edge-haze > .t'), 'height')).toBe('var(--edge-haze-top)');
    expect(value(rule('.edge-haze > .b'), 'height')).toBe('var(--edge-haze-bottom)');
  });

  it('is one fixed layer over the content that takes no input, clear of the bottom bar and the rail', () => {
    const haze = rule('.edge-haze');

    expect(value(haze, 'position')).toBe('fixed');
    expect(value(haze, 'pointer-events')).toBe('none');
    // Over content (z-10 at most), under the FilterBar (30), the rail (40) and the bar (50).
    expect(value(haze, 'z-index')).toBe('20');
    expect(value(haze, 'inset')).toBe('0 0 var(--mobile-bar-total)');
    expect(value(rule('.edge-haze', [MEDIA_LG]), 'inset')).toBe('0 0 0 4rem');
  });

  it('centres the bands at the page column width, as main is', () => {
    const band = rule('.edge-haze > div');

    expect(value(band, 'max-width')).toBe('var(--container-shell)');
    expect(value(band, 'margin-inline')).toBe('auto');
    expect(value(band, 'inset-inline')).toBe('0');
  });

  it('puts no opacity, filter or mask on the haze or a band, which would cut the blur off', () => {
    const wrappers = new Set([
      '.edge-haze',
      '.edge-haze > div',
      '.edge-haze > .t',
      '.edge-haze > .b',
    ]);
    const isolating =
      /^(?:-webkit-)?(?:opacity|filter|backdrop-filter|mask|mask-image|clip-path|mix-blend-mode|will-change)$/;

    const offenders = RULES.filter((candidate) => wrappers.has(candidate.selector)).flatMap(
      (candidate) =>
        declarations(candidate.body)
          .filter(([property]) => isolating.test(property))
          .map(([property]) => `${candidate.selector} ${property}`),
    );
    expect(offenders).toEqual([]);
  });

  it('stacks 8 layers from 1 to 6 px on a fine pointer', () => {
    expect(EDGE_HAZE_LAYERS).toBe(DESKTOP_STACK.length);
    DESKTOP_STACK.forEach(([at, span, blur], index) => {
      const layer = rule(`.edge-haze .l:nth-child(${index + 1})`);
      expect([
        value(layer, '--edge-haze-at'),
        value(layer, '--edge-haze-span'),
        value(layer, '--edge-haze-blur'),
      ]).toEqual([at, span, blur]);
    });
    // Each layer's band fades in and out; the last, strongest one runs to the screen edge.
    expect(value(rule('.edge-haze .l:nth-child(8)'), '--edge-haze-fade')).toBe(
      'var(--edge-haze-fade-end)',
    );
  });

  it('stacks 7 layers from 1 to 5 px under a coarse pointer (the lighter phone stack)', () => {
    PHONE_STACK.forEach(([at, span, blur], index) => {
      const layer = rule(`.edge-haze .l:nth-child(${index + 1})`, [MEDIA_COARSE]);
      expect([
        value(layer, '--edge-haze-at'),
        value(layer, '--edge-haze-span'),
        value(layer, '--edge-haze-blur'),
      ]).toEqual([at, span, blur]);
    });
    expect(value(rule('.edge-haze .l:nth-child(7)', [MEDIA_COARSE]), '--edge-haze-fade')).toBe(
      'var(--edge-haze-fade-end)',
    );
    expect(value(rule('.edge-haze .l:nth-child(n + 8)', [MEDIA_COARSE]), 'display')).toBe('none');
    expect(value(rule('.edge-haze > .t > .cap', [MEDIA_COARSE]), 'backdrop-filter')).toBe(
      'blur(5px)',
    );
  });

  it('draws each layer from its band, blur and mask', () => {
    const layer = rule('.edge-haze > div > .l');

    expect(value(layer, 'height')).toBe('var(--edge-haze-span)');
    expect(value(layer, 'backdrop-filter')).toBe('blur(var(--edge-haze-blur))');
    expect(value(layer, 'mask-image')).toBe('var(--edge-haze-fade)');
    expect(value(rule('.edge-haze > .t > .l'), 'top')).toBe('var(--edge-haze-at)');
    expect(value(rule('.edge-haze > .b > .l'), 'bottom')).toBe('var(--edge-haze-at)');
    expect(value(rule('.edge-haze > .t'), '--edge-haze-fade')).toBe(
      'linear-gradient(to top, transparent 0%, #000 33.33%, #000 66.67%, transparent 100%)',
    );
    expect(value(rule('.edge-haze > .t'), '--edge-haze-fade-end')).toBe(
      'linear-gradient(to top, transparent 0%, #000 50%, #000 100%, #000 100%)',
    );
    expect(value(rule('.edge-haze > .b'), '--edge-haze-fade')).toBe(
      'linear-gradient(to bottom, transparent 0%, #000 33.33%, #000 66.67%, transparent 100%)',
    );
    expect(value(rule('.edge-haze > .b'), '--edge-haze-fade-end')).toBe(
      'linear-gradient(to bottom, transparent 0%, #000 50%, #000 100%, #000 100%)',
    );
  });

  it('writes every blur and mask with its -webkit- twin first, and both mask composites, for Safari', () => {
    const twins = [
      ['backdrop-filter', '-webkit-backdrop-filter'],
      ['mask-image', '-webkit-mask-image'],
    ] as const;
    let checked = 0;
    for (const candidate of RULES) {
      const list = declarations(candidate.body);
      for (const [standard, prefixed] of twins) {
        const at = list.findIndex(([name]) => name === standard);
        if (at === -1) continue;
        checked += 1;
        const twin = list.findIndex(([name]) => name === prefixed);
        expect(twin, `${candidate.selector}: no ${prefixed}`).toBeGreaterThanOrEqual(0);
        expect(twin, `${candidate.selector}: ${prefixed} after ${standard}`).toBeLessThan(at);
        expect(list[twin]?.[1]).toBe(list[at]?.[1]);
      }
      const composite = value(candidate, 'mask-composite');
      if (composite) {
        expect(composite).toBe('intersect');
        expect(value(candidate, '-webkit-mask-composite')).toBe('source-in');
      }
    }
    expect(checked).toBeGreaterThanOrEqual(8);
  });

  it('tints with the canvas token at 59%, eased to nothing', () => {
    expect(value(rule('.edge-haze'), '--edge-haze-ramp')).toBe(TINT_RAMP);
    expect(value(rule('.edge-haze > .t > .tn'), 'background-image')).toBe(
      'linear-gradient(to bottom, var(--edge-haze-ramp))',
    );
    expect(value(rule('.edge-haze > .b > .tn'), 'background-image')).toBe(
      'linear-gradient(to top, var(--edge-haze-ramp))',
    );
    // No literal copy of the canvas, and no color-mix() (outside comments).
    const code = HAZE_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/oklch\(\s*16%/);
    expect(code).not.toMatch(/color-mix\(/);
  });

  it('fills a notch or status bar above the top band with the full blur', () => {
    const cap = rule('.edge-haze > .t > .cap');

    expect(value(rule('.edge-haze > .t'), 'top')).toBe('env(safe-area-inset-top, 0)');
    expect(value(cap, 'bottom')).toBe('100%');
    expect(value(cap, 'height')).toBe('env(safe-area-inset-top, 0)');
    expect(value(cap, 'backdrop-filter')).toBe('blur(6px)');
    expect(value(cap, 'background')).toBe(canvas(59));
  });

  it('feathers the sides over 48 px from 85rem on a fine pointer, where the canvas shows beside the column', () => {
    expect(value(rule('.edge-haze', [MEDIA_WIDE]), '--edge-haze-feather')).toBe(
      'linear-gradient(to right, transparent, #000 48px, #000 calc(100% - 48px), transparent)',
    );
    expect(value(rule('.edge-haze > div > .l', [MEDIA_WIDE]), 'mask-image')).toBe(
      'var(--edge-haze-fade), var(--edge-haze-feather)',
    );
    expect(value(rule('.edge-haze > div > .tn', [MEDIA_WIDE]), 'mask-image')).toBe(
      'var(--edge-haze-feather)',
    );
  });

  it.each([
    ['reduced transparency', MEDIA_REDUCED_TRANSPARENCY],
    ['no backdrop-filter', NO_BACKDROP_FILTER],
  ])('drops the blur for a straight, full-width canvas scrim under %s', (_name, condition) => {
    expect(value(rule('.edge-haze > div > .l', [condition]), 'display')).toBe('none');
    expect(value(rule('.edge-haze', [condition]), '--edge-haze-ramp')).toBe(SCRIM_RAMP);
    const tint = rule('.edge-haze > div > .tn', [condition]);
    expect(value(tint, 'mask-image')).toBe('none');
    expect(value(tint, '-webkit-mask-image')).toBe('none');
    const cap = rule('.edge-haze > .t > .cap', [condition]);
    expect(value(cap, 'backdrop-filter')).toBe('none');
    expect(value(cap, 'background')).toBe(canvas(94));
  });

  it('draws nothing in forced colours', () => {
    expect(value(rule('.edge-haze', [MEDIA_FORCED_COLORS]), 'display')).toBe('none');
  });

  it('prints nothing, and pads no printed page for the bands', () => {
    // Fixed, the haze would repeat on every printed page, its bottom band blanking the last rows.
    expect(value(rule('.edge-haze', [MEDIA_PRINT]), 'display')).toBe('none');
    const printed = rule('html', [MEDIA_PRINT]);
    expect(value(printed, 'scroll-padding-block')).toBe('0');
    // After both screen paddings, so it wins over them at every width (same specificity).
    expect(RULES.indexOf(printed)).toBeGreaterThan(RULES.indexOf(rule('html')));
    expect(RULES.indexOf(printed)).toBeGreaterThan(RULES.indexOf(rule('html', [MEDIA_LG])));
  });

  it('fades the top band in over the first band height of scroll and the bottom one out over the last', () => {
    const top = declarations(rule('.edge-haze > .t > i').body);
    const bottom = declarations(rule('.edge-haze > .b > i').body);
    // Longhands only: a minifier with recent browser targets (the dev server's) folds the
    // timeline into an `animation` shorthand, which Chromium then drops whole, so the bands never
    // showed in development. With no shorthand there is nothing to fold into.
    const fade = (name: string, range: string): [string, string][] => [
      ['animation-name', name],
      ['animation-duration', 'auto'],
      ['animation-timing-function', 'linear'],
      ['animation-fill-mode', 'both'],
      ['animation-timeline', 'scroll(root block)'],
      ['animation-range', range],
    ];
    expect(top).toEqual(fade('edge-haze-in', '0 var(--edge-haze-top)'));
    expect(bottom).toEqual(fade('edge-haze-out', 'calc(100% - var(--edge-haze-bottom)) 100%'));
    expect(RULES.filter((candidate) => declaredValue(candidate, 'animation'))).toEqual([]);
    expect(rule('@keyframes edge-haze-in').body).toMatch(
      /from \{ opacity: 0; \} to \{ opacity: 1; \}/,
    );
    expect(rule('@keyframes edge-haze-out').body).toMatch(
      /from \{ opacity: 1; \} to \{ opacity: 0; \}/,
    );
  });

  it("lets the component's script drive the fade where there is no scroll timeline", () => {
    const top = rule('.edge-haze > .t > i', [NO_SCROLL_TIMELINE]);
    const bottom = rule('.edge-haze > .b > i', [NO_SCROLL_TIMELINE]);

    expect(value(top, 'animation-name')).toBe('none');
    expect(value(bottom, 'animation-name')).toBe('none');
    // Until the script runs, the first paint is at the top of the page: the top band hidden and
    // the bottom one shown, so it does not snap on at hydration (the script hides it on a page
    // too short to scroll).
    expect(value(top, 'opacity')).toBe(`var(${EDGE_HAZE_TOP_OPACITY}, 0)`);
    expect(value(bottom, 'opacity')).toBe(`var(${EDGE_HAZE_BOTTOM_OPACITY}, 1)`);
  });

  it('runs no animation on time: every one follows the scroll, so reduced motion has nothing to stop', () => {
    // The page's scroll, or a sticky FilterBar's view timeline (which follows the scroll too).
    const scrollDriven = new Set(['scroll(root block)', BAR_TIMELINE]);
    const timed = RULES.filter((candidate) => {
      const animation = value(candidate, 'animation-name');
      if (!animation || animation === 'none') return false;
      const names = animation.split(',');
      const timelines = (value(candidate, 'animation-timeline') ?? '').split(',');
      return names.some((_name, index) => !scrollDriven.has(timelines[index]?.trim() ?? ''));
    });
    expect(timed.map((candidate) => candidate.selector)).toEqual([]);
    expect(HAZE_CSS).not.toMatch(/transition/);
  });

  describe('under a pinned FilterBar', () => {
    const SUPPORTS_BAR_TIMELINE = `@supports (timeline-scope: ${BAR_TIMELINE})`;
    const NO_BAR_TIMELINE = `@supports not (timeline-scope: ${BAR_TIMELINE})`;
    /** The top layers, only on a page that has a sticky bar. */
    const UNDER_BAR_LAYERS = `:root:has(${STICKY_FILTER_BAR}) .edge-haze > .t > i`;

    it('gives the rise and the return only to a page with a sticky bar, so other pages list neither', () => {
      // Without a bar the timeline is inactive: the two would move nothing, yet every top layer
      // on home and the project pages would list them as running (home-bento.spec.ts).
      const carriers = RULES.filter((candidate) =>
        /edge-haze-(?:rise|return)/.test(value(candidate, 'animation-name') ?? ''),
      );
      expect(carriers.map((candidate) => candidate.selector)).toEqual([UNDER_BAR_LAYERS]);
      // The plain fade stays on every page.
      expect(value(rule('.edge-haze > .t > i'), 'animation-name')).toBe('edge-haze-in');
    });

    it("exposes the sticky bar's own view timeline, its range inset to the top band", () => {
      expect(value(rule(':root'), 'timeline-scope')).toBe(BAR_TIMELINE);
      const bar = rule(STICKY_FILTER_BAR);
      expect(value(bar, 'view-timeline-name')).toBe(BAR_TIMELINE);
      expect(value(bar, 'view-timeline-axis')).toBe('block');
      // From the safe-area inset to the band's end: the range is the band itself.
      expect(value(bar, 'view-timeline-inset')).toBe(
        'env(safe-area-inset-top, 0) calc(100% - var(--edge-haze-top) - env(safe-area-inset-top, 0px))',
      );
    });

    it("rises by the band's height less the bar's, never below 0, the shortest bar's before it measures", () => {
      expect(value(rule('.edge-haze > .t'), '--edge-haze-rise')).toBe(
        `max(0px, var(--edge-haze-top) - var(${PINNED_BAR_HEIGHT_PROPERTY}, 3.5rem))`,
      );
      // 3.5rem is the phone bar (a 40px field and 8px above and below), the shortest there is.
      expect(FILTER_SCOPE_CLASS).toContain('[--filter-bar-h:3.5rem]');
    });

    it('raises the layers with the bar, holds them while it is pinned and lowers them as it leaves', () => {
      const layers = rule(UNDER_BAR_LAYERS, [SUPPORTS_BAR_TIMELINE]);

      expect(value(layers, 'animation-name')).toBe(
        'edge-haze-in, edge-haze-rise, edge-haze-return',
      );
      expect(value(layers, 'animation-timeline')).toBe(
        `scroll(root block), ${BAR_TIMELINE}, ${BAR_TIMELINE}`,
      );
      // The fade as before; the rise while the bar's lower edge crosses the band; the return as
      // the bar leaves at the end of its sticky travel.
      expect(value(layers, 'animation-range')).toBe(
        '0 var(--edge-haze-top), contain 0% contain var(--edge-haze-rise), exit 0% exit 100%',
      );
      expect(value(layers, 'animation-composition')).toBe('replace, replace, add');
      expect(rule('@keyframes edge-haze-rise').body).toMatch(
        /from \{ translate: 0 0; \} to \{ translate: 0 calc\(-1 \* var\(--edge-haze-rise\)\); \}/,
      );
      expect(rule('@keyframes edge-haze-return').body).toMatch(
        /from \{ translate: 0 0; \} to \{ translate: 0 var\(--edge-haze-rise\); \}/,
      );
    });

    it("lets the component's script raise the layers where there is no view timeline", () => {
      expect(value(rule('.edge-haze > .t > i', [NO_BAR_TIMELINE]), 'translate')).toBe(
        `0 calc(-1 * var(${EDGE_HAZE_BAR_SHIFT}, 0px))`,
      );
    });

    it('moves the layers, never the haze or a band, so nothing cuts the blur off in any engine', () => {
      const wrappers = new Set(['.edge-haze', '.edge-haze > div', '.edge-haze > .t']);
      const moving = /^(?:translate|transform|rotate|scale|animation-name|animation)$/;
      const offenders = RULES.filter((candidate) => wrappers.has(candidate.selector)).flatMap(
        (candidate) =>
          declarations(candidate.body)
            .filter(([property]) => moving.test(property))
            .map(([property]) => `${candidate.selector} ${property}`),
      );
      expect(offenders).toEqual([]);
    });
  });

  it('keeps focus, find-in-page and #hash targets clear of both bands', () => {
    expect(value(rule('html'), 'scroll-padding-block')).toBe(
      'calc(var(--edge-haze-top) + env(safe-area-inset-top, 0px)) calc(var(--edge-haze-bottom) + var(--mobile-bar-total))',
    );
    // From lg the top padding never drops under /projects' sticky FilterBar (74 px), even where a
    // short screen's band is shorter than that.
    // The top band starts below the safe-area inset (an iPad home-screen app in landscape is lg),
    // so the padding counts the inset too (CodeRabbit on #614).
    expect(value(rule('html', [MEDIA_LG]), 'scroll-padding-block')).toBe(
      'max(calc(var(--edge-haze-top) + env(safe-area-inset-top, 0px)), 4.625rem) var(--edge-haze-bottom)',
    );
  });

  it('pauses only the element marked as under a band (pause-under-edge.ts), above a single class', () => {
    const pauses = RULES.filter((candidate) => candidate.selector.includes('[data-under-edge]'));

    // :root plus the attribute (0,2,0) beats a CSS module's one-class rule such as the
    // equaliser's .live, whatever order the stylesheets load in; Tailwind's are layered.
    expect(pauses.map((candidate) => candidate.selector)).toEqual([':root [data-under-edge]']);
    expect(value(rule(':root [data-under-edge]'), 'animation-play-state')).toBe('paused');
  });
});
