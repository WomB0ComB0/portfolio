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
 * @file Guards the element rules in the first `@layer base` block of src/styles/globals.css.
 *
 * In Tailwind v4, `leading-*` sets `--tw-leading`, and every `text-*` size utility reads that
 * variable before its own default line height. A `leading-*` in a base element rule therefore
 * overrides the line height of every sized element it matches, so base rules use plain
 * `line-height` values instead. Spans have no base rule, so they inherit from their parent.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest runs from the repository root (where vitest.config.ts lives); under jsdom
// import.meta.url is not a file: URL, so resolve from the working directory instead.
const GLOBALS_CSS = join(process.cwd(), 'src/styles/globals.css');

/** Returns the body of the first `@layer base { ... }` block, matching braces. */
function firstBaseLayer(css: string): string {
  const start = css.indexOf('@layer base {');
  if (start < 0) throw new Error('no @layer base block in globals.css');
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error('unterminated @layer base block in globals.css');
}

/** Maps each top-level rule's selector list (whitespace removed) to its declaration block. */
function topLevelRules(block: string): Map<string, string> {
  const withoutComments = block.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = new Map<string, string>();
  let depth = 0;
  let selectorStart = 0;
  let bodyStart = 0;
  for (let i = 0; i < withoutComments.length; i++) {
    const char = withoutComments[i];
    if (char === '{' && depth++ === 0) bodyStart = i + 1;
    if (char === '}' && --depth === 0) {
      const selector = withoutComments.slice(selectorStart, bodyStart - 1).replace(/\s+/g, '');
      rules.set(selector, withoutComments.slice(bodyStart, i));
      selectorStart = i + 1;
    }
  }
  return rules;
}

describe('base typography rules (globals.css)', () => {
  const css = readFileSync(GLOBALS_CSS, 'utf8');
  const rules = topLevelRules(firstBaseLayer(css));

  it('has exactly one @layer base block, so these checks see every base rule', () => {
    // A second block could bring back blanket tabular-nums or transition-all unseen.
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments.match(/@layer\s+base\s*\{/g)).toHaveLength(1);
  });
  const rule = (selector: string): string => {
    const body = rules.get(selector);
    if (body === undefined) throw new Error(`no "${selector}" rule in the first @layer base`);
    return body;
  };

  it('parses the element rules it guards', () => {
    expect(rules.has('body')).toBe(true);
    expect(rules.has('a')).toBe(true);
  });

  it('has no span rule, so spans inherit colour, weight and line height', () => {
    for (const selector of rules.keys()) {
      expect(selector.split(',')).not.toContain('span');
    }
  });

  it('gives headings a plain 1.2 line height and no leading-* utility', () => {
    const headings = rule('h1,h2,h3,h4,h5,h6');
    expect(headings).toMatch(/line-height:\s*1\.2\s*;/);
    expect(headings).not.toMatch(/\bleading-/);
  });

  it('colours headings with the primary text token, not the brand colour', () => {
    const headings = rule('h1,h2,h3,h4,h5,h6');
    expect(headings).toMatch(/@apply[^;]*\btext-foreground\b/);
    expect(headings).not.toMatch(/\btext-primary\b/);
  });

  it('colours links with --brand-ink, which meets 4.5:1 on every surface', () => {
    expect(rule('a')).toMatch(/(?:^|[;\s])color:\s*var\(--brand-ink\)\s*;/);
  });

  it('draws one 2px focus ring in --focus on :focus-visible', () => {
    expect(rule(':focus-visible')).toMatch(/outline:\s*2px\s+solid\s+var\(--focus\)\s*;/);
  });

  it('does not animate every html property or force tabular numbers on the page', () => {
    for (const selector of [':host,html', 'html']) {
      expect(rule(selector), selector).not.toMatch(/\btransition-all\b/);
      expect(rule(selector), selector).not.toMatch(/\btabular-nums\b/);
    }
  });

  it('applies tabular-nums through no universal (*) rule', () => {
    const universal = [...rules.entries()].filter(([selector]) => selector.includes('*'));
    expect(universal.length).toBeGreaterThan(0);
    for (const [selector, body] of universal) {
      expect(body, selector).not.toMatch(/\btabular-nums\b/);
    }
  });

  it('gives paragraphs a plain 1.75 line height and lets them inherit their colour', () => {
    const paragraph = rule('p');
    expect(paragraph).toMatch(/line-height:\s*1\.75\s*;/);
    expect(paragraph).not.toMatch(/\bleading-/);
    expect(paragraph).not.toMatch(/\btext-primary\b/);
    expect(paragraph).not.toMatch(/(?:^|[;\s])color\s*:/);
  });
});
