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
 * @file What the component axe checks (tests/utils/axe.ts, under jsdom) and the browser axe spec
 * (e2e/accessibility/a11y.spec.ts) share: the WCAG tags they run and how a failure reads. Pure,
 * with no DOM and no axe runtime, so the Playwright side can import it in Node.
 */

import type { ImpactValue } from 'axe-core';

/** WCAG 2.0, 2.1 and 2.2 at Levels A and AA, the standard the 2026-11-20 audit held the site to. */
export const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;

/**
 * Rules axe reports only as "needs review" that are failures here whenever they fire. Two
 * elements with one id that ARIA points at name or describe the wrong element (the audit's
 * minor 5: the "See also" landmark was named "Photos and videos"), and axe 4.10 files that under
 * incomplete, not violations.
 */
export const REVIEW_AS_FAILURE_RULES: readonly string[] = ['duplicate-id-aria'];

/** How many failing nodes a report prints per rule; the count says how many more there are. */
const NODES_SHOWN = 8;
/** How much of a node's HTML a report prints. */
const HTML_SHOWN = 300;

/** The parts of an axe result a report prints (axe's Result, or its JSON from a browser). */
export interface ReportedViolation {
  readonly id: string;
  readonly impact?: ImpactValue;
  readonly help: string;
  readonly helpUrl?: string;
  readonly nodes: readonly {
    readonly html: string;
    readonly target?: readonly unknown[];
    readonly failureSummary?: string;
  }[];
}

/** A node's HTML on one line, cut to HTML_SHOWN characters. */
const oneLine = (html: string): string => {
  const flat = html.replaceAll(/\s+/g, ' ').trim();
  return flat.length > HTML_SHOWN ? `${flat.slice(0, HTML_SHOWN)}…` : flat;
};

/** The failure summary's lines, indented under its node. */
const summaryLines = (summary: string | undefined): string[] =>
  (summary ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `        ${line}`);

/**
 * The violations as a readable report: per rule its id, impact, help and link, then each failing
 * node's HTML, selector and what to fix. Empty when there are none.
 *
 * @example
 * formatViolations(results.violations, '/privacy at desktop');
 */
export function formatViolations(
  violations: readonly ReportedViolation[],
  where = 'the rendered markup',
): string {
  if (violations.length === 0) return '';
  const rules = violations.map((violation) => {
    const head = `- ${violation.id} [${violation.impact ?? 'no impact'}]: ${violation.help}${
      violation.helpUrl ? ` (${violation.helpUrl})` : ''
    }`;
    const nodes = violation.nodes
      .slice(0, NODES_SHOWN)
      .flatMap((node) => [
        `    ${oneLine(node.html)}`,
        ...(node.target ? [`      at ${node.target.map(String).join(' > ')}`] : []),
        ...summaryLines(node.failureSummary),
      ]);
    const more =
      violation.nodes.length > NODES_SHOWN
        ? [`    …and ${violation.nodes.length - NODES_SHOWN} more nodes`]
        : [];
    return [head, ...nodes, ...more].join('\n');
  });
  const count = violations.length === 1 ? '1 axe rule' : `${violations.length} axe rules`;
  return `${count} failed in ${where}:\n${rules.join('\n')}`;
}
