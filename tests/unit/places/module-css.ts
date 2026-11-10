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
 * @file Shared checks for the /places CSS modules (read as text; Vitest runs no PostCSS): the
 * owner's standing rules that hover lives only behind a fine pointer, that only compositor
 * properties move, that every colour is a palette token, that every var() resolves, and that
 * each reduced-motion reset really wins over the motion it undoes (same selector, or one at
 * least as specific, later in the file).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type CssRule, declarations, styleRules } from '../styles/css-rules';

export const FINE_POINTER_MEDIA = '@media (hover: hover) and (pointer: fine)';
export const REDUCED_MOTION_MEDIA = '@media (prefers-reduced-motion: reduce)';
export const NO_SCRIPT_MEDIA = '@media (scripting: none)';
export const FORCED_COLOURS_MEDIA = '@media (forced-colors: active)';
export const PLACES_DIR = 'src/app/(routes)/(main)/(personal)/places';
/** The properties allowed to transition or animate: the compositor's own. */
export const COMPOSITOR_PROPERTIES = new Set(['transform', 'opacity', 'translate', 'clip-path']);

/** A stylesheet under the repository root, without its comments. */
export const readCss = (path: string): string =>
  readFileSync(join(process.cwd(), path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Every custom property globals.css defines. */
export const globalTokens = (): ReadonlySet<string> =>
  new Set(
    [...readCss('src/styles/globals.css').matchAll(/(--[a-z0-9-]+)\s*:/g)].map(
      ([, name = '']) => name,
    ),
  );

/** Every custom property a stylesheet reads with var(). */
export const varsRead = (css: string): string[] => [
  ...new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map(([, name = '']) => name)),
];

/** Every custom property a stylesheet declares itself. */
export const varsDeclared = (css: string): ReadonlySet<string> =>
  new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(([, name = '']) => name));

/** The vars a stylesheet reads that neither it nor globals.css defines. */
export function unresolvedVars(css: string): string[] {
  const known = new Set([...globalTokens(), ...varsDeclared(css)]);
  return varsRead(css).filter((name) => !known.has(name));
}

/**
 * Rules whose selector mentions :hover but sit outside the fine-pointer query. A reduced-motion
 * rule may name :hover, since it only puts the rest pose back.
 */
export const hoverOutsideFinePointer = (rules: readonly CssRule[]): string[] =>
  rules
    .filter((rule) => rule.selector.includes(':hover'))
    .filter((rule) => !rule.conditions.includes(FINE_POINTER_MEDIA))
    .filter((rule) => !rule.conditions.includes(REDUCED_MOTION_MEDIA))
    .map((rule) => rule.selector);

/**
 * Every property named in a transition or transition-property, by rule, that is not a
 * compositor property ('none' and 'all' count as offenders except 'none').
 */
export function nonCompositorTransitions(rules: readonly CssRule[]): string[] {
  const offenders: string[] = [];
  for (const rule of rules) {
    for (const [name, value] of declarations(rule.body)) {
      if (name !== 'transition' && name !== 'transition-property') continue;
      if (value === 'none') continue;
      for (const part of value.split(',')) {
        const property = part.trim().split(/\s+/)[0] ?? '';
        if (!COMPOSITOR_PROPERTIES.has(property)) offenders.push(`${rule.selector}: ${property}`);
      }
    }
  }
  return offenders;
}

/** Class names in selectors that are not kebab-case. */
export const nonKebabClasses = (css: string): string[] =>
  [...css.matchAll(/\.([A-Za-z_][\w-]*)/g)]
    .map(([, name = '']) => name)
    .filter((name) => !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name))
    .filter((name) => !/^\d/.test(name));

