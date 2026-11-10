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
 * @file Works out a CSS length expression in px for a given window, so a test can check what a
 * stylesheet's calc(), min(), max() and clamp() come to for a photo's ratio without a browser:
 * numbers with px, rem (16 px), vw, vh, dvh and % (of `percentOf`), the four operators,
 * parentheses and var() of the custom properties given. Not a test file; the formulas it reads
 * are the repository's own stylesheets.
 */

export interface CalcWindow {
  readonly vw: number;
  readonly vh: number;
  /** The custom properties var() may read, by name, as CSS text. */
  readonly vars?: Readonly<Record<string, string>>;
  /** What 100% is, in px. */
  readonly percentOf?: number;
}

const REM_PX = 16;
const TOKEN = /\s*(\d*\.?\d+(?:px|rem|vw|vh|dvh|%)?|--[\w-]+|[a-z]+\(|[-+*/(),])/y;

/** The tokens of `text`: numbers with units, custom property names, functions, operators. */
function tokenize(text: string): string[] {
  const pattern = new RegExp(TOKEN.source, 'y');
  const tokens: string[] = [];
  // A failed sticky match resets lastIndex, so the end of the last match is kept here.
  let end = 0;
  let match = pattern.exec(text);
  while (match) {
    tokens.push(match[1] ?? '');
    end = pattern.lastIndex;
    match = pattern.exec(text);
  }
  const unread = text.slice(end);
  if (tokens.length === 0 || unread.trim() !== '') {
    throw new Error(`unreadable CSS near "${unread}"`);
  }
  return tokens;
}

/** A number token in px. */
function lengthOf(token: string, window: CalcWindow): number {
  const value = Number.parseFloat(token);
  if (token.endsWith('rem')) return value * REM_PX;
  if (token.endsWith('vh')) return (value * window.vh) / 100;
  if (token.endsWith('vw')) return (value * window.vw) / 100;
  if (token.endsWith('%')) return (value * (window.percentOf ?? Number.NaN)) / 100;
  return value;
}

/**
 * The value of a CSS length expression in px (dvh is taken as vh).
 *
 * @example
 * evaluateCss('min(26rem, calc(100vw - 4rem))', { vw: 390, vh: 844 }) // 326
 */
export function evaluateCss(text: string, window: CalcWindow): number {
  const tokens = tokenize(text);
  let at = 0;
  const peek = (): string | undefined => tokens[at];
  const take = (expected?: string): string => {
    const token = tokens[at++];
    if (token === undefined || (expected !== undefined && token !== expected)) {
      throw new Error(`expected ${expected ?? 'more'} in "${text}"`);
    }
    return token;
  };

  /** The arguments of a function whose "name(" was just read, up to its ")". */
  const args = (): number[] => {
    const values = [sum()];
    while (peek() === ',') {
      take(',');
      values.push(sum());
    }
    take(')');
    return values;
  };

  /** A number, a parenthesised or function expression, or a negated one. */
  const factor = (): number => {
    const token = take();
    if (token === '-') return -factor();
    if (token === '(' || token === 'calc(') {
      const value = sum();
      take(')');
      return value;
    }
    if (token === 'min(') return Math.min(...args());
    if (token === 'max(') return Math.max(...args());
    if (token === 'clamp(') {
      const [low = 0, mid = 0, high = 0] = args();
      return Math.max(low, Math.min(mid, high));
    }
    if (token === 'var(') {
      const name = take();
      take(')');
      const value = window.vars?.[name];
      if (value === undefined) throw new Error(`no value for ${name}`);
      return evaluateCss(value, window);
    }
    return lengthOf(token, window);
  };

  /** Factors multiplied and divided. */
  const product = (): number => {
    let value = factor();
    while (peek() === '*' || peek() === '/') {
      value = take() === '*' ? value * factor() : value / factor();
    }
    return value;
  };

  /** Products added and subtracted. */
  function sum(): number {
    let value = product();
    while (peek() === '+' || peek() === '-') {
      value = take() === '+' ? value + product() : value - product();
    }
    return value;
  }

  const result = sum();
  if (at !== tokens.length) throw new Error(`unread CSS in "${text}"`);
  return result;
}
