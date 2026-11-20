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
  const results = await axe.run(context, {
    runOnly: { type: 'tag', values: [...WCAG_AA_TAGS] },
    rules: ruleOptions(options.rules),
    // Passes and inapplicable rules are never read; they keep one node each, which is faster.
    resultTypes: ['violations', 'incomplete'],
  });
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
