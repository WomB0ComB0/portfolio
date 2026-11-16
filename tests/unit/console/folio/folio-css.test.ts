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
 * @file The Folio rules that live in text: the primitives' class strings follow the refined type
 * (no mono face, capitals or tracked chrome label), and globals.css's Folio block is palette only,
 * caps every display size (rem, screen height and the word's fit), never moves, ends the stage
 * without a seam, and compiles with the repo's Tailwind.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

const FOLIO_DIR = 'src/components/console/folio';
const FOLIO_FILES = readdirSync(join(root, FOLIO_DIR)).filter((name) => /\.tsx?$/.test(name));

/** The quoted strings of a source file: where its class names live. */
function quotedStrings(source: string): string[] {
  return [...source.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)].map(
    ([, single, double, template]) => single ?? double ?? template ?? '',
  );
}

/** The same forbidden set as refined-type-classes.test.ts. */
const FORBIDDEN =
  /(?:^|[\s:])!?(?:label-mono|font-mono|uppercase|tracking-label|text-(?:label|stat|display|hero))!?(?=[\s/]|$)/;

const GLOBALS = read('src/styles/globals.css');
const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** globals.css from the Folio comment to the next section (View transitions). */
const FOLIO_CSS = (() => {
  const start = GLOBALS.indexOf(' * Folio: the editorial primitives');
  const end = GLOBALS.indexOf(' * View transitions.', start);
  if (start < 0 || end < 0) throw new Error('no Folio block in globals.css');
  return withoutComments(GLOBALS.slice(start, end));
})();

/** One top-level `@utility name { ... }` block, nested blocks included. */
function utilityBlock(name: string): string {
  const head = `@utility ${name} {`;
  const start = FOLIO_CSS.indexOf(head);
  if (start < 0) throw new Error(`no @utility ${name}`);
  let depth = 0;
  for (let index = start + head.length - 1; index < FOLIO_CSS.length; index += 1) {
    if (FOLIO_CSS[index] === '{') depth += 1;
    if (FOLIO_CSS[index] === '}') depth -= 1;
    if (depth === 0) return FOLIO_CSS.slice(start, index + 1);
  }
  throw new Error(`unclosed @utility ${name}`);
}

const UTILITIES = [
  'folio-numeral',
  'folio-numeral-step',
  'folio-numeral-inline',
  'type-cover',
  'type-cover-face',
  'type-cover-lead',
  'type-cover-rest',
  'quiet-stage',
  'byline-pause',
] as const;

const lastFontSize = (block: string): string => {
  const sizes = [...block.matchAll(/font-size:\s*([^;]+);/g)].map(([, value = '']) =>
    value.replace(/\s+/g, ' ').trim(),
  );
  return sizes.at(-1) ?? '';
};

/**
 * The quiet line's size, spaces removed: its font-size, or the custom property it reads (the
 * same value also decides whether the line shows).
 */
function restSize(): string {
  const block = utilityBlock('type-cover-rest');
  const size = lastFontSize(block).replace(/\s+/g, '');
  const read = /^var\((--[\w-]+)\)$/.exec(size)?.[1];
  if (!read) return size;
  const declared = new RegExp(`${read}:\\s*([^;]+);`).exec(block)?.[1] ?? '';
  return declared.replace(/\s+/g, '');
}

