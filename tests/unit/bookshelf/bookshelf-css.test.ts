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
 * @file The bookshelf's motion CSS, read as text (Vitest runs no PostCSS):
 * - every var() the cursor and the book detail read resolves where they render, outside the
 *   stage's .shelf-shell, so their transitions and the detail's wipe run (on the site's
 *   --ease-out-expo, never a token scoped to the shell);
 * - only compositor properties move: the ring cursor scales a disc drawn at its open size, the
 *   slot shadow scales on x, and the status card's rule is clipped, never resized;
 * - the end states each motion lands on are declared, and the reduced-motion resets still win.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FINE_POINTER_MEDIA,
  globalTokens,
  losingReducedMotionResets,
  nonCompositorTransitions,
  readCss,
  styleRules,
  unresolvedVars,
  varsRead,
} from '../places/module-css';
import { declaredValue, findRule } from '../styles/css-rules';

const COMPONENTS = 'src/app/(routes)/(main)/(personal)/bookshelf/_components';
const STAGE_CSS = `${COMPONENTS}/bookshelf-stage.module.css`;
const SLOT_CSS = `${COMPONENTS}/bookshelf-book-slot.module.css`;
const CARDS_CSS = `${COMPONENTS}/shelf-cards-grid.module.css`;
const DETAIL_CSS = `${COMPONENTS}/book-detail-view.module.css`;
/** The modules whose transitions move the stage, its books and the shelf cards. */
const MOTION_MODULES = [STAGE_CSS, SLOT_CSS, CARDS_CSS] as const;

/** Set inline by book-detail-view.tsx (--topic-rows, --d, --rd) or by next/font (the mono face). */
const DETAIL_RUNTIME_VARS = new Set(['--topic-rows', '--d', '--rd', '--font-geist-mono']);
/** Transitions that size or place a box: the layout work the owner's rules keep off the stage. */
const LAYOUT_PROPERTY = /: (?:all|width|height|inset|top|left|right|bottom|margin|padding)\b/;
/** Tailwind classes that transition every property or size a box on hover. */
const LAYOUT_UTILITIES = [
  'transition-all',
  'hover:w-',
  'hover:h-',
  'transition-[width',
  'transition-[height',
];

/** A declared value of `selector` (under `conditions`), failing loudly when it is missing. */
function declared(
  css: string,
  selector: string,
  property: string,
  conditions: readonly string[] = [],
): string {
  const found = declaredValue(findRule(styleRules(readCss(css)), selector, conditions), property);
  if (found === undefined) throw new Error(`${selector} sets no ${property}`);
  return found;
}

