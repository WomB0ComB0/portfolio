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
 * @file validateUserInput bounds its work by maxLength. The search islands sanitise ?q while the
 * server renders, so the input is whatever a requester puts in the URL. The tag-strip regex is
 * quadratic on a long run of unclosed '<', and it used to run over the whole input before the
 * final cut to maxLength: about 130 ms of server CPU for a 16 KB URL.
 */

import { describe, expect, it } from 'vitest';
import { validateUserInput } from '@/utils/security/xss';

const SEARCH_MAX_LENGTH = 100;
const ATTACK_LENGTH = 16_000;
/** What validateUserInput reads at its default maxLength (500): four times it. */
const DEFAULT_INPUT_BOUND = 2000;
/** Far above the bounded cost (well under 1 ms) and far below the unbounded one (30-130 ms). */
const FAST_ENOUGH_MS = 20;
const TIMING_RUNS = 3;

/** The function before the bound, as the reference for inputs a person would type. */
function unboundedReference(input: string, maxLength: number): string {
  let sanitized = input.trim();
  let previous: string;
  do {
    previous = sanitized;
    sanitized = sanitized.replaceAll(/<[^>]*>/g, '');
  } while (sanitized !== previous);
  sanitized = sanitized.replaceAll(/\s+/g, ' ');
  do {
    previous = sanitized;
    sanitized = sanitized.replaceAll(/javascript:|data:|vbscript:/gi, '');
  } while (sanitized !== previous);
  return sanitized.slice(0, maxLength);
}

/** The fastest of a few runs, so one garbage-collection pause can't fail the test. */
function fastestRunMs(run: () => void): number {
  let fastest = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < TIMING_RUNS; attempt += 1) {
    const start = performance.now();
    run();
    fastest = Math.min(fastest, performance.now() - start);
  }
  return fastest;
}

/** A small deterministic PRNG (mulberry32), so the generated inputs are the same on every run. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const PIECES = ['<', '>', '<b>', '</p>', 'a', 'Web', ' ', '\t', '\n', 'javascript:', 'data:', 'é'];

function randomInput(random: () => number, maxPieces: number): string {
  const count = Math.floor(random() * maxPieces);
  return Array.from({ length: count }, () => PIECES[Math.floor(random() * PIECES.length)]).join('');
}

describe('validateUserInput on oversized input', () => {
  it(`sanitises ${ATTACK_LENGTH} unclosed '<' in well under ${FAST_ENOUGH_MS} ms`, () => {
    const attack = '<'.repeat(ATTACK_LENGTH);
    let result = '';

    const elapsedMs = fastestRunMs(() => {
      result = validateUserInput(attack, SEARCH_MAX_LENGTH);
    });

    expect(elapsedMs).toBeLessThan(FAST_ENOUGH_MS);
    // Unclosed '<' is not a tag, so it survives, cut to maxLength as before.
    expect(result).toBe('<'.repeat(SEARCH_MAX_LENGTH));
  });

  it('is just as fast with the default maxLength', () => {
    const attack = `${'<'.repeat(ATTACK_LENGTH)}x`;

    expect(fastestRunMs(() => validateUserInput(attack))).toBeLessThan(FAST_ENOUGH_MS);
  });

  it('still strips a tag that straddles maxLength', () => {
    const input = `${'a'.repeat(95)}<b>${'c'.repeat(20)}</b>`;

    expect(validateUserInput(input, SEARCH_MAX_LENGTH)).toBe(`${'a'.repeat(95)}${'c'.repeat(5)}`);
  });

  it('still trims and collapses whitespace before cutting to maxLength', () => {
    const input = `   ${'word   '.repeat(40)}`;

    expect(validateUserInput(input, SEARCH_MAX_LENGTH)).toBe(
      unboundedReference(input, SEARCH_MAX_LENGTH),
    );
  });
});

describe('validateUserInput on input a person would type', () => {
  it('matches the unbounded version on every generated input', () => {
    const random = seededRandom(20_261_105);
    for (let index = 0; index < 500; index += 1) {
      const input = randomInput(random, 80);
      expect(validateUserInput(input, SEARCH_MAX_LENGTH), JSON.stringify(input)).toBe(
        unboundedReference(input, SEARCH_MAX_LENGTH),
      );
    }
  });

  it.each([
    ['<p>Hello!</p>', 50, 'Hello!'],
    ['  two   words  ', 500, 'two words'],
    ['<script>alert(1)</script>javascript:go', 500, 'alert(1)go'],
    ['DATA:text/html', 500, 'text/html'],
    ['<b>bold</b> and <i>italic</i>', 500, 'bold and italic'],
    ['', 100, ''],
  ])('sanitises %j (maxLength %i) to %j', (input, maxLength, expected) => {
    expect(validateUserInput(input, maxLength)).toBe(expected);
  });

  it('keeps tags when HTML is allowed', () => {
    expect(validateUserInput('<b>bold</b>', 100, true)).toBe('<b>bold</b>');
  });
});

describe('validateUserInput on nested script schemes', () => {
  it.each([
    ['javajavascript:script:hello', 'hello'],
    ['javadata:script:hi', 'hi'],
    ['JavaJAVASCRIPT:Script:go', 'go'],
    ['vbsvbscript:cript:x', 'x'],
    ['dadata:ta:text/html', 'text/html'],
  ])('removes the scheme a removal leaves behind in %j', (input, expected) => {
    expect(validateUserInput(input, 280)).toBe(expected);
  });

  // Each layer adds the scheme's length, so data: (5 characters) nests deepest: about 400 layers,
  // one pass of the removal loop each, fit under the default bound.
  it.each([
    ['javascript:', 'java', 'script:'],
    ['data:', 'da', 'ta:'],
  ])('stays fast on %s nested as deep as the default bound lets through', (scheme, head, tail) => {
    const depth = Math.floor((DEFAULT_INPUT_BOUND - scheme.length - 1) / scheme.length);
    const attack = `${head.repeat(depth)}${scheme}${tail.repeat(depth)}x`;

    expect(attack.length).toBeLessThanOrEqual(DEFAULT_INPUT_BOUND);
    expect(attack.length + scheme.length).toBeGreaterThan(DEFAULT_INPUT_BOUND);
    expect(validateUserInput(attack)).toBe('x');
    expect(fastestRunMs(() => validateUserInput(attack))).toBeLessThan(FAST_ENOUGH_MS);
  });
});
