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
 * @file The Live Console design tokens in src/styles/globals.css, and the files they replaced.
 *
 * Checks the literal token values in the first `:root` block, the shadcn aliases that must stay
 * equal to them, the `@theme` maps and utilities new components rely on, and compiles those blocks
 * with the repo's Tailwind to prove the class names resolve (a colour token named `base` would
 * silently turn `text-base` into a colour). next/font/google is mocked in tests/setup.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Geist, Geist_Mono } from 'next/font/google';
import { compile } from 'tailwindcss';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Vitest runs from the repository root (where vitest.config.ts lives).
const fromRoot = (path: string): string => join(process.cwd(), path);
const read = (path: string): string => readFileSync(fromRoot(path), 'utf8');

const CSS = read('src/styles/globals.css');
const OKLCH_LITERAL = /^oklch\(\d+(?:\.\d+)?% \d+(?:\.\d+)? \d+(?:\.\d+)?deg\)$/;

/** The validated chart palette, in its fixed order. */
const CHART_HEX = ['#8884d5', '#d95926', '#199e70', '#c98500', '#d55181', '#3987e5'] as const;

/** LeetCode's own difficulty colours, read from leetcode.com's computed styles. */
const LEET_HEX = {
  'leet-easy': '#1cbaba',
  'leet-medium': '#ffb700',
  'leet-hard': '#f63737',
} as const;

/** Every Live Console colour token and its literal value. */
const COLOUR_TOKENS = {
  canvas: 'oklch(16% 0.016 285deg)',
  'surface-1': 'oklch(20% 0.02 285deg)',
  'surface-2': 'oklch(23.5% 0.025 285deg)',
  'surface-3': 'oklch(27% 0.028 285deg)',
  hairline: 'oklch(30% 0.03 285deg)',
  'hairline-strong': 'oklch(40% 0.04 285deg)',
  fg: 'oklch(94% 0.03 285deg)',
  'fg-muted': 'oklch(74% 0.038 285deg)',
  'fg-faint': 'oklch(65% 0.03 285deg)',
  brand: 'oklch(65% 0.12 285deg)',
  'brand-ink': 'oklch(76% 0.1 285deg)',
  'brand-subtle': 'oklch(30% 0.07 285deg)',
  live: 'oklch(80% 0.18 152deg)',
  ongoing: 'oklch(80% 0.123 80deg)',
  down: 'oklch(72% 0.15 25deg)',
  info: 'oklch(76% 0.1 235deg)',
  focus: 'oklch(76% 0.1 285deg)',
} as const;

/**
 * Translucent tokens: [token, the colour token it lightens, alpha]. The glow, spotlight, lift,
 * hero wash, live-pulse and status badge fills read these instead of color-mix(), whose
 * no-support fallback is full strength.
 */
const TRANSLUCENT_TOKENS = [
  ['brand-glow', 'brand', '9%'],
  ['brand-spot', 'brand', '16%'],
  ['brand-edge', 'brand', '18%'],
  ['brand-wash', 'brand', '14%'],
  ['live-halo', 'live', '20%'],
  ['live-tint', 'live', '12%'],
  ['ongoing-tint', 'ongoing', '12%'],
  ['down-tint', 'down', '12%'],
  ['info-tint', 'info', '12%'],
] as const;

/** The status badge fills, each mapped to a bg-<name> utility. */
const STATUS_TINTS = ['live-tint', 'ongoing-tint', 'down-tint', 'info-tint'] as const;

/** Non-colour tokens in :root that CSS and JS read with var(). */
const LAYOUT_AND_MOTION_TOKENS = {
  'motion-instant': '100ms',
  'motion-fast': '150ms',
  'motion-base': '240ms',
  'motion-slow': '400ms',
  'motion-tween': '600ms',
  'page-gutter': 'clamp(1rem, 0.5rem + 2vw, 2rem)',
  'tile-row': '7.5rem',
  'mobile-bar-h': '4.5rem',
} as const;

