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
 * @file The tile hover the owner picked in the Fluid UI Lab on 2026-11-08: lane B's motion with
 * the colours of "Before (#601)". Checked against the CSS the repo's Tailwind compiles from the
 * classes a linked and an interactive Tile render, with the `@theme` blocks and the `spotlight`
 * utility from src/styles/globals.css:
 * - the move: translate only, 3 px, on --ease-spring, 300 ms in and 500 ms out; a press drops back
 *   in --motion-instant; reduced motion never moves the tile;
 * - the light: one ::after layer that fades by opacity only on --ease-effect, 240 ms in and
 *   400 ms out. It carries the 80 % brand rim (over the tile's own surface, as the old border sat
 *   on the card's) and the brand halo; nothing transitions a shadow, a border colour or `all`;
 * - the glow (::before, the spotlight): MagicCard's own violet, on the light's timing, so lift,
 *   light and glow start together;
 * - the hovered tile is raised (z-index 1) at once and stays raised until its light has faded;
 * - keyboard focus shows the light and the raise at once, with no animation.
 *
 * jsdom applies no stylesheet and cannot hover, so each compiled rule is matched against the
 * rendered tile with element.matches(), :hover and :active standing in as data attributes, and
 * the rules that apply in a state cascade in source order (Tailwind emits its variants in
 * increasing precedence). e2e/visual/tile-hover.spec.ts checks the same hover frame by frame in a
 * real browser.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { compile } from 'tailwindcss';
import { describe, expect, it, vi } from 'vitest';

import { Tile, type TileProps } from '@/components/console/tile';

vi.mock('next/link', () => ({
  default: ({
    href,
    prefetch: _prefetch,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean | null;
    children?: ReactNode;
  }) => (
    <a {...rest} href={href}>
      {children}
    </a>
  ),
}));

// Vitest runs from the repository root (where vitest.config.ts lives).
const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

const GLOBALS = withoutComments(read('src/styles/globals.css'));

/* ------------------------------------------------------------------ compiled CSS, as rules */

interface CssRule {
  /** The enclosing at-rule preludes, outermost first, whitespace collapsed. */
  readonly conditions: readonly string[];
  /** The selector with every nested `&` resolved. */
  readonly selector: string;
  readonly declarations: ReadonlyMap<string, string>;
}

const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim();

function declarationsOf(statements: readonly string[]): Map<string, string> {
  const declarations = new Map<string, string>();
  for (const statement of statements) {
    const colon = statement.indexOf(':');
    if (colon > 0) {
      declarations.set(collapse(statement.slice(0, colon)), collapse(statement.slice(colon + 1)));
    }
  }
  return declarations;
}

/**
 * Every style rule of `css` with its at-rules, nested rules flattened (compile() keeps a
 * utility's `&::before` nested; the build's Lightning CSS flattens it the same way).
 */
function styleRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const visit = (block: string, conditions: readonly string[], parent: string | null): void => {
    const statements: string[] = [];
    let depth = 0;
    let headStart = 0;
    let bodyStart = 0;
    for (let index = 0; index < block.length; index += 1) {
      const char = block[index];
      if (char === ';' && depth === 0) {
        statements.push(block.slice(headStart, index));
        headStart = index + 1;
      }
      if (char === '{' && depth++ === 0) bodyStart = index + 1;
      if (char === '}' && --depth === 0) {
        const head = collapse(block.slice(headStart, bodyStart - 1));
        const body = block.slice(bodyStart, index);
        if (/^@(?:media|supports|layer)\b/.test(head)) visit(body, [...conditions, head], parent);
        else if (!head.startsWith('@')) {
          visit(body, conditions, parent ? head.replaceAll('&', parent) : head);
        }
        headStart = index + 1;
      }
    }
    if (parent && statements.length > 0) {
      rules.push({ conditions, selector: parent, declarations: declarationsOf(statements) });
    }
  };
  visit(withoutComments(css), [], null);
  return rules;
}

