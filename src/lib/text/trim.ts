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
 * @file A set of characters trimmed off the ends of a string, by a loop. A '[…]+$' pattern
 * re-scans a long run from each of its starts, so its time grows with the square of the run, and
 * these trim text a visitor or a feed writes: a request path, a link, a description. Pure, with no
 * imports, so the proxy can use it too. Characters are UTF-16 code units, as String#charAt reads
 * them; every set here holds single code units.
 */

/** Punctuation that ends the sentence after an address rather than belonging to it. */
export const TRAILING_PUNCTUATION: ReadonlySet<string> = new Set([
  '.',
  ',',
  ';',
  ':',
  '!',
  '?',
  "'",
  '"',
]);

/** Punctuation that closes a sentence or a bracket around a link, never part of it. */
export const CLOSING_PUNCTUATION: ReadonlySet<string> = new Set([
  ')',
  ']',
  '}',
  '.',
  ',',
  ';',
  ':',
  '!',
  '?',
]);

export const SLASH: ReadonlySet<string> = new Set(['/']);

/** Where the run of `chars` that ends `text` starts; `text.length` when it ends in none. */
function trailingRunStart(text: string, chars: ReadonlySet<string>): number {
  let start = text.length;
  while (start > 0 && chars.has(text.charAt(start - 1))) start -= 1;
  return start;
}

/** `text` without the characters of `chars` at its end. */
export const trimEnd = (text: string, chars: ReadonlySet<string>): string =>
  text.slice(0, trailingRunStart(text, chars));

/** The run of `chars` that ends `text`: what {@link trimEnd} takes off. */
export const trailingRun = (text: string, chars: ReadonlySet<string>): string =>
  text.slice(trailingRunStart(text, chars));

/** `text` without the characters of `chars` at either end. */
export function trimEdges(text: string, chars: ReadonlySet<string>): string {
  let start = 0;
  let end = text.length;
  while (start < end && chars.has(text.charAt(start))) start += 1;
  while (end > start && chars.has(text.charAt(end - 1))) end -= 1;
  return text.slice(start, end);
}
