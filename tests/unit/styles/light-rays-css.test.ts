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
 * content, 70vh long from 12% above the page, 20 px blur, the colour at 70%, each fading in and
 * out while it swings and resting a tenth of its cycle, by opacity and rotate alone. Under reduced
 * motion they hold still at 60% of their peak (the global rule would end them at 0 after 1 ms);
 * forced colours and print draw neither. The stylesheet is read as text (Vitest runs no PostCSS).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { isPausableAnimation } from '@/components/layout/pause-under-edge';
import { type CssRule, declarations, declaredValue, findRule, styleRules } from './css-rules';

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

  it('draws each ray as LightRays did: 70vh from 12% above the page, its own width, blurred 20 px', () => {
    const drawn = declarations(rule(RAY).body).filter(([name]) => name !== 'animation');

    expect(Object.fromEntries(drawn)).toEqual({
      '--ray-cycle': 'calc(var(--ray-duration) * 1.1)',
      position: 'absolute',
      top: '-12%',
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
