// @vitest-environment node

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
 * @file The refined type utilities in src/styles/globals.css (the home bento's type, brief 1.4).
 *
 * Compiles the file's @theme and @utility blocks with the repo's Tailwind and checks each style's
 * declarations against the brief's 'refined' column, then the rules that hold across them: Geist
 * for everything but the mono token, weights 400/500/600, no capitals, nothing under 12px, no
 * colour (callers pair a style with a colour), tabular figures, and figure sizes that never follow
 * the viewport. The chrome's label-mono must not change with them.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from 'tailwindcss';
import { beforeAll, describe, expect, it } from 'vitest';

// Vitest runs from the repository root (where vitest.config.ts lives).
const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

/** The top-level blocks (rules and at-rules) of `css`, comments removed. */
function topLevelBlocks(css: string): { head: string; body: string }[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: { head: string; body: string }[] = [];
  let depth = 0;
  let headStart = 0;
  let bodyStart = 0;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === ';' && depth === 0) headStart = i + 1;
    if (char === '{' && depth++ === 0) bodyStart = i + 1;
    if (char === '}' && --depth === 0) {
      const head = source
        .slice(headStart, bodyStart - 1)
        .replace(/\s+/g, ' ')
        .trim();
      blocks.push({ head, body: source.slice(bodyStart, i) });
      headStart = i + 1;
    }
  }
  return blocks;
}

const BLOCKS = topLevelBlocks(read('src/styles/globals.css'));

/** Builds `candidates` from globals.css's @theme and @utility blocks over Tailwind's default theme. */
async function build(candidates: string[]): Promise<string> {
  const tokenBlocks = BLOCKS.filter(({ head }) => /^@(?:theme|utility)\b/.test(head))
    .map(({ head, body }) => `${head} {${body}}`)
    .join('\n');
  const { build: run } = await compile(
    `${read('node_modules/tailwindcss/theme.css')}\n${tokenBlocks}\n@tailwind utilities;`,
  );
  return run(candidates);
}

/** A utility's own declarations (nested at-rules left out), as property -> value. */
function declarationsOf(css: string, className: string): Map<string, string> {
  const start = css.indexOf(`.${className} {`);
  if (start < 0) throw new Error(`.${className} was not generated`);
  const open = css.indexOf('{', start);
  let depth = 0;
  let own = '';
  for (let i = open + 1; i < css.length; i++) {
    const char = css[i];
    if (char === '{') depth++;
    if (char === '}' && depth-- === 0) break;
    if (depth === 0 && char !== '}') own += char;
  }
  const declarations = new Map<string, string>();
  for (const [, property = '', value = ''] of own.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) {
    declarations.set(property, value.replace(/\s+/g, ' ').trim());
  }
  return declarations;
}

/** The brief's refined column, one row per style. */
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';
const STYLES = {
  'hero-name': {
    'font-family': SANS,
    'font-size': 'clamp(2.75rem, 1rem + 7cqi, 4.5rem)',
    'line-height': '1',
    'font-weight': '600',
    'letter-spacing': '-0.04em',
  },
  'hero-role': {
    'font-family': SANS,
    'font-size': '1.125rem',
    'line-height': '1.625rem',
    'font-weight': '500',
  },
  'hero-tagline': {
    'font-family': SANS,
    'font-size': '1rem',
    'line-height': '1.5rem',
    'font-weight': '400',
  },
  'tile-label': {
    'font-family': SANS,
    'font-size': '0.8125rem',
    'line-height': '1rem',
    'font-weight': '500',
    'letter-spacing': '0',
    'text-transform': 'none',
  },
  'tile-title': {
    'font-family': SANS,
    'font-size': '1rem',
    'line-height': '1.375rem',
    'font-weight': '600',
    'letter-spacing': '-0.011em',
  },
  'tile-title-lg': {
    'font-family': SANS,
    'font-size': '1.25rem',
    'line-height': '1.625rem',
    'font-weight': '600',
    'letter-spacing': '-0.02em',
  },
  'tile-sub': {
    'font-family': SANS,
    'font-size': '0.875rem',
    'line-height': '1.25rem',
    'font-weight': '400',
  },
  'tile-meta': {
    'font-family': SANS,
    'font-size': '0.8125rem',
    'line-height': '1.125rem',
    'font-weight': '400',
    'font-variant-numeric': 'tabular-nums',
  },
  'mono-token': {
    'font-family': MONO,
    'font-size': '0.75rem',
    'line-height': '1rem',
    'font-weight': '400',
  },
  'figure-lg': {
    'font-family': SANS,
    'font-size': '3rem',
    'line-height': '1',
    'font-weight': '600',
    'letter-spacing': '-0.035em',
    'font-variant-numeric': 'tabular-nums',
  },
  'figure-md': {
    'font-family': SANS,
    'font-size': '2.25rem',
    'line-height': '1',
    'font-weight': '600',
    'letter-spacing': '-0.03em',
    'font-variant-numeric': 'tabular-nums',
  },
  'figure-sm': {
    'font-family': SANS,
    'font-size': '1.75rem',
    'line-height': '1',
    'font-weight': '600',
    'letter-spacing': '-0.02em',
    'font-variant-numeric': 'tabular-nums',
  },
  'figure-unit': {
    'font-family': SANS,
    'font-size': '0.875rem',
    'line-height': '1.25rem',
    'font-weight': '400',
    'text-transform': 'none',
  },
} as const satisfies Record<string, Record<string, string>>;

