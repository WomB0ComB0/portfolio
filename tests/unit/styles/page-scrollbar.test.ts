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
 * @file The page keeps a visible, themed scrollbar, and the UA draws dark form controls.
 *
 * A bare `::-webkit-scrollbar { width: 0 }` hides the scrollbar of the page and of every
 * scrolling box (the command palette, menus) in Chromium and Safari. Only opt-in classes such as
 * `.scrollbar-hide` may hide one.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest runs from the repository root; under jsdom import.meta.url is not a file: URL.
const GLOBALS_CSS = join(process.cwd(), 'src/styles/globals.css');

interface CssRule {
  readonly selector: string;
  readonly body: string;
}

/** Every style rule in `css`, including those nested in at-rules, with whitespace collapsed. */
function styleRules(css: string): CssRule[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  const visit = (block: string): void => {
    let depth = 0;
    let headStart = 0;
    let bodyStart = 0;
    for (let i = 0; i < block.length; i++) {
      if (block[i] === ';' && depth === 0) headStart = i + 1;
      if (block[i] === '{' && depth++ === 0) bodyStart = i + 1;
      if (block[i] === '}' && --depth === 0) {
        const head = block
          .slice(headStart, bodyStart - 1)
          .replace(/\s+/g, ' ')
          .trim();
        const body = block.slice(bodyStart, i);
        if (head.startsWith('@')) visit(body);
        else rules.push({ selector: head, body });
        headStart = i + 1;
      }
    }
  };
  visit(source);
  return rules;
}

const declares = (body: string, property: string): string | undefined =>
  new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*([^;]+);`).exec(body)?.[1]?.trim();

describe('scrollbars and colour scheme (globals.css)', () => {
  const rules = styleRules(readFileSync(GLOBALS_CSS, 'utf8'));
  const rule = (selector: string): CssRule => {
    const found = rules.find((candidate) => candidate.selector === selector);
    if (!found) throw new Error(`no "${selector}" rule in globals.css`);
    return found;
  };

  it('parses the rules it guards', () => {
    expect(rules.some((candidate) => candidate.selector === ':root')).toBe(true);
    expect(rules.some((candidate) => candidate.selector === '.scrollbar-hide')).toBe(true);
  });

  it('styles ::-webkit-scrollbar only under an opt-in class, never for every element', () => {
    const scrollbarSelectors = rules
      .flatMap((candidate) => candidate.selector.split(','))
      .map((selector) => selector.trim())
      .filter((selector) => /::-webkit-scrollbar\b/.test(selector));

    expect(scrollbarSelectors.length).toBeGreaterThan(0);
    for (const selector of scrollbarSelectors) {
      expect(selector, `${selector} is not scoped to a class`).toMatch(/^\.[\w-]+::-webkit/);
    }
  });

  /** The html rule that styles the page scrollbar. */
  const pageScrollbarRule = (): CssRule | undefined =>
    rules.find(
      (candidate) =>
        candidate.selector.split(',').some((selector) => selector.trim() === 'html') &&
        declares(candidate.body, 'scrollbar-color') !== undefined,
    );

  it('gives the page a thin scrollbar in the theme colours', () => {
    const html = pageScrollbarRule();

    expect(html, 'no html rule declares scrollbar-color').toBeDefined();
    expect(declares(html?.body ?? '', 'scrollbar-width')).toBe('thin');
    expect(declares(html?.body ?? '', 'scrollbar-color')).toMatch(/var\(--[\w-]+\).*\s\S+$/);
  });

  // With a classic (non-overlay) scrollbar, a scroll lock (body overflow hidden) or a page shorter
  // than the viewport removes the scrollbar and widens the viewport, so the layout jumps sideways.
  it('reserves the page scrollbar gutter, so scroll locks and short pages do not shift the layout', () => {
    expect(declares(pageScrollbarRule()?.body ?? '', 'scrollbar-gutter')).toBe('stable');
  });

  it('declares the dark colour scheme on :root, so form controls and scrollbars are dark', () => {
    expect(declares(rule(':root').body, 'color-scheme')).toBe('dark');
  });
});
