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
 * @file WCAG 2.5.3 (Label in Name) on rendered components, under jsdom: a link or button's
 * accessible name holds the words it shows, side by side and in order, and should start with
 * them. Words compare as the Understanding document and axe's label-content-name-mismatch compare
 * them: case, punctuation and symbols do not count (a range's dash or a middle dot is no word),
 * so 'May 19 – 20, 2026' is in 'May 19 – 20, 2026, photo 1 of 5' but not in 'May 19 to 20, 2026'.
 * Not a test file.
 *
 * @example
 * expectLabelInName(screen.getByRole('link', { name: /^Antler NYC/ }));
 */

import axe from 'axe-core';

/**
 * Text the eye never sees: words only a screen reader hears (Tailwind's sr-only, which jsdom does
 * not apply) and elements with no box. aria-hidden text is seen, so it counts.
 */
const UNSEEN = '.sr-only, [hidden], template, script, style';

/**
 * The words an element shows, as one line: its text nodes in order, less those inside an UNSEEN
 * element, joined as they are (as axe joins them) with runs of whitespace made one space.
 *
 * @example
 * // <a>May 19<span aria-hidden="true"> – </span><span class="sr-only"> to </span>20</a>
 * shownText(link) // 'May 19 – 20'
 */
export function shownText(element: Element): string {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest(UNSEEN)) parts.push(node.nodeValue ?? '');
  }
  return parts.join('').replaceAll(/\s+/g, ' ').trim();
}

/**
 * A text's words as WCAG 2.5.3 compares them: accents and case dropped, anything but a letter or
 * a digit a break between words.
 *
 * @example
 * wordsOf('Jun – Sep 2025, image 1 of 1') // ['jun', 'sep', '2025', 'image', '1', 'of', '1']
 */
export const wordsOf = (text: string): readonly string[] =>
  text
    .normalize('NFKD')
    .replaceAll(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '');

/** Where `shown`'s words sit in `name`'s, side by side and in order; -1 when they do not. */
function wordsAt(name: string, shown: string): number {
  const said = wordsOf(name);
  const seen = wordsOf(shown);
  if (seen.length === 0) return 0;
  for (let at = 0; at + seen.length <= said.length; at++) {
    if (seen.every((word, index) => said[at + index] === word)) return at;
  }
  return -1;
}

/** Whether `name` holds the words of `shown`, side by side and in order (WCAG 2.5.3's must). */
export const containsShownWords = (name: string, shown: string): boolean =>
  wordsAt(name, shown) !== -1;

/** Whether `name` starts with the words of `shown` (WCAG 2.5.3's best practice). */
export const startsWithShownWords = (name: string, shown: string): boolean =>
  wordsAt(name, shown) === 0;

/**
 * An element's accessible name as axe computes it, the computation its WCAG 2.5.3 rule (and the
 * browser spec's) compares with what the element shows.
 */
export function accessibleNameOf(element: Element): string {
  axe.setup(element.ownerDocument);
  try {
    return axe.commons.text.accessibleText(element);
  } finally {
    axe.teardown();
  }
}

export interface LabelInNameOptions {
  /**
   * Whether the name must start with the words shown (the default), or only hold them: for a
   * button whose only words are a hint after its name, such as a keyboard shortcut.
   */
  readonly start?: boolean;
}

/**
 * Fails unless the element shows some words and its accessible name starts with them (or, with
 * `start: false`, holds them), saying the name and the words in the message.
 */
export function expectLabelInName(
  element: Element,
  { start = true }: LabelInNameOptions = {},
): void {
  const name = accessibleNameOf(element);
  const shown = shownText(element);
  if (shown === '') throw new Error(`"${name}" shows no words to hold: nothing to check`);
  const holds = start ? startsWithShownWords(name, shown) : containsShownWords(name, shown);
  if (!holds) {
    throw new Error(
      `The name "${name}" does not ${start ? 'start with' : 'hold'} the words shown, "${shown}" ` +
        '(WCAG 2.5.3, Label in Name)',
    );
  }
}