/** Each shadcn name and the Live Console token it must equal. */
const LEGACY_ALIASES = [
  ['background', 'canvas'],
  ['foreground', 'fg'],
  ['card', 'surface-1'],
  ['card-foreground', 'fg'],
  ['popover', 'surface-2'],
  ['popover-foreground', 'fg'],
  ['primary', 'brand'],
  ['primary-foreground', 'canvas'],
  ['muted', 'surface-3'],
  ['muted-foreground', 'fg-muted'],
  ['border', 'hairline'],
  ['input', 'hairline'],
  ['ring', 'focus'],
] as const;

/** The type scale: [token, font size, line height]. */
const TEXT_SCALE = [
  ['label', '0.75rem', '1rem'],
  ['meta', '0.8125rem', '1.125rem'],
  ['body-sm', '0.875rem', '1.375rem'],
  ['body', '1rem', '1.625rem'],
  ['title', '1.25rem', '1.75rem'],
  ['heading', '1.75rem', '2.125rem'],
  ['stat', '2.5rem', '1'],
  ['display', 'clamp(2.5rem, 1.25rem + 4vw, 4rem)', '1'],
  ['hero', 'clamp(3.5rem, 1.5rem + 6.5vw, 6rem)', '0.95'],
] as const;

interface CssBlock {
  readonly head: string;
  readonly body: string;
}