type StyleName = keyof typeof STYLES;
const STYLE_NAMES = Object.keys(STYLES) as StyleName[];

/** One rem in px, for the 12px floor. */
const REM_PX = 16;
const MIN_TEXT_PX = 12;

describe('the refined type utilities (globals.css)', () => {
  let css = '';
  beforeAll(async () => {
    css = await build([...STYLE_NAMES, 'figure-row', 'figure', 'label-mono']);
    // 'figure' is asked for only to show that it is no longer generated.
  });

  it.each(STYLE_NAMES)('%s is the brief’s refined style', (name) => {
    const declarations = declarationsOf(css, name);
    for (const [property, value] of Object.entries(STYLES[name])) {
      expect(declarations.get(property), `${name} ${property}`).toBe(value);
    }
  });

  it('tightens the hero name to -0.05em once its tile is 28.5rem wide (the name at 48px)', () => {
    // compile() keeps the query nested in the utility; the build's Lightning CSS flattens it.
    expect(css).toMatch(
      /\.hero-name\s*\{[^}]*@container \(width >= 28\.5rem\)\s*\{\s*letter-spacing:\s*-0\.05em;/,
    );
  });

  it('sets a figure and its unit on one baseline, 6px apart, wrapping the unit under it', () => {
    const row = declarationsOf(css, 'figure-row');
    expect(row.get('display')).toBe('flex');
    expect(row.get('flex-wrap')).toBe('wrap');
    expect(row.get('align-items')).toBe('baseline');
    // Rows 4px apart once the unit wraps, columns 6px apart while it fits.
    expect(row.get('gap')).toBe('0.25rem 0.375rem');
  });

  it.each(STYLE_NAMES)('%s uses weight 400, 500 or 600, and no capitals', (name) => {
    const declarations = declarationsOf(css, name);
    expect(['400', '500', '600']).toContain(declarations.get('font-weight'));
    expect(declarations.get('text-transform') ?? 'none').toBe('none');
  });

  it.each(STYLE_NAMES)('%s sets no colour, so the caller pairs it with one', (name) => {
    const properties = [...declarationsOf(css, name).keys()];
    expect(properties).not.toContain('color');
  });

  it.each(STYLE_NAMES.filter((name) => name !== 'hero-name'))(
    '%s is at least 12px, in rem',
    (name) => {
      const size = declarationsOf(css, name).get('font-size') ?? '';
      expect(size).toMatch(/^\d+(?:\.\d+)?rem$/);
      expect(Number.parseFloat(size) * REM_PX).toBeGreaterThanOrEqual(MIN_TEXT_PX);
    },
  );

  it('keeps Geist Mono for the machine token alone', () => {
    const mono = STYLE_NAMES.filter(
      (name) => declarationsOf(css, name).get('font-family') === MONO,
    );
    expect(mono).toEqual(['mono-token']);
  });

  it.each(['figure-lg', 'figure-md', 'figure-sm'] as const)(
    '%s has a fixed size, never one that follows the viewport',
    (name) => {
      expect(declarationsOf(css, name).get('font-size')).not.toMatch(/v[whib]|vmin|vmax|clamp/);
    },
  );

  it('steps the figure tiers 48 > 36 > 28px, the largest two thirds of the name at its 72px', () => {
    const px = (name: StyleName): number =>
      Number.parseFloat(declarationsOf(css, name).get('font-size') ?? '') * REM_PX;
    expect([px('figure-lg'), px('figure-md'), px('figure-sm')]).toEqual([48, 36, 28]);
    expect(px('figure-lg') / 72).toBeCloseTo(2 / 3, 2);
  });

  // It had no caller left and had moved from Geist Mono to Geist: figure-lg/md/sm set a figure.
  it('generates no sizeless figure utility', () => {
    expect(() => declarationsOf(css, 'figure')).toThrow('.figure was not generated');
    expect(css).not.toMatch(/\.figure\s*\{/);
  });

  it('leaves the chrome’s label-mono as it was: Geist Mono, upper case, tracked', () => {
    const label = declarationsOf(css, 'label-mono');
    expect(label.get('font-family')).toBe(MONO);
    expect(label.get('text-transform')).toBe('uppercase');
    expect(label.get('letter-spacing')).toBe('var(--tracking-label)');
  });

  it('emits --font-sans as Geist, the face the sans utilities read through var()', () => {
    // Under @theme inline only a var() reference makes Tailwind emit the variable at all; without
    // it these utilities would fall back to the inherited face and still look right by accident.
    expect(css).toMatch(/--font-sans:\s*var\(--font-geist[,)]/);
    expect(css).toMatch(/--font-mono:\s*var\(--font-geist-mono[,)]/);
  });

  it('sorts the styles before single-property utilities, so font-medium beside one wins', async () => {
    const sorted = await build(['tile-meta', 'font-medium', 'tracking-normal']);
    const at = (selector: string): number => sorted.indexOf(selector);

    expect(at('.tile-meta {')).toBeGreaterThanOrEqual(0);
    expect(at('.tile-meta {')).toBeLessThan(at('.font-medium {'));
    expect(at('.tile-meta {')).toBeLessThan(at('.tracking-normal {'));
  });
});
