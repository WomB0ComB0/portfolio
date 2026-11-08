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
 * @file The guestbook's text check runs twice on every post: in the compose box, which shows and
 * sends what it would post, then on the server, over what the box sent. So a checked message or
 * author name must come out unchanged when it is checked again; otherwise the box promises one
 * text and the server stores another, or refuses it. Script schemes nested inside each other
 * (`javajavascript:script:`) were the case that broke this.
 */

import { describe, expect, it } from 'vitest';
import { checkAuthorName, checkMessageText } from '@/lib/guestbook/text';

/** Pieces that can nest a scheme inside another, or leave spaces and tags behind when removed. */
const PIECES = [
  'java',
  'script:',
  'javascript:',
  'data:',
  'vb',
  'vbscript:',
  '<b>',
  '<',
  '>',
  ' ',
  'x',
];
const MAX_PIECES = 4;

/** Every string of 1 to `maxPieces` pieces, in order. */
function joinings(pieces: readonly string[], maxPieces: number): string[] {
  let level = [''];
  const all: string[] = [];
  for (let size = 1; size <= maxPieces; size += 1) {
    level = level.flatMap((start) => pieces.map((piece) => `${start}${piece}`));
    all.push(...level);
  }
  return all;
}

describe('checkMessageText', () => {
  it.each([
    ['javajavascript:script:hello', 'hello'],
    ['javadata:script:hi', 'hi'],
    ['javajavajavascript:script:script:deep', 'deep'],
    ['vbsvbscript:cript:x', 'x'],
    ['Hi <b>x</b> javascript: there', 'Hi x there'],
  ])('checks %j to %j, which a second check leaves as it is', (typed, expected) => {
    const first = checkMessageText(typed);

    expect(first).toEqual({ ok: true, text: expected, changed: true });
    expect(checkMessageText(expected)).toEqual({ ok: true, text: expected, changed: false });
  });

  it('refuses a draft that is only nested schemes, as the server would', () => {
    expect(checkMessageText('javajavascript:script:')).toEqual({ ok: false, problem: 'only-tags' });
  });

  it(`leaves every checked text unchanged on a second check (all joinings of ${MAX_PIECES} pieces)`, () => {
    const unstable = joinings(PIECES, MAX_PIECES).filter((typed) => {
      const first = checkMessageText(typed);
      if (!first.ok) return false;
      const second = checkMessageText(first.text);
      return !second.ok || second.text !== first.text || second.changed;
    });

    expect(unstable).toEqual([]);
  });
});

describe('checkAuthorName', () => {
  it.each([
    ['javajavascript:script:Bob', 'Bob'],
    ['javajavascript:script:', 'Anonymous'],
    [`${'a'.repeat(75)} javajavascript:script:Bob`, `${'a'.repeat(75)} Bob`],
  ])('checks %j to %j, which a second check leaves as it is', (name, expected) => {
    expect(checkAuthorName(name)).toBe(expected);
    expect(checkAuthorName(expected)).toBe(expected);
  });

  it(`leaves every checked name unchanged on a second check (all joinings of ${MAX_PIECES} pieces)`, () => {
    const unstable = joinings(PIECES, MAX_PIECES).filter((name) => {
      const first = checkAuthorName(name);
      return checkAuthorName(first) !== first;
    });

    expect(unstable).toEqual([]);
  });
});
