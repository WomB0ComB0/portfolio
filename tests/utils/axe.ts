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
 * @file axe-core on rendered components, under Vitest's jsdom: the WCAG 2.0 to 2.2 Level A and
 * AA rules, less those jsdom cannot evaluate because they need layout (JSDOM_LAYOUT_RULES).
 * Those, and the whole pages, are checked in a real browser by e2e/accessibility/a11y.spec.ts.
 * Not a test file.
 *
 * label-content-name-mismatch (WCAG 2.5.3, Label in Name: a link or button's name contains the
 * text it shows) needs two things a browser has and jsdom does not, which each run lends it
 * (withBrowserBits): a canvas, and the stylesheet that hides `.sr-only` text.
 *
 * @example
 * const { container } = render(<Privacy />);
 * await expectNoAxeViolations(container);
 */

import axe from 'axe-core';

import { formatViolations, REVIEW_AS_FAILURE_RULES, WCAG_AA_TAGS } from './axe-report';

/**
 * Rules that measure what jsdom never computes, so their verdicts there mean nothing:
 * - color-contrast and link-in-text-block compare rendered colours (no cascade from Tailwind,
 *   no backgrounds behind the text);
 * - target-size measures boxes, which are all 0 x 0 (or a test's stub);
 * - scrollable-region-focusable needs a box that overflows, and nothing scrolls in jsdom.
 */
export const JSDOM_LAYOUT_RULES = [
  'color-contrast',
  'link-in-text-block',
  'target-size',
  'scrollable-region-focusable',
] as const;

export interface AxeCheckOptions {
  /**
   * Rules to turn on or off by id, on top of the WCAG set: a best-practice rule that fits what is
   * rendered (heading-order for a whole page with its h1), or a rule the render cannot satisfy.
   */
  readonly rules?: Readonly<Record<string, boolean>>;
  /** Names what was checked in a failure's message, e.g. 'the /privacy page'. */
  readonly label?: string;
}

/** axe's rule options: the layout rules off, then the caller's on or off. */
const ruleOptions = (rules: Readonly<Record<string, boolean>> = {}): axe.RuleObject =>
  Object.fromEntries([
    ...JSDOM_LAYOUT_RULES.map((id) => [id, { enabled: false }] as const),
    ...Object.entries(rules).map(([id, enabled]) => [id, { enabled }] as const),
  ]);

/**
 * Tailwind 4's `sr-only`, which the components use for words only a screen reader hears ('to'
 * between a range's dates). Without it jsdom shows them, and label-content-name-mismatch would
 * hold a name to words nobody sees.
 */
const SR_ONLY_CSS =
  '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;' +
  'clip-path:inset(50%);white-space:nowrap;border-width:0}';

/** What axe's icon-ligature check calls on a 2D context. */
interface LigatureCanvas {
  readonly canvas: HTMLCanvasElement;
  font: string;
  textAlign: string;
  textBaseline: string;
  measureText(text: string): { readonly width: number };
  fillText(): void;
  clearRect(): void;
  getImageData(x: number, y: number, width: number, height: number): { readonly data: Uint8Array };
}

/** Every glyph's width, any one: what matters is that a word is as wide as its letters. */
const GLYPH_WIDTH = 10;

/**
 * A 2D context on which every word is drawn as a word. axe's label-content-name-mismatch skips
 * text drawn as an icon-font ligature ('home' shown as a house), and tells one by drawing it;
 * jsdom has no 2D context, so the check threw, axe filed the rule as "needs review" and it checked
 * nothing. jsdom loads no fonts and the site's icons are SVGs, not ligatures, so "never a ligature"
 * is the truth here: each glyph is as wide as the next and every pixel is ink.
 */
function wordCanvas(canvas: HTMLCanvasElement): LigatureCanvas {
  return {
    canvas,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    measureText: (text) => ({ width: text.length * GLYPH_WIDTH }),
    fillText: () => {},
    clearRect: () => {},
    getImageData: (_x, _y, width, height) => ({
      data: new Uint8Array(Math.max(1, Math.ceil(width) * Math.ceil(height)) * 4).fill(255),
    }),
  };
}

/**
 * Runs `check` with what label-content-name-mismatch needs from a browser (Tailwind's sr-only and
 * a 2D canvas), then takes both away again, so no other test sees them.
 */
async function withBrowserBits<T>(check: () => Promise<T>): Promise<T> {
  const style = document.createElement('style');
  style.dataset.axeHelper = '';
  style.textContent = SR_ONLY_CSS;
  document.head.append(style);
  const canvas = HTMLCanvasElement.prototype;
  const { getContext } = canvas;
  canvas.getContext = function getWordContext(this: HTMLCanvasElement) {
    return wordCanvas(this);
  } as unknown as typeof getContext;
  try {
    return await check();
  } finally {
    canvas.getContext = getContext;
    style.remove();
  }
}

/**
 * The WCAG A and AA violations axe finds in `context` (an element and what it holds; the body for
 * content in portals), with the layout rules off, and the needs-review results of
 * REVIEW_AS_FAILURE_RULES (a duplicate id ARIA points at), which are failures here. Pass an
 * element, not the document: the document's own rules (a title, the html's lang) belong to the
 * root layout, which the browser spec checks, not to jsdom's empty test document.
 */
export async function axeViolations(
  context: Element = document.body,
  options: AxeCheckOptions = {},
): Promise<axe.Result[]> {
  const results = await withBrowserBits(() =>
    axe.run(context, {
      runOnly: { type: 'tag', values: [...WCAG_AA_TAGS] },
      rules: ruleOptions(options.rules),
      // Passes and inapplicable rules are never read; they keep one node each, which is faster.
      resultTypes: ['violations', 'incomplete'],
    }),
  );
  return [
    ...results.violations,
    ...results.incomplete.filter((result) => REVIEW_AS_FAILURE_RULES.includes(result.id)),
  ];
}

/**
 * Fails with every violation's rule id, impact, help and the failing nodes' HTML when axe finds
 * any WCAG A or AA violation in `context`.
 *
 * @example
 * await expectNoAxeViolations(document.body, { label: 'the open command menu' });
 */
export async function expectNoAxeViolations(
  context: Element = document.body,
  options: AxeCheckOptions = {},
): Promise<void> {
  const violations = await axeViolations(context, options);
  if (violations.length > 0) throw new Error(formatViolations(violations, options.label));
}
