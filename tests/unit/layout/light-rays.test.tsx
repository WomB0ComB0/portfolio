// @vitest-environment node
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
 * @file The light rays behind every page (src/components/layout/light-rays.tsx), restored after
 * #603 removed `<LightRays count={5} blur={20} />` ("it added some needed color").
 *
 * The five rays LightRays drew, but fixed: createRays' draws in their order from seed 603 instead
 * of Math.random(), so the server and the client render the same markup and nothing flashes in
 * after hydration. A server component with no hooks, no animation library and no client code;
 * light-rays.css draws, fades and swings each ray from the custom properties it carries. Rendered
 * here with react-dom/server in Node, without a DOM.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LIGHT_RAYS, LightRays } from '@/components/layout/light-rays';

/** The component's code, without its comments (which name what it no longer uses). */
const SOURCE = readFileSync(
  join(process.cwd(), 'src/components/layout/light-rays.tsx'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

/** The rays the lab chose (option 0 at its defaults: count 5), in draw order. */
const EXPECTED_RAYS = [
  { left: 90.5, width: 221, rotate: -7.9, swing: 2.5, duration: 12, delay: 12.2, peak: 0.84 },
  { left: 21.7, width: 272, rotate: -24, swing: 2, duration: 17.2, delay: 4.7, peak: 0.72 },
  { left: 38.8, width: 307, rotate: 10.6, swing: 1.1, duration: 16.5, delay: 11.6, peak: 0.73 },
  { left: 53.5, width: 271, rotate: 16, swing: 1.9, duration: 15, delay: 2.9, peak: 0.86 },
  { left: 20.6, width: 258, rotate: 12.4, swing: 1.9, duration: 15.1, delay: 1.3, peak: 0.81 },
] as const;

/** LightRays' cycle before #603 (its `speed` prop, 14 s). */
const CYCLE_S = 14;

/** mulberry32: the small seeded generator the lab drew the rays with. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * createRays() as it was before #603 (git show d0c6f71^:src/components/magicui/light-rays.tsx):
 * the same seven draws per ray in the same order, from the seed, rounded as the lab rounded them
 * (a peak above 1 is drawn as 1, as opacity clamps it).
 */
function drawRays(count: number, seed: number) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => {
    const left = 8 + random() * 84;
    const rotate = -28 + random() * 56;
    const width = 160 + random() * 160;
    const swing = 0.8 + random() * 1.8;
    const delay = random() * CYCLE_S;
    const duration = CYCLE_S * (0.75 + random() * 0.5);
    const peak = 0.6 + random() * 0.5;
    return {
      left: round1(left),
      width: Math.round(width),
      rotate: round1(rotate),
      swing: round1(swing),
      duration: round1(duration),
      delay: round1(delay),
      peak: round2(Math.min(1, peak)),
    };
  });
}

/** Each ray's inline custom properties, as the server writes them. */
function rayStyles(markup: string): Record<string, string>[] {
  return [...markup.matchAll(/<i style="([^"]*)"><\/i>/g)].map(([, style = '']) =>
    Object.fromEntries(
      style
        .split(';')
        .filter(Boolean)
        .map((declaration) => {
          const colon = declaration.indexOf(':');
          return [declaration.slice(0, colon), declaration.slice(colon + 1)];
        }),
    ),
  );
}

describe('LightRays', () => {
  it('renders the five rays LightRays drew, each with its own custom properties', () => {
    const markup = renderToStaticMarkup(<LightRays />);

    expect(rayStyles(markup)).toEqual(
      EXPECTED_RAYS.map((ray) => ({
        '--ray-left': `${ray.left}%`,
        '--ray-width': `${ray.width}px`,
        '--ray-rotate': `${ray.rotate}deg`,
        '--ray-swing': `${ray.swing}deg`,
        '--ray-duration': `${ray.duration}s`,
        '--ray-delay': `${ray.delay}s`,
        '--ray-peak': String(ray.peak),
      })),
    );
  });

  it('is one decorative layer, hidden from assistive technology, with nothing to focus', () => {
    const markup = renderToStaticMarkup(<LightRays />);

    expect(markup).toMatch(
      /^<div class="light-rays" aria-hidden="true">(?:<i style="[^"]*"><\/i>){5}<\/div>$/,
    );
    expect(markup).not.toMatch(/tabindex|role=|href=/);
  });

  it("draws them from seed 603 with createRays' draws in their order", () => {
    expect(LIGHT_RAYS).toEqual(EXPECTED_RAYS);
    expect(drawRays(EXPECTED_RAYS.length, 603)).toEqual(EXPECTED_RAYS);
  });

  it('waits less than one cycle (its duration and a tenth) to fade each ray in, so light-rays.css starts it already lit', () => {
    // light-rays.css starts each ray one cycle before its delay: a negative delay, so at the
    // first paint it is part way through a cycle instead of dark until the delay ends.
    for (const ray of LIGHT_RAYS) {
      expect(ray.delay, `ray at ${ray.left}%`).toBeLessThan(ray.duration * 1.1);
    }
  });

  it('is a server component: no client directive, hooks, animation library or randomness', () => {
    expect(SOURCE).not.toMatch(/^\s*['"]use client['"]/m);
    expect(SOURCE).not.toMatch(/from ['"](?:motion|framer-motion)/);
    expect(SOURCE).not.toMatch(
      /\buse(?:State|Effect|LayoutEffect|InsertionEffect|Ref|Memo|Callback|Reducer|SyncExternalStore|Transition)\b/,
    );
    expect(SOURCE).not.toMatch(/Math\.random|Date\.now|performance\.now/);
  });

  it('renders the same markup every time, so the server and the client agree', async () => {
    const first = renderToStaticMarkup(<LightRays />);
    vi.resetModules();
    const fresh = await import('@/components/layout/light-rays');

    expect(renderToStaticMarkup(<LightRays />)).toBe(first);
    expect(renderToStaticMarkup(<fresh.LightRays />)).toBe(first);
  });
});
