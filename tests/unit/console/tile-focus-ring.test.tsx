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
 * @file Keyboard focus around linked tiles, checked against the CSS the repo's Tailwind compiles
 * from the classes the components actually render. A linked tile rings itself only while its
 * TileLink has focus; its TileLink then hides its own ring; a secondary link in the tile shows
 * only its own ring; and a TileLink outside a linked tile keeps the base :focus-visible ring.
 *
 * jsdom applies no stylesheet, but its selector engine supports :has() and :focus-visible, so
 * each compiled rule is matched against the focused DOM with element.matches().
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { compile } from 'tailwindcss';
import { describe, expect, it, vi } from 'vitest';

import { Tile } from '@/components/console/tile';
import { TileLink } from '@/components/console/tile-link';

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

interface CssRule {
  readonly selector: string;
  readonly declarations: string;
}

/**
 * The body of the first `@theme inline` block of globals.css, which maps `--color-focus`. Braces
 * are counted because the block nests @keyframes.
 */
function themeInlineBody(): string {
  const css = read('src/styles/globals.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const start = css.search(/^@theme\s+inline\s*\{/m);
  if (start < 0) throw new Error('no @theme inline block in globals.css');
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(open + 1, index);
  }
  throw new Error('unclosed @theme inline block in globals.css');
}

/** Compiles `candidates` with the repo's Tailwind, its default theme and the colour map. */
async function compileClasses(candidates: Iterable<string>): Promise<string> {
  const defaultTheme = read('node_modules/tailwindcss/theme.css');
  const source = `${defaultTheme}\n@theme inline {${themeInlineBody()}}\n@tailwind utilities;`;
  const { build } = await compile(source);
  return build([...candidates]);
}

/**
 * The class rules (a selector and its declarations) of compiled CSS; these utilities compile
 * without nesting. Statements such as `@layer properties;` end before a selector, so only the
 * text after the last `;` is kept.
 */
function rulesOf(css: string): CssRule[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return Array.from(source.matchAll(/([^{}]+)\{([^{}]*)\}/g), ([, head = '', body = '']) => ({
    selector: (head.split(';').at(-1) ?? '').trim(),
    declarations: body.replace(/\s+/g, ' ').trim(),
  })).filter(({ selector }) => selector.startsWith('.') || selector.startsWith('['));
}

/** Every class used anywhere under `root`, so the CSS compiled is exactly what renders. */
function classesUnder(root: Element): Set<string> {
  const elements = [root, ...root.querySelectorAll('[class]')];
  return new Set(elements.flatMap((element) => Array.from(element.classList)));
}

/** The declarations of every compiled rule that applies to `element` in its current state. */
function appliedDeclarations(rules: readonly CssRule[], element: Element): string {
  return rules
    .filter(({ selector }) => element.matches(selector))
    .map(({ declarations }) => declarations)
    .join(' ');
}

async function renderLinkedTile(): Promise<{ rules: CssRule[]; tile: HTMLElement }> {
  const { container } = render(
    <>
      <Tile variant="linked" as="article" aria-label="Fraud Guard">
        <h3>
          <TileLink href="/projects/fraud-guard">Fraud Guard</TileLink>
        </h3>
        <a className="relative z-10" href="https://github.com/WomB0ComB0">
          Latest commit
        </a>
      </Tile>
      <Tile as="article" aria-label="Typing">
        <TileLink href="/stats">Typing</TileLink>
      </Tile>
    </>,
  );
  const rules = rulesOf(await compileClasses(classesUnder(container)));
  return { rules, tile: screen.getByRole('article', { name: 'Fraud Guard' }) };
}

describe('linked tile focus ring', () => {
  it('compiles the ring and the scoped suppression to the selectors they promise', async () => {
    const { rules } = await renderLinkedTile();
    const selectors = rules.map(({ selector }) => selector);

    expect(selectors).toContainEqual(
      expect.stringMatching(/:has\(:is\(\[data-tile-link\]:focus-visible\)\)$/),
    );
    expect(selectors).toContainEqual(
      expect.stringMatching(/^\[data-linked-tile\] \.\S+:focus-visible$/),
    );
    // Nothing removes the outline from every focused TileLink.
    expect(selectors).not.toContain('.focus-visible\\:outline-none:focus-visible');
  });

  it('rings the tile, not the link, while its TileLink has keyboard focus', async () => {
    const { rules, tile } = await renderLinkedTile();
    const link = screen.getByRole('link', { name: 'Fraud Guard' });

    link.focus();

    const ring = appliedDeclarations(rules, tile);
    expect(ring).toContain('outline-width: 2px');
    expect(ring).toContain('outline-offset: 2px');
    expect(ring).toContain('outline-color: var(--focus)');
    expect(appliedDeclarations(rules, link)).toContain('outline-style: none');
  });

  it('leaves the tile unringed while a secondary link has focus, which keeps its own ring', async () => {
    const { rules, tile } = await renderLinkedTile();
    const commit = screen.getByRole('link', { name: 'Latest commit' });

    commit.focus();

    expect(appliedDeclarations(rules, tile)).not.toMatch(/outline/);
    expect(appliedDeclarations(rules, commit)).not.toMatch(/outline/);
  });

  it('keeps the base focus ring on a TileLink outside a linked tile', async () => {
    const { rules } = await renderLinkedTile();
    const link = screen.getByRole('link', { name: 'Typing' });
    const plainTile = screen.getByRole('article', { name: 'Typing' });

    link.focus();

    expect(link).toHaveFocus();
    expect(appliedDeclarations(rules, link)).not.toMatch(/outline-style:\s*none/);
    expect(appliedDeclarations(rules, plainTile)).not.toMatch(/outline/);
  });
});