describe('the bookshelf motion tokens resolve where they are used', () => {
  it('leaves the book detail no var() it cannot resolve, so its wipe runs', () => {
    const unresolved = unresolvedVars(readCss(DETAIL_CSS)).filter(
      (name) => !DETAIL_RUNTIME_VARS.has(name),
    );

    expect(unresolved).toEqual([]);
  });

  it('reads only global tokens, or its own, in the cursor, which sits outside .shelf-shell', () => {
    const cursorRules = styleRules(readCss(STAGE_CSS)).filter((rule) =>
      rule.selector.includes('cursor-'),
    );
    const declaredByCursor = new Set(
      cursorRules.flatMap((rule) =>
        [...rule.body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(([, name = '']) => name),
      ),
    );
    const known = new Set([...globalTokens(), ...declaredByCursor]);

    const unresolved = cursorRules.flatMap((rule) =>
      varsRead(rule.body)
        .filter((name) => !known.has(name))
        .map((name) => `${rule.selector}: ${name}`),
    );
    expect(unresolved).toEqual([]);
  });

  it('never names the shell-scoped --shelf-ease-out in any bookshelf CSS module', () => {
    const dir = join(process.cwd(), COMPONENTS);
    const mentions = readdirSync(dir)
      .filter((file) => file.endsWith('.module.css'))
      .filter((file) => readFileSync(join(dir, file), 'utf8').includes('--shelf-ease-out'));

    expect(mentions).toEqual([]);
  });

  it("wipes each detail block in on the site's --ease-out-expo", () => {
    expect(declared(DETAIL_CSS, '.detail-entering .rv', 'animation')).toBe(
      'rv-wipe var(--rd, 560ms) var(--ease-out-expo) both',
    );
  });
});

describe('the bookshelf moves only compositor properties', () => {
  it.each(MOTION_MODULES)('%s transitions no size, place or `all`', (css) => {
    const offenders = nonCompositorTransitions(styleRules(readCss(css))).filter((entry) =>
      LAYOUT_PROPERTY.test(entry),
    );

    expect(offenders).toEqual([]);
  });

  it('uses no Tailwind utility that transitions every property or resizes on hover', () => {
    const dir = join(process.cwd(), COMPONENTS);
    const offenders = readdirSync(dir)
      .filter((file) => file.endsWith('.tsx'))
      .flatMap((file) => {
        const source = readFileSync(join(dir, file), 'utf8');
        return LAYOUT_UTILITIES.filter((utility) => source.includes(utility)).map(
          (utility) => `${file}: ${utility}`,
        );
      });

    expect(offenders).toEqual([]);
  });

  it.each(MOTION_MODULES)('%s keeps every reduced-motion reset winning', (css) => {
    expect(losingReducedMotionResets(styleRules(readCss(css)))).toEqual([]);
  });
});

describe('the end states each motion lands on', () => {
  it('scales the ring disc to 52, 84 and 38 px of its 84 px drawing', () => {
    expect(declared(STAGE_CSS, '.cursor-ring', '--ring-scale')).toBe('calc(52 / 84)');
    expect(declared(STAGE_CSS, '.cursor-open .cursor-ring', '--ring-scale')).toBe('1');
    expect(declared(STAGE_CSS, '.cursor-grabbing .cursor-ring', '--ring-scale')).toBe(
      'calc(38 / 84)',
    );
    expect(declared(STAGE_CSS, '.cursor-disc', 'transform')).toBe('scale(var(--ring-scale))');
    expect(declared(STAGE_CSS, '.cursor-disc', 'transition')).toMatch(
      /^transform 320ms var\(--ease-out-expo\)/,
    );
  });

  it("keeps the disc's ring and blur their drawn size whatever its scale", () => {
    expect(declared(STAGE_CSS, '.cursor-disc', 'box-shadow')).toBe(
      'inset 0 0 0 calc(1.5px / var(--ring-scale)) var(--brand-ink)',
    );
    expect(declared(STAGE_CSS, '.cursor-disc', 'backdrop-filter')).toBe(
      'blur(calc(4px / var(--ring-scale)))',
    );
    expect(declared(STAGE_CSS, '.cursor-grabbing .cursor-disc', 'box-shadow')).toBe(
      'inset 0 0 0 calc(2px / var(--ring-scale)) var(--brand)',
    );
  });

  it('scales the slot shadow from a spine wide to a cover wide on the active book', () => {
    expect(declared(SLOT_CSS, '.slot-shadow', 'width')).toBe('calc(var(--book-c) * 1.05)');
    expect(declared(SLOT_CSS, '.slot-shadow', '--shadow-sx')).toBe(
      'calc((0.15 * 1.7) / (0.75 * 1.05))',
    );
    expect(declared(SLOT_CSS, '.slot-shadow', 'transform')).toBe(
      'translateX(-50%) scaleX(var(--shadow-sx))',
    );
    expect(declared(SLOT_CSS, '.is-active .slot-shadow', '--shadow-sx')).toBe('1');
  });

  it("ties the shadow's factors to the shell's --book-w and --book-c", () => {
    expect(declared(STAGE_CSS, '.shelf-shell', '--book-w')).toBe('calc(var(--book-h) * 0.15)');
    expect(declared(STAGE_CSS, '.shelf-shell', '--book-c')).toBe('calc(var(--book-h) * 0.75)');
  });

  it("clips the status card's rule from 40 to 64 px on hover, behind a fine pointer", () => {
    expect(declared(CARDS_CSS, '.status-rule', 'width')).toBe('64px');
    expect(declared(CARDS_CSS, '.status-rule', 'clip-path')).toBe(
      'inset(0 37.5% 0 0 round 9999px)',
    );
    expect(
      declared(CARDS_CSS, '.shelf-card:hover .status-rule', 'clip-path', [FINE_POINTER_MEDIA]),
    ).toBe('inset(0)');
  });
});
