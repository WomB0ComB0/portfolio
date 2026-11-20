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
 * PostCSS): every style rule with the at-rules around it, the declarations in a rule body, and a
 * length resolved in px for a given viewport, as a browser would lay it out.
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

/** What a length resolves against when a browser lays it out. */
export interface LengthContext {
  /** The viewport in px: vw is of its width; vh, svh, lvh and dvh of its one (static) height. */
  readonly viewport: { readonly width: number; readonly height: number };
  /** What a percentage is of, in px: for `top`, the containing block's height. */
  readonly percentOf: number;
  /** The custom properties in scope, by name (`--ray-page`). */
  readonly vars: Readonly<Record<string, string>>;
}

/** One token of a length: a custom property name, a function opening, a number, or punctuation. */
const LENGTH_TOKEN = String.raw`\s*(--[\w-]+|[a-z][a-z-]*\(|\d*\.?\d+(?:px|rem|svh|lvh|dvh|vh|vw|%)?|[()+\-*/,])`;

/** px per unit, given the context; a bare number is a factor. */
const UNIT_PX: Readonly<Record<string, (context: LengthContext) => number>> = {
  '': () => 1,
  px: () => 1,
  rem: () => 16,
  vw: ({ viewport }) => viewport.width / 100,
  vh: ({ viewport }) => viewport.height / 100,
  svh: ({ viewport }) => viewport.height / 100,
  lvh: ({ viewport }) => viewport.height / 100,
  dvh: ({ viewport }) => viewport.height / 100,
  '%': ({ percentOf }) => percentOf / 100,
};

/** A length's tokens, left to right; anything else in it throws. */
function lengthTokens(value: string): string[] {
  const source = value.trim();
  const pattern = new RegExp(LENGTH_TOKEN, 'y');
  const tokens: string[] = [];
  while (pattern.lastIndex < source.length) {
    const match = pattern.exec(source);
    if (!match?.[1])
      throw new Error(`cannot read "${source.slice(pattern.lastIndex)}" in "${value}"`);
    tokens.push(match[1]);
  }
  return tokens;
}

/** Reads one length's tokens as calc() does: sums of products of factors. */
class LengthReader {
  private at = 0;
  private readonly tokens: readonly string[];
  private readonly value: string;
  private readonly context: LengthContext;

  constructor(value: string, context: LengthContext) {
    this.tokens = lengthTokens(value);
    this.value = value;
    this.context = context;
  }

  /** The whole length, in px. */
  read(): number {
    const result = this.sum();
    if (this.at !== this.tokens.length) throw this.error(`unexpected "${this.tokens[this.at]}"`);
    return result;
  }

  private error(problem: string): Error {
    return new Error(`${problem} in "${this.value}"`);
  }

  private peek(): string | undefined {
    return this.tokens[this.at];
  }

  private take(expected?: string): string {
    const token = this.tokens[this.at++];
    if (token === undefined || (expected !== undefined && token !== expected)) {
      throw this.error(`expected ${expected ?? 'more'} but read "${token}"`);
    }
    return token;
  }

  private sum(): number {
    let result = this.product();
    while (this.peek() === '+' || this.peek() === '-') {
      result = this.take() === '+' ? result + this.product() : result - this.product();
    }
    return result;
  }

  private product(): number {
    let result = this.factor();
    while (this.peek() === '*' || this.peek() === '/') {
      result = this.take() === '*' ? result * this.factor() : result / this.factor();
    }
    return result;
  }

  private factor(): number {
    const token = this.take();
    if (token === '-') return -this.factor();
    if (token.endsWith('(')) return this.call(token);
    const [, number, unit = ''] = /^(\d*\.?\d+)([a-z%]*)$/.exec(token) ?? [];
    const perUnit = UNIT_PX[unit];
    if (number === undefined || perUnit === undefined)
      throw this.error(`cannot resolve "${token}"`);
    return Number(number) * perUnit(this.context);
  }

  private call(opening: string): number {
    if (opening === 'var(') return this.customProperty();
    const values = this.args();
    const [first = Number.NaN, second = Number.NaN, third = Number.NaN] = values;
    switch (opening) {
      case '(':
      case 'calc(':
        return first;
      case 'min(':
        return Math.min(...values);
      case 'max(':
        return Math.max(...values);
      case 'clamp(':
        return Math.max(first, Math.min(second, third));
      default:
        throw this.error(`cannot resolve ${opening})`);
    }
  }

  private args(): number[] {
    const values = [this.sum()];
    while (this.peek() === ',') {
      this.take(',');
      values.push(this.sum());
    }
    this.take(')');
    return values;
  }

  private customProperty(): number {
    const name = this.take();
    let fallback: number | undefined;
    if (this.peek() === ',') {
      this.take(',');
      fallback = this.sum();
    }
    this.take(')');
    const own = this.context.vars[name];
    const resolved = own === undefined ? fallback : resolveLength(own, this.context);
    if (resolved === undefined) throw this.error(`${name} is not set`);
    return resolved;
  }
}

/**
 * A length as a browser lays it out, in px: px, rem, vw, vh (svh, lvh, dvh), % and bare factors,
 * combined with + - * / and calc(), min(), max(), clamp() and var(). Enough for the stylesheets'
 * geometry, so a test can check where something lands rather than how its value is spelled. An
 * unset custom property without a fallback throws, as the browser would drop the declaration.
 */
export function resolveLength(value: string, context: LengthContext): number {
  return new LengthReader(value, context).read();
}
