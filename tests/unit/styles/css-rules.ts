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
 * @file Reads a plain stylesheet as text, for the tests of src/styles/*.css (Vitest runs no
 * PostCSS): every style rule with the at-rules around it, and the declarations in a rule body.
 */

export interface CssRule {
  /** The enclosing at-rule preludes, outermost first, whitespace collapsed. */
  readonly conditions: readonly string[];
  readonly selector: string;
  readonly body: string;
}

/** Every style rule in `css` with the at-rules around it, comments removed. */
export function styleRules(css: string): CssRule[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  const visit = (block: string, conditions: readonly string[]): void => {
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
        const body = block.slice(bodyStart, i).replace(/\s+/g, ' ');
        if (head.startsWith('@keyframes')) rules.push({ conditions, selector: head, body });
        else if (head.startsWith('@')) visit(body, [...conditions, head]);
        else rules.push({ conditions, selector: head, body });
        headStart = i + 1;
      }
    }
  };
  visit(source, []);
  return rules;
}

/**
 * The declarations of a rule body in order, as [property, value]. Spaces just inside parentheses
 * are dropped, as the formatter adds them when it wraps a long gradient over several lines.
 */
export function declarations(body: string): [string, string][] {
  return body
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const colon = part.indexOf(':');
      const value = part
        .slice(colon + 1)
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .trim();
      return [part.slice(0, colon).trim(), value];
    });
}

/** The one rule in `rules` with this selector under exactly these at-rules. */
export function findRule(
  rules: readonly CssRule[],
  selector: string,
  conditions: readonly string[] = [],
): CssRule {
  const found = rules.filter(
    (candidate) =>
      candidate.selector === selector &&
      candidate.conditions.join(' | ') === conditions.join(' | '),
  );
  if (found.length !== 1) {
    throw new Error(
      `expected one "${selector}" rule under [${conditions.join(', ')}], found ${found.length}`,
    );
  }
  return found[0] as CssRule;
}

/** A property's value in a rule (the last declaration wins, as in CSS). */
export function declaredValue(target: CssRule, property: string): string | undefined {
  return declarations(target.body)
    .filter(([name]) => name === property)
    .at(-1)?.[1];
}