/**
 * The body of the one top-level block whose head is exactly `head` (braces counted, because
 * `@theme static` nests @keyframes).
 */
function blockBody(head: string): string {
  const start = GLOBALS.indexOf(`${head} {`);
  if (start < 0) throw new Error(`no "${head}" block in globals.css`);
  const open = GLOBALS.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < GLOBALS.length; index += 1) {
    if (GLOBALS[index] === '{') depth += 1;
    if (GLOBALS[index] === '}') depth -= 1;
    if (depth === 0) return GLOBALS.slice(open + 1, index);
  }
  throw new Error(`unclosed "${head}" block in globals.css`);
}

/** Compiles `candidates` with the repo's Tailwind, its default theme, the tokens and spotlight. */
async function compileClasses(candidates: Iterable<string>): Promise<string> {
  const source = [
    read('node_modules/tailwindcss/theme.css'),
    `@theme inline {${blockBody('@theme inline')}}`,
    `@theme static {${blockBody('@theme static')}}`,
    `@utility spotlight {${blockBody('@utility spotlight')}}`,
    '@tailwind utilities;',
  ].join('\n');
  const { build } = await compile(source);
  return build([...candidates]);
}

/* ------------------------------------------------------------------ states and the cascade */

type Part = 'tile' | '::after' | '::before';

interface TileState {
  readonly hover?: boolean;
  readonly active?: boolean;
  /** The visitor asked the OS for less motion. */
  readonly reducedMotion?: boolean;
  /** A touch screen: no hover, no fine pointer. */
  readonly touch?: boolean;
}

const HOVER_ATTRIBUTE = 'data-test-hover';
const ACTIVE_ATTRIBUTE = 'data-test-active';

/** Whether the media `conditions` hold in `state`; an unknown query fails the test. */
function conditionsHold(conditions: readonly string[], state: TileState): boolean {
  return conditions.every((condition) => {
    if (condition === '@media (hover: hover)') return !state.touch;
    if (condition === '@media (hover: hover) and (pointer: fine)') return !state.touch;
    if (condition === '@media (prefers-reduced-motion: reduce)')
      return Boolean(state.reducedMotion);
    if (/^@(?:layer properties|supports)\b/.test(condition)) return false;
    throw new Error(`unexpected condition in the tile's CSS: ${condition}`);
  });
}

function partOf(selector: string): Part {
  if (selector.endsWith('::after')) return '::after';
  if (selector.endsWith('::before')) return '::before';
  return 'tile';
}

/**
 * The rule's selector for element.matches(): its pseudo-element cut, and :hover and :active as
 * attributes. The lookbehind skips the escaped `\:hover` inside a class name.
 */
function matchableSelector(selector: string, part: Part): string {
  const own = part === 'tile' ? selector : selector.slice(0, -part.length);
  return own
    .replace(/(?<!\\):hover\b/g, `[${HOVER_ATTRIBUTE}]`)
    .replace(/(?<!\\):active\b/g, `[${ACTIVE_ATTRIBUTE}]`);
}

/** The declarations that win on `part` of `element` in `state`, in source order. */
function computed(
  rules: readonly CssRule[],
  element: Element,
  part: Part,
  state: TileState = {},
): Map<string, string> {
  element.toggleAttribute(HOVER_ATTRIBUTE, Boolean(state.hover));
  element.toggleAttribute(ACTIVE_ATTRIBUTE, Boolean(state.active));
  const winners = new Map<string, string>();
  for (const rule of rules) {
    if (partOf(rule.selector) !== part || !conditionsHold(rule.conditions, state)) continue;
    if (!element.matches(matchableSelector(rule.selector, part))) continue;
    for (const [name, value] of rule.declarations) winners.set(name, value);
  }
  return winners;
}

/* ------------------------------------------------------------------ rendering */

/** Every class used anywhere under `root`, so the CSS compiled is exactly what renders. */
function classesUnder(root: Element): Set<string> {
  const elements = [root, ...root.querySelectorAll('[class]')];
  return new Set(elements.flatMap((element) => Array.from(element.classList)));
}