/** Colour literals, gradients and blur: none belong in a palette-only module. */
export const OFF_PALETTE =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|color-mix|linear-gradient|radial-gradient)\(|blur\(|(?<![\w-])(?:white|black)(?![\w-])/i;

/** The properties that move a box: what reduced motion has to hold still. */
const MOTION_PROPERTIES = new Set(['transform', 'translate', 'rotate', 'scale']);
/** The pseudo-classes a visitor's own action turns on: hover, press and focus. */
const USER_STATE = /:(?:hover|active|focus|focus-visible|focus-within)(?![\w-])/;

/** A selector's specificity as [ids, classes, types]. */
export type Specificity = readonly [number, number, number];

/** Splits `text` on `separator` where it is outside parentheses and brackets. */
function splitTopLevel(text: string, separator: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i] ?? '';
    if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    else if (depth === 0 && separator.test(char)) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** The selectors of a selector list. */
export const selectorsOf = (list: string): string[] => splitTopLevel(list, /,/);

const ZERO: Specificity = [0, 0, 0];
/** :is(), :not(), :has() and :where() with their arguments (one level of nesting inside). */
const FUNCTIONAL = /:(is|not|has|where)\(((?:[^()]|\([^()]*\))*)\)/g;
const ATTRIBUTE = /\[[^\]]*\]/g;

/** The higher of two specificities. */
const higher = (a: Specificity, b: Specificity): Specificity => (compare(a, b) >= 0 ? a : b);

/** Two specificities added up. */
const add = (a: Specificity, b: Specificity): Specificity => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];

/** Compares two specificities: negative, zero or positive, as a sort comparator. */
export function compare(a: Specificity, b: Specificity): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/**
 * A selector's specificity, per Selectors 4: :is(), :not() and :has() count their most specific
 * argument, :where() counts nothing, an attribute or pseudo-class is a class, a pseudo-element
 * or a type is a type.
 *
 * @example
 * specificity('.viewport:not([data-dragging="true"]) .card:hover') // [0, 4, 0]
 */
export function specificity(selector: string): Specificity {
  const functional = [...selector.matchAll(FUNCTIONAL)].map(([, name = '', args = '']) =>
    name === 'where' ? ZERO : selectorsOf(args).map(specificity).reduce(higher, ZERO),
  );
  const plain = selector.replace(FUNCTIONAL, ' ');
  const attributes = plain.match(ATTRIBUTE)?.length ?? 0;
  // Other functional pseudo-classes (:nth-child(2)) count once, without their arguments.
  const rest = plain.replace(ATTRIBUTE, ' ').replace(/\([^()]*\)/g, '');
  const ids = rest.match(/#[\w-]+/g)?.length ?? 0;
  const classes = rest.match(/\.[\w-]+/g)?.length ?? 0;
  const pseudoClasses = rest.match(/(?<!:):[\w-]+/g)?.length ?? 0;
  const elements = rest.match(/::[\w-]+/g)?.length ?? 0;
  const types = rest.match(/(?:^|[\s>+~])[a-z][\w-]*/gi)?.length ?? 0;
  const own: Specificity = [ids, classes + attributes + pseudoClasses, elements + types];
  return functional.reduce(add, own);
}

/** A selector's last compound selector: the element it styles. */
export const subjectOf = (selector: string): string =>
  splitTopLevel(selector, /[\s>+~]/).at(-1) ?? selector;

/**
 * Every motion a visitor sets off (a hover, press or focus rule that moves a box) that the
 * reduced-motion block does not hold still: no reset there for that property on the same
 * element, or only resets that lose to it on specificity (a reset must repeat the selector, or
 * be at least as specific and later in the file).
 */
export function losingReducedMotionResets(rules: readonly CssRule[]): string[] {
  const resets = rules.flatMap((rule, order) =>
    rule.conditions.includes(REDUCED_MOTION_MEDIA)
      ? selectorsOf(rule.selector).map((selector) => ({ selector, order, body: rule.body }))
      : [],
  );
  /** Whether a later reset sets `property` on `selector`'s element and wins over it. */
  const heldStill = (selector: string, property: string, order: number): boolean =>
    resets.some(
      (reset) =>
        reset.order > order &&
        subjectOf(reset.selector) === subjectOf(selector) &&
        declarations(reset.body).some(([name]) => name === property) &&
        compare(specificity(reset.selector), specificity(selector)) >= 0,
    );
  return rules.flatMap((rule, order) => {
    if (rule.conditions.includes(REDUCED_MOTION_MEDIA)) return [];
    const moved = declarations(rule.body)
      .map(([name]) => name)
      .filter((name) => MOTION_PROPERTIES.has(name));
    return selectorsOf(rule.selector)
      .filter((selector) => USER_STATE.test(selector))
      .flatMap((selector) =>
        moved
          .filter((property) => !heldStill(selector, property, order))
          .map((property) => `${selector} { ${property} }`),
      );
  });
}

export { styleRules };