/** The top-level blocks of `css` (rules and at-rules), with comments removed. */
function topLevelBlocks(css: string): CssBlock[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: CssBlock[] = [];
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

/** The custom properties declared in a block body, values with whitespace collapsed. */
function customProperties(body: string): Map<string, string> {
  const properties = new Map<string, string>();
  for (const [, name = '', value = ''] of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    properties.set(name, value.replace(/\s+/g, ' ').trim());
  }
  return properties;
}

const BLOCKS = topLevelBlocks(CSS);
const blocksNamed = (head: string): CssBlock[] => BLOCKS.filter((block) => block.head === head);
const onlyBlock = (head: string): CssBlock => {
  const [block, ...rest] = blocksNamed(head);
  if (!block || rest.length > 0) throw new Error(`expected exactly one "${head}" block`);
  return block;
};

/** The first `:root` block, read the same way as token-contrast and theme-color tests read it. */
const ROOT = (() => {
  const start = CSS.search(/^:root\s*\{/m);
  if (start < 0) throw new Error('no :root block in globals.css');
  const open = CSS.indexOf('{', start);
  return customProperties(CSS.slice(open + 1, CSS.indexOf('}', open)));
})();
const rootToken = (name: string): string => {
  const value = ROOT.get(name);
  if (value === undefined) throw new Error(`--${name} is not declared in the first :root block`);
  return value;
};

const THEME_INLINE = customProperties(onlyBlock('@theme inline').body);
const THEME_STATIC = customProperties(onlyBlock('@theme static').body);

describe('colour tokens (first :root block)', () => {
  it.each(Object.entries(COLOUR_TOKENS))('--%s is the literal %s', (name, value) => {
    expect(rootToken(name)).toBe(value);
    expect(rootToken(name)).toMatch(OKLCH_LITERAL);
  });

  it('declares the six validated chart colours in their fixed order', () => {
    expect(CHART_HEX.map((_, index) => rootToken(`chart-${index + 1}`))).toEqual(CHART_HEX);
  });

  it.each(Object.entries(LEET_HEX))('--%s is LeetCode’s own %s', (name, value) => {
    expect(rootToken(name)).toBe(value);
  });

  it.each(Object.entries(LAYOUT_AND_MOTION_TOKENS))('--%s is %s', (name, value) => {
    expect(rootToken(name)).toBe(value);
  });

  it.each(LEGACY_ALIASES)('legacy --%s equals --%s', (legacy, token) => {
    expect(rootToken(legacy)).toBe(rootToken(token));
  });

  it.each(TRANSLUCENT_TOKENS)('--%s is the literal --%s at %s alpha', (name, base, alpha) => {
    // Same channels as the base token, so a palette change cannot leave a glow behind.
    expect(rootToken(name)).toBe(rootToken(base).replace(/\)$/, ` / ${alpha})`));
  });
});

describe('@theme maps and utilities', () => {
  it.each([
    'canvas',
    'surface-1',
    'surface-2',
    'surface-3',
    'hairline',
    'hairline-strong',
    'brand',
    'brand-ink',
    'brand-subtle',
    'live',
    'ongoing',
    'down',
    'info',
    ...STATUS_TINTS,
    'focus',
    'chart-1',
    'chart-2',
    'chart-3',
    'chart-4',
    'chart-5',
    'chart-6',
    ...Object.keys(LEET_HEX),
  ])('@theme inline maps --color-%s to var(--%s)', (name) => {
    expect(THEME_INLINE.get(`color-${name}`)).toBe(`var(--${name})`);
  });

  it('maps text-faint to the faintest text tier', () => {
    expect(THEME_INLINE.get('color-faint')).toBe('var(--fg-faint)');
  });

  it('sets font-sans to Geist and font-mono to Geist Mono (the next/font variables)', () => {
    expect(THEME_INLINE.get('font-sans')).toMatch(/^var\(--font-geist[,)]/);
    expect(THEME_INLINE.get('font-mono')).toMatch(/^var\(--font-geist-mono[,)]/);
  });

  it('never declares a colour named base or current (Tailwind class collisions)', () => {
    expect(CSS).not.toMatch(/--color-base\b/);
    expect(CSS).not.toMatch(/--color-current\b/);
  });

  it.each(TEXT_SCALE)('@theme static sets text-%s to %s with line height %s', (name, size, lh) => {
    expect(THEME_STATIC.get(`text-${name}`)).toBe(size);
    expect(THEME_STATIC.get(`text-${name}--line-height`)).toBe(lh);
  });

  it('@theme static declares the tile radius, shell width and expo easing', () => {
    expect(THEME_STATIC.get('radius-tile')).toBe('0.75rem');
    expect(THEME_STATIC.get('container-shell')).toBe('75rem');
    expect(THEME_STATIC.get('ease-out-expo')).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it.each(['label-mono', 'spotlight', 'atmosphere'])('defines @utility %s', (name) => {
    expect(blocksNamed(`@utility ${name}`)).toHaveLength(1);
  });

  // Nothing called the sizeless `figure` once the home tiles moved to figure-lg/md/sm, and its
  // face had quietly flipped from Geist Mono to Geist: a trap for the next caller, so it is gone.
  it('drops the sizeless figure utility; figure-lg, figure-md and figure-sm stay', () => {
    expect(blocksNamed('@utility figure')).toHaveLength(0);
    for (const tier of ['lg', 'md', 'sm']) {
      expect(blocksNamed(`@utility figure-${tier}`)).toHaveLength(1);
    }
  });

  it('ends every animation and transition at once under reduced motion', () => {
    const reduced = onlyBlock('@media (prefers-reduced-motion: reduce)').body;
    expect(reduced).toMatch(/animation-duration:\s*1ms\s*!important/);
    expect(reduced).toMatch(/transition-duration:\s*1ms\s*!important/);
    expect(reduced).toMatch(/scroll-behavior:\s*auto\s*!important/);
  });

  it('drops the dead .dark block, the Kodchasan font sheet and every Kodchasan reference', () => {
    expect(CSS).not.toMatch(/\.dark\s*\{/);
    expect(CSS).not.toContain('fonts.css');
    expect(CSS).not.toContain('Kodchasan');
  });
});

describe('the token classes compile with the repo Tailwind', () => {
  const compileTokens = async (candidates: string[]): Promise<string> => {
    const defaultTheme = read('node_modules/tailwindcss/theme.css');
    const tokenBlocks = BLOCKS.filter(({ head }) => /^@(?:theme|utility)\b/.test(head))
      .map(({ head, body }) => `${head} {${body}}`)
      .join('\n');
    const { build } = await compile(`${defaultTheme}\n${tokenBlocks}\n@tailwind utilities;`);
    return build(candidates);
  };

  /** The declarations of `.selector { ... }` in compiled CSS, whitespace collapsed. */
  const ruleFor = (css: string, className: string): string => {
    const escaped = className.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const body = new RegExp(`\\.${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1];
    if (body === undefined) throw new Error(`.${className} was not generated`);
    return body.replace(/\s+/g, ' ').trim();
  };

  it('keeps text-base a font size, and text-ongoing a colour from the token', async () => {
    const css = await compileTokens(['text-base', 'text-ongoing']);

    expect(ruleFor(css, 'text-base')).toContain('font-size: var(--text-base)');
    expect(ruleFor(css, 'text-base')).not.toContain('color');
    expect(ruleFor(css, 'text-ongoing')).toBe('color: var(--ongoing);');
  });

  it('generates every class the H conventions allow', async () => {
    const classes = [
      'bg-canvas',
      'bg-surface-2',
      'border-hairline-strong',
      'text-faint',
      'text-brand-ink',
      'bg-brand-subtle',
      'text-live',
      'text-down',
      'text-info',
      'outline-focus',
      'bg-chart-6',
      'bg-leet-easy',
      'bg-leet-medium',
      'bg-leet-hard',
      'font-sans',
      'font-mono',
      'text-label',
      'text-hero',
      'tracking-display',
      'rounded-tile',
      'max-w-shell',
      'shadow-tile',
      'shadow-raised',
      'shadow-lift',
      'ease-out-expo',
      'ease-standard',
      'animate-live-pulse',
      'label-mono',
      'atmosphere',
    ];
    // spotlight nests its ::before inside its rule, so ruleFor cannot read it; see the next test.
    const css = await compileTokens([...classes, 'spotlight']);

    for (const className of classes) expect(() => ruleFor(css, className)).not.toThrow();
    expect(ruleFor(css, 'text-label')).toContain('font-size: var(--text-label)');
    expect(ruleFor(css, 'max-w-shell')).toContain('max-width: var(--container-shell)');
    expect(ruleFor(css, 'rounded-tile')).toContain('border-radius: var(--radius-tile)');
    expect(ruleFor(css, 'bg-leet-hard')).toBe('background-color: var(--leet-hard);');
    expect(css).toMatch(/\.spotlight\s*\{[^}]*&::before\s*\{/);
  });

  it('paints the spotlight glow under the content, inside the element it lights', async () => {
    const css = await compileTokens(['spotlight']);

    // Its own stacking context, so z-index -1 lands above the element's background, not below it.
    // compile() keeps the utility's `&::before` nested; the build's Lightning CSS flattens it.
    const spotlight = /\.spotlight\s*\{([^}]*)&::before\s*\{([^}]*)/.exec(css);
    expect(spotlight).not.toBeNull();
    const [, own = '', glow = ''] = spotlight ?? [];
    expect(own).toMatch(/isolation:\s*isolate\s*;/);
    // The glow's own declarations, up to the hover rule nested after them.
    expect(glow).toMatch(/position:\s*absolute\s*;/);
    expect(glow).toMatch(/z-index:\s*-1\s*;/);
  });

  it('lights the glow, spotlight, lift and live pulse with translucent tokens, not color-mix()', async () => {
    // Tailwind rewrites a color-mix() over a var() into an unconditional full-strength var() with
    // the mix behind @supports, so browsers without color-mix would paint solid brand light.
    const css = await compileTokens([
      'atmosphere',
      'spotlight',
      'shadow-lift',
      'animate-live-pulse',
    ]);

    expect(css).not.toContain('color-mix');
    expect(ruleFor(css, 'atmosphere')).toContain('var(--brand-glow)');
    expect(css).toMatch(/\.spotlight\s*\{[^}]*&::before\s*\{[^}]*var\(--brand-spot\)/);
    expect(THEME_INLINE.get('shadow-lift')).toContain('var(--brand-edge)');
    expect(css).toMatch(/@keyframes live-pulse\s*\{[^}]*var\(--live-halo\)/);
  });

  it('fills status badges from the translucent tint tokens, not a color-mix() of the status colour', async () => {
    const classes = STATUS_TINTS.map((tint) => `bg-${tint}`);
    const css = await compileTokens(classes);

    expect(css).not.toContain('color-mix');
    for (const tint of STATUS_TINTS) {
      expect(ruleFor(css, `bg-${tint}`)).toBe(`background-color: var(--${tint});`);
    }
  });
});

describe('files the Live Console replaced', () => {
  it('deletes the dead Tailwind v3 config and the Kodchasan @font-face sheet', () => {
    expect(existsSync(fromRoot('tailwind.config.ts'))).toBe(false);
    expect(existsSync(fromRoot('src/styles/fonts.css'))).toBe(false);
  });

  it('keeps the two Kodchasan files the OG image route still reads, and the licence', () => {
    for (const file of ['Kodchasan-Bold.ttf', 'Kodchasan-Regular.ttf', 'OFL.txt']) {
      expect(existsSync(fromRoot(`public/assets/fonts/${file}`)), file).toBe(true);
    }
    expect(existsSync(fromRoot('public/assets/fonts/Kodchasan-SemiBoldItalic.ttf'))).toBe(false);
  });

  it('renders the error pages in Geist, without LightRays', () => {
    const errorLayout = read('src/app/_client/errors/error-layout.tsx');
    expect(errorLayout).not.toContain('Kodchasan');
    expect(errorLayout).not.toContain('LightRays');
  });

  it('points shadcn at no Tailwind config and at lucide icons', () => {
    const { tailwind, iconLibrary } = JSON.parse(read('components.json')) as {
      tailwind: { config: string };
      iconLibrary: string;
    };
    expect(tailwind.config).toBe('');
    expect(iconLibrary).toBe('lucide');
  });
});

describe('src/app/fonts.ts', () => {
  type GeistOptions = Parameters<typeof Geist>[0];
  type GeistMonoOptions = Parameters<typeof Geist_Mono>[0];
  let fontVariables = '';
  let geistOptions: GeistOptions | undefined;
  let monoOptions: GeistMonoOptions | undefined;

  // The loaders run once, on first import, and Vitest clears mock calls before every test.
  beforeAll(async () => {
    ({ fontVariables } = await import('@/app/fonts'));
    geistOptions = vi.mocked(Geist).mock.lastCall?.[0];
    monoOptions = vi.mocked(Geist_Mono).mock.lastCall?.[0];
  });

  it('loads Geist and Geist Mono with the CSS variables globals.css reads', () => {
    expect(geistOptions).toMatchObject({
      variable: '--font-geist',
      subsets: ['latin'],
      display: 'swap',
    });
    expect(monoOptions).toMatchObject({ variable: '--font-geist-mono', preload: false });
  });

  it("puts both loaders' variable classes on fontVariables, Geist first", () => {
    // The mock returns a distinct class per loader, so a hard-coded string cannot pass.
    expect(fontVariables).toBe('geist-variable-mock mono-variable-mock');
  });

  it("keeps Geist's metric-adjusted fallback face, so the swap to Geist does not re-wrap text", () => {
    // Under Turbopack an explicit `fallback` list replaces the size-adjusted 'Geist Fallback'.
    expect(geistOptions).toBeDefined();
    expect(geistOptions).not.toHaveProperty('fallback');
    expect(geistOptions?.adjustFontFallback).not.toBe(false);
  });

  it('gives Geist Mono the system monospace stack, closer to its advance than an adjusted Arial', () => {
    expect(monoOptions?.adjustFontFallback).toBe(false);
    expect(monoOptions?.fallback?.at(-1)).toBe('monospace');
  });

  it('is applied to <html> by the root layout', () => {
    const layout = read('src/app/layout.tsx');
    expect(layout).toMatch(/import \{ fontVariables \} from '@\/app\/fonts';/);
    expect(layout).toMatch(/<html[^>]*className=\{fontVariables\}/);
  });
});