interface RenderedTile {
  readonly tile: HTMLElement;
  readonly link: HTMLAnchorElement;
  readonly rules: CssRule[];
  readonly css: string;
}

async function renderTile(variant: 'linked' | 'interactive'): Promise<RenderedTile> {
  const props: TileProps =
    variant === 'interactive' ? { variant, href: '/projects' } : { variant, as: 'article' };
  const { container } = render(
    <Tile {...props}>
      {variant === 'linked' ? (
        // TileLink's own marker: the tile keys its focus light on it.
        <a href="/projects" data-tile-link="">
          Projects
        </a>
      ) : (
        'Projects'
      )}
    </Tile>,
  );
  const tile = container.firstElementChild;
  const link = container.querySelector('a');
  if (!(tile instanceof HTMLElement) || !(link instanceof HTMLAnchorElement)) {
    throw new Error('the tile or its link did not render');
  }
  const css = await compileClasses(classesUnder(container));
  return { tile, link, rules: styleRules(css), css };
}

/* ------------------------------------------------------------------ colour */

/** oklch(L C H) to 0..255 sRGB channels, unrounded (Björn Ottosson's matrices). */
function oklchToSrgb(lightness: number, chroma: number, hueDeg: number): number[] {
  const hue = (hueDeg * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map(
    (channel) =>
      255 * (channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055),
  );
}

interface Rgba {
  readonly rgb: number[];
  readonly alpha: number;
}

/** A `oklch(L% C Hdeg)` or `oklch(L% C Hdeg / A%)` token from the first :root block. */
function rootColour(name: string): Rgba {
  const root = blockBody(':root');
  const match = new RegExp(
    `--${name}:\\s*oklch\\(([\\d.]+)% ([\\d.]+) ([\\d.]+)deg(?: / ([\\d.]+)%)?\\);`,
  ).exec(root);
  if (!match) throw new Error(`--${name} is not an oklch literal in the first :root block`);
  const [, lightness = '', chroma = '', hue = '', alpha = '100'] = match;
  return {
    rgb: oklchToSrgb(Number(lightness) / 100, Number(chroma), Number(hue)),
    alpha: Number(alpha) / 100,
  };
}

/** `top` drawn over the opaque `bottom`, rounded to 0..255 channels. */
const over = (top: Rgba, bottom: Rgba): number[] =>
  top.rgb.map((channel, index) =>
    Math.round(channel * top.alpha + (bottom.rgb[index] ?? 0) * (1 - top.alpha)),
  );

/** The Before (#601) lane's hovered top-edge pixel on the GitHub tile, measured in the lab. */
const BEFORE_EDGE_RGB = [113, 110, 176];

/** MagicCard's own glow: rgba(70, 33, 172, 0.15), drawn at opacity 0.8. */
const MAGIC_CARD_GLOW = { rgb: [70, 33, 172], alpha: 0.15 * 0.8 };

/* ------------------------------------------------------------------ tests */

const SPRING_IN = 'var(--motion-spring-in)';
const SPRING_OUT = 'var(--motion-spring-out)';

describe.each(['linked', 'interactive'] as const)('the %s tile hover', (variant) => {
  it('moves by translate (and the raise) only: no box-shadow, border colour or `all`', async () => {
    const { css, rules, tile } = await renderTile(variant);

    for (const state of [{}, { hover: true }, { hover: true, active: true }]) {
      expect(computed(rules, tile, 'tile', state).get('transition-property')).toBe(
        'translate,z-index',
      );
    }
    for (const part of ['::after', '::before'] as const) {
      for (const state of [{}, { hover: true }]) {
        const transition = computed(rules, tile, part, state);
        const property =
          transition.get('transition-property') ?? transition.get('transition')?.split(' ')[0];
        expect(property, `${part} transitions`).toBe('opacity');
      }
    }
    // Nothing anywhere transitions a shadow, a colour or everything.
    const transitions = rules.flatMap((rule) =>
      ['transition', 'transition-property'].map((name) => rule.declarations.get(name) ?? ''),
    );
    expect(transitions.join(' ')).not.toMatch(/box-shadow|border-color|background|\ball\b/);
    // The old hover's border step is gone: no state changes the tile's border colour.
    expect(css).not.toMatch(/:hover[^{]*\{[^}]*border-color/);
  });

  it('lifts 3 px on the spring: 300 ms in, 500 ms out, press back in 100 ms', async () => {
    const { rules, tile } = await renderTile(variant);

    const rest = computed(rules, tile, 'tile');
    const hover = computed(rules, tile, 'tile', { hover: true });
    const press = computed(rules, tile, 'tile', { hover: true, active: true });

    expect(rest.get('translate')).toBeUndefined();
    expect(hover.get('translate')).toBe('var(--tw-translate-x) var(--tw-translate-y)');
    expect(hover.get('--tw-translate-y')).toBe('calc(var(--spacing) * -0.75)');
    expect(press.get('--tw-translate-y')).toBe('0px');

    // translate on the spring; z-index switches (linear, 0 s), so it never interpolates.
    expect(rest.get('transition-timing-function')).toBe('var(--ease-spring),linear');
    // Leaving is the rest rule's timing; entering is the hover rule's.
    expect(rest.get('transition-duration')).toBe(`${SPRING_OUT},0s`);
    expect(hover.get('transition-duration')).toBe(`${SPRING_IN},0s`);
    expect(press.get('transition-duration')).toBe('var(--motion-instant)');
  });

  it('raises the hovered tile at once and keeps it raised until its light has faded', async () => {
    const { rules, tile } = await renderTile(variant);

    const rest = computed(rules, tile, 'tile');
    const hover = computed(rules, tile, 'tile', { hover: true });

    // A number at rest, not auto: auto to 1 cannot transition, so the delay would never apply.
    expect(rest.get('z-index')).toBe('0');
    expect(hover.get('z-index')).toBe('1');
    // Up with no delay; down only after --motion-slow, the light's fade-out.
    expect(hover.get('transition-delay')).toBe('0ms');
    expect(rest.get('transition-delay')).toBe('0s,var(--motion-slow)');
    expect(computed(rules, tile, '::after').get('transition-duration')).toBe('var(--motion-slow)');
  });

  it('fades one light layer by opacity on --ease-effect: 240 ms in, 400 ms out', async () => {
    const { rules, tile } = await renderTile(variant);

    const rest = computed(rules, tile, '::after');
    const hover = computed(rules, tile, '::after', { hover: true });

    expect(rest.get('opacity')).toBe('0%');
    expect(hover.get('opacity')).toBe('100%');
    expect(rest.get('transition-timing-function')).toBe('var(--ease-effect)');
    expect(rest.get('transition-duration')).toBe('var(--motion-slow)');
    expect(hover.get('transition-duration')).toBe('var(--motion-base)');
    // The rim and halo are painted, never animated: only the layer's opacity changes.
    expect(rest.get('--tw-shadow')).toContain('var(--brand-rim)');
    expect(hover.get('--tw-shadow')).toBe(rest.get('--tw-shadow'));
    // Over the whole border box, behind the glow and the content.
    expect(rest.get('inset')).toBe('-1px');
    expect(rest.get('z-index')).toBe('calc(10 * -1)');
    expect(rest.get('pointer-events')).toBe('none');
  });

  it('fades the glow on the light’s timing, so lift, light and glow start together', async () => {
    const { rules, tile } = await renderTile(variant);

    const rest = computed(rules, tile, '::before');
    const hover = computed(rules, tile, '::before', { hover: true });

    expect(rest.get('opacity')).toBe('0');
    expect(hover.get('opacity')).toBe('1');
    expect(rest.get('transition')).toBe('opacity var(--motion-slow) var(--ease-effect)');
    expect(hover.get('transition-duration')).toBe('var(--motion-base)');
    // No glow on a touch screen: it follows a mouse pointer.
    expect(computed(rules, tile, '::before', { hover: true, touch: true }).get('opacity')).toBe(
      '0',
    );
  });

  it('does not move under reduced motion, and the light still fades', async () => {
    const { rules, tile } = await renderTile(variant);
    const reduced = { hover: true, reducedMotion: true };

    expect(computed(rules, tile, 'tile', reduced).get('--tw-translate-y')).toBe('0px');
    expect(computed(rules, tile, '::after', reduced).get('opacity')).toBe('100%');
  });

  it('does not lift or light on a touch screen', async () => {
    const { rules, tile } = await renderTile(variant);
    const touch = { hover: true, touch: true };

    expect(computed(rules, tile, 'tile', touch).get('--tw-translate-y')).toBeUndefined();
    expect(computed(rules, tile, '::after', touch).get('opacity')).toBe('0%');
  });
});

describe('keyboard focus', () => {
  it.each(['linked', 'interactive'] as const)(
    'a %s tile shows its light and raise at once, with no animation',
    async (variant) => {
      const { link, rules, tile } = await renderTile(variant);

      link.focus();

      expect(link.matches(':focus-visible')).toBe(true);
      const own = computed(rules, tile, 'tile');
      const light = computed(rules, tile, '::after');
      expect(own.get('z-index')).toBe('1');
      expect(own.get('transition-delay')).toBe('0ms');
      expect(light.get('opacity')).toBe('100%');
      expect(light.get('transition-duration')).toBe('0ms');
      // No lift and no glow: neither follows a keyboard.
      expect(own.get('translate')).toBeUndefined();
      expect(computed(rules, tile, '::before').get('opacity')).toBe('0');
    },
  );

  it('fades the light out slowly once focus leaves', async () => {
    const { link, rules, tile } = await renderTile('linked');

    link.focus();
    link.blur();

    expect(computed(rules, tile, '::after').get('opacity')).toBe('0%');
    expect(computed(rules, tile, '::after').get('transition-duration')).toBe('var(--motion-slow)');
  });
});

describe('the Before (#601) colours', () => {
  const lift = blockBody('@theme inline').match(/--shadow-lift:\s*([^;]+);/)?.[1] ?? '';

  it('paints the light as a brand halo, then the 80 % rim over the tile’s own surface', () => {
    // Box shadows paint the first on top: the rim over an opaque surface-1 underlay, which
    // covers the hairline border, so the rim lands where the old 80 % border did.
    expect(collapse(lift)).toBe(
      '0 25px 50px -12px var(--brand-halo), inset 0 0 0 1px var(--brand-rim), inset 0 0 0 1px var(--surface-1)',
    );
  });

  it('puts the rim on the Before edge colour, within two levels', () => {
    const edge = over(rootColour('brand-rim'), rootColour('surface-1'));

    for (const [index, channel] of edge.entries()) {
      expect(Math.abs(channel - (BEFORE_EDGE_RGB[index] ?? 0))).toBeLessThanOrEqual(2);
    }
  });

  it('keeps the halo the old shadow-2xl tinted brand at 10 %', () => {
    expect(rootColour('brand-halo').alpha).toBe(0.1);
    expect(rootColour('brand-halo').rgb).toEqual(rootColour('brand').rgb);
  });

  it('glows in MagicCard’s own violet, at the strength it was drawn with', () => {
    const glow = rootColour('spot-violet');

    expect(glow.rgb.map(Math.round)).toEqual(MAGIC_CARD_GLOW.rgb);
    expect(glow.alpha).toBeCloseTo(MAGIC_CARD_GLOW.alpha, 5);
  });

  it('draws the glow with MagicCard’s footprint: 200 px, fading to the edge', () => {
    const spotlight = collapse(blockBody('@utility spotlight'));

    expect(spotlight).toContain(
      'radial-gradient( 12.5rem circle at var(--spot-x, 50%) var(--spot-y, -40%), var(--spot-violet), transparent 100% )',
    );
  });
});