describe('refined type in the Folio primitives', () => {
  it('finds the primitives to check', () => {
    expect(FOLIO_FILES).toEqual(expect.arrayContaining(['byline.tsx', 'chapter-opener.tsx']));
  });

  it.each(FOLIO_FILES)('%s sets no mono face, capitals or tracked chrome label', (file) => {
    const offending = quotedStrings(read(join(FOLIO_DIR, file))).filter((text) =>
      FORBIDDEN.test(text),
    );

    expect(offending).toEqual([]);
  });

  it.each(FOLIO_FILES)('%s has no client directive, so server pages can draw it', (file) => {
    expect(read(join(FOLIO_DIR, file))).not.toMatch(/^\s*['"]use client['"]/m);
  });
});

describe("globals.css's Folio block", () => {
  it.each(UTILITIES)('defines @utility %s exactly once', (name) => {
    expect(GLOBALS.split(`@utility ${name} {`)).toHaveLength(2);
  });

  it('paints only with house tokens: no colour literal of its own', () => {
    expect(FOLIO_CSS).not.toMatch(/oklch\(|rgba?\(|hsla?\(|#[0-9a-f]{3,8}\b/i);
    for (const [, token = ''] of FOLIO_CSS.matchAll(/var\(--([\w-]+)/g)) {
      expect(token).toMatch(
        /^(?:fg|fg-faint|surface-1|surface-2|canvas|brand-wash|brand-glow|spot-violet|font-sans|folio-fit|folio-rest-fit|folio-grain|quiet-stage-hang|type-cover-name|type-cover-rest)$/,
      );
    }
  });

  it('declares the grain once, in the one base layer, never in the literal first :root block', () => {
    const css = withoutComments(GLOBALS);
    const firstRoot = css.slice(css.search(/^:root\s*\{/m));
    const baseLayer = css.slice(css.indexOf('@layer base {'));
    const baseRoot = baseLayer.slice(baseLayer.indexOf(':root {'));

    expect(css.match(/--folio-grain:/g)).toHaveLength(1);
    expect(firstRoot.slice(0, firstRoot.indexOf('}'))).not.toContain('--folio-grain');
    expect(baseRoot.slice(0, baseRoot.indexOf('}'))).toContain(
      '--folio-grain: url("data:image/svg+xml,',
    );
    expect(css.match(/@layer\s+base\s*\{/g)).toHaveLength(1);
  });

  it.each(['folio-numeral', 'folio-numeral-step', 'folio-numeral-inline'])(
    "caps %s's size in rem or its box, and by its widest word's fit",
    (name) => {
      const size = lastFontSize(utilityBlock(name));

      expect(size).toMatch(/^min\(/);
      expect(size).toContain('var(--folio-fit, 4) * 0.6');
    },
  );

  it("caps a cover's name in rem, its box and its fit, and keeps the quiet line under it", () => {
    const name = (
      /--type-cover-name:\s*([^;]+);/.exec(utilityBlock('type-cover-face'))?.[1] ?? ''
    ).replace(/\s+/g, '');

    expect(name).toMatch(/^min\(/);
    expect(name).toMatch(/\d+(?:\.\d+)?rem/);
    expect(name).toContain('var(--folio-fit,4)*0.6');
    expect(lastFontSize(utilityBlock('type-cover-lead'))).toBe('var(--type-cover-name)');
    // 200% text in a small cover once set 'Enterprise' (17px) over 'Data Pipeline' (12.8px): the
    // quiet line's size answers to the name's.
    expect(restSize()).toContain('var(--type-cover-name)');
  });

  it("drops a cover's quiet line where it would be texture rather than words", () => {
    const rest = utilityBlock('type-cover-rest');

    // Never sized under 10px for the name's sake, and left out of a cover under 100px wide.
    expect(restSize()).toMatch(/max\(calc\(var\(--type-cover-name\)\*[\d.]+\),10px\)/);
    expect(rest).toMatch(/@container type-cover \(width < 100px\)\s*\{[^}]*display: none;/);
    expect(utilityBlock('type-cover')).toContain('container-name: type-cover');
    // Where its fit alone would set it under 10px, it shows nothing (max-height 0).
    expect(rest.replace(/\s+/g, '')).toContain('max-height:max(0px,calc((var(--type-cover-rest)-');
  });

  it.each([
    ['folio-numeral', '10rem', '22svh'],
    ['folio-numeral-step', '6rem', '14svh'],
  ])('%s tops out at %s and %s of the screen, so 200%% text cannot eat it', (name, rem, svh) => {
    const size = lastFontSize(utilityBlock(name));

    expect(size).toContain(`${rem})`);
    expect(size).toContain(svh);
  });

  it("fits a cover's words to its line inside the face's padding", () => {
    const face = utilityBlock('type-cover-face').replace(/\s+/g, '');
    const padding = /padding:\d+(?:\.\d+)?cqh(\d+(?:\.\d+)?)cqi;/.exec(face)?.[1];
    const line = `${100 - 2 * Number(padding)}cqi`;

    // The name and the quiet line both fit the width the face's side padding leaves.
    expect(padding).toBeDefined();
    expect(face).toContain(`calc(${line}/(var(--folio-fit,4)*0.6))`);
    expect(restSize()).toContain(`calc(${line}/(var(--folio-rest-fit,8)*0.6))`);
  });

  it.each(['folio-numeral', 'folio-numeral-step', 'type-cover'])(
    "keeps %s's fit under a phone's text scaling (text-size-adjust at 100%%)",
    (name) => {
      expect(utilityBlock(name)).toContain('-webkit-text-size-adjust: 100%;');
      expect(utilityBlock(name)).toContain('text-size-adjust: 100%;');
    },
  );

  it("lets the inline heading grow with a phone's text scaling, so it never falls under body text", () => {
    expect(utilityBlock('folio-numeral-inline')).not.toContain('text-size-adjust');
  });

  it("speaks a byline's pause as ', ' and draws nothing: empty content with alt text", () => {
    // A browser without generated-content alt text drops the declaration: no pseudo-element.
    expect(utilityBlock('byline-pause')).toMatch(/&::after\s*\{\s*content: "" \/ ", ";\s*\}/);
  });

  it('steps the numerals down: lead 10rem > step 6rem > inline 2.25rem', () => {
    expect(lastFontSize(utilityBlock('folio-numeral-inline'))).toContain('2.25rem)');
  });

  it('gives every size a plain fallback first, for a browser without cqi or svh', () => {
    for (const name of ['folio-numeral', 'folio-numeral-step', 'folio-numeral-inline']) {
      const sizes = [...utilityBlock(name).matchAll(/font-size:/g)];
      expect(sizes, name).toHaveLength(2);
    }
  });

  it('uses the refined weights only (600) and no capitals', () => {
    for (const [, weight = ''] of FOLIO_CSS.matchAll(/font-weight:\s*(\d+)/g)) {
      expect(['400', '500', '600']).toContain(weight);
    }
    expect(FOLIO_CSS).not.toMatch(/text-transform:\s*uppercase/);
  });

  it('never moves: no transition or animation, so reduced motion has nothing to still', () => {
    expect(FOLIO_CSS).not.toMatch(/\b(?:transition|animation)\s*:/);
  });

  it('ends the quiet stage in fades, never a hairline seam or a hard side', () => {
    const stage = utilityBlock('quiet-stage');
    const light = /&::before\s*\{[^}]*background:([^;]+);/.exec(stage)?.[1] ?? '';

    expect(stage).not.toMatch(/border/);
    expect(light).toContain('var(--spot-violet)');
    // No rectangle fill: a linear gradient across the box drew the page column's sides.
    expect(light).not.toContain('linear-gradient');
    expect(stage).toMatch(/mask-image:\s*linear-gradient\(180deg, transparent, black 2\.5rem\)/);
    expect(stage).toContain('mask-composite: intersect');
    expect(stage).toContain('inset: 0 0 var(--quiet-stage-hang, 0%)');
    expect(stage).toMatch(/@media \(forced-colors: active\)/);
  });

  it("fades every stage light to transparent before the box's sides and bottom", () => {
    const light = /&::before\s*\{[^}]*background:([^;]+);/.exec(utilityBlock('quiet-stage'))?.[1];
    const ellipses = [
      ...(light ?? '').matchAll(
        /radial-gradient\((\d+)% (\d+)% at (\d+)% 0%, var\(--[\w-]+\), transparent (\d+)%\)/g,
      ),
    ].map(([, rx = '0', ry = '0', x = '0', stop = '0']) => ({
      rx: Number(rx),
      ry: Number(ry),
      x: Number(x),
      stop: Number(stop) / 100,
    }));

    expect(ellipses).toHaveLength(3);
    for (const { rx, ry, x, stop } of ellipses) {
      // In units of the ellipse's radius, how far its centre is from the nearer side and the bottom.
      expect(Math.min(x, 100 - x) / rx).toBeGreaterThanOrEqual(stop);
      expect(100 / ry).toBeGreaterThanOrEqual(stop);
    }
  });

  it('keeps the cover word whole: one line, no shift, line height 1', () => {
    const lead = utilityBlock('type-cover-lead');

    expect(lead).toContain('white-space: nowrap');
    expect(lead).toContain('line-height: 1;');
    expect(lead).not.toMatch(/transform|translate/);
    expect(utilityBlock('type-cover')).toContain('container-type: size');
  });

  it('compiles every utility with the repo Tailwind', async () => {
    const theme = read('node_modules/tailwindcss/theme.css');
    const utilities = UTILITIES.map(utilityBlock).join('\n');
    const { build } = await compile(`${theme}\n${utilities}\n@tailwind utilities;`);
    const css = build([...UTILITIES]);

    // A utility of nested rules only comes out flattened ('.byline-pause::after {').
    for (const name of UTILITIES)
      expect(css, name).toMatch(new RegExp(`\\.${name}(?:::after)? \\{`));
    expect(css).toMatch(/\.byline-pause::after \{\s*content: "" \/ ", ";/);
    expect(css).toMatch(/\.folio-numeral \{[^}]*background-clip: text/);
  });
});
