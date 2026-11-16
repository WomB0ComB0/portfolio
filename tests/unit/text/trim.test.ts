// @vitest-environment node
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
 * @file The shared trim helpers (src/lib/text/trim.ts). Reference versions of each trim, as plain
 * loops and as the '[…]+$' patterns they stand in for (the proxy's canonical path used /\/+$/),
 * are kept here as the oracle: the shared helpers must give the same answer for every input, and
 * stay fast on a long run.
 */

import { describe, expect, it } from 'vitest';
import {
  CLOSING_PUNCTUATION,
  SLASH,
  TRAILING_PUNCTUATION,
  trailingRun,
  trimEdges,
  trimEnd,
} from '@/lib/text/trim';

// The reference versions, as plain loops.
const OLD_TRAILING_PUNCTUATION: ReadonlySet<string> = new Set([
  '.',
  ',',
  ';',
  ':',
  '!',
  '?',
  "'",
  '"',
]);
const OLD_CLOSING_PUNCTUATION: ReadonlySet<string> = new Set([
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

/** text-links.ts and media-links.ts. */
function oldTrimEnd(text: string, trailing: ReadonlySet<string>): string {
  let end = text.length;
  while (end > 0 && trailing.has(text.charAt(end - 1))) end -= 1;
  return text.slice(0, end);
}

/** role-text.ts. */
const oldEndOf = (address: string): string => {
  let start = address.length;
  while (start > 0 && OLD_TRAILING_PUNCTUATION.has(address.charAt(start - 1))) start -= 1;
  return address.slice(start);
};

/** video-id.ts. */
function oldWithoutClosingPunctuation(link: string): string {
  let end = link.length;
  while (end > 0 && OLD_CLOSING_PUNCTUATION.has(link.charAt(end - 1))) end -= 1;
  return link.slice(0, end);
}

/** blogs.ts and blog-merge.ts. */
function oldWithoutEdgeSlashes(path: string): string {
  let start = 0;
  let end = path.length;
  while (start < end && path.charAt(start) === '/') start += 1;
  while (end > start && path.charAt(end - 1) === '/') end -= 1;
  return path.slice(start, end);
}

/** proxy.ts. */
function oldCanonicalPath(pathname: string): string {
  let end = pathname.length;
  while (end > 0 && pathname.charAt(end - 1) === '/') end -= 1;
  return end === 0 ? '/' : pathname.slice(0, end);
}

/** A seeded generator (mulberry32), so a failure can be replayed. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Every member of both sets, the slash, and characters near them. */
const ALPHABET = [
  ...'.,;:!?\'")]}/([{a Z0-_\n\t',
  String.fromCharCode(0x00a0),
  '’',
  '”',
  '😀',
  '\ud800',
  '\udc00',
];

function randomText(random: () => number, maxLength: number): string {
  const length = Math.floor(random() * (maxLength + 1));
  let text = '';
  for (let index = 0; index < length; index += 1) {
    text += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return text;
}

/** Long runs of one member, between and around other text: the shape the loop exists for. */
function adversarialText(random: () => number): string {
  const run = ALPHABET[Math.floor(random() * ALPHABET.length)] ?? '.';
  const parts = [
    randomText(random, 4),
    run.repeat(Math.floor(random() * 300)),
    randomText(random, 4),
  ];
  return random() < 0.5 ? parts.join('') : `${parts[1]}${parts[0]}${parts[1]}`;
}

const FUZZ_RANDOM = 100_000;
const FUZZ_ADVERSARIAL = 5_000;

describe('the shared character sets', () => {
  it('are the sets each module defined', () => {
    expect([...TRAILING_PUNCTUATION].sort()).toEqual([...OLD_TRAILING_PUNCTUATION].sort());
    expect([...CLOSING_PUNCTUATION].sort()).toEqual([...OLD_CLOSING_PUNCTUATION].sort());
    expect([...SLASH]).toEqual(['/']);
  });
});

describe('trimEnd, trailingRun and trimEdges', () => {
  it.each([
    ['https://a.b/c).', CLOSING_PUNCTUATION, 'https://a.b/c', ').'],
    ['https://a.b/c".', TRAILING_PUNCTUATION, 'https://a.b/c', '".'],
    ['https://a.b/c)', TRAILING_PUNCTUATION, 'https://a.b/c)', ''],
    ['/media///', SLASH, '/media', '///'],
    ['///', SLASH, '', '///'],
    ['', SLASH, '', ''],
  ])('trims %j by its set', (text, chars, trimmed, run) => {
    expect(trimEnd(text, chars)).toBe(trimmed);
    expect(trailingRun(text, chars)).toBe(run);
  });

  it('trims both edges', () => {
    expect(trimEdges('//post/slug//', SLASH)).toBe('post/slug');
    expect(trimEdges('/a//b/', SLASH)).toBe('a//b');
    expect(trimEdges('////', SLASH)).toBe('');
    expect(trimEdges('', SLASH)).toBe('');
  });

  it('gives what every old copy and the patterns gave, on random and adversarial text', () => {
    const random = seeded(20_261_114);
    const inputs = [
      ...Array.from({ length: FUZZ_RANDOM }, () => randomText(random, 24)),
      ...Array.from({ length: FUZZ_ADVERSARIAL }, () => adversarialText(random)),
    ];
    const differences: string[] = [];
    const compare = (name: string, text: string, got: string, want: string): void => {
      if (got !== want && differences.length < 10)
        differences.push(`${name} ${JSON.stringify(text)}`);
    };

    for (const text of inputs) {
      const sentenceTrimmed = trimEnd(text, TRAILING_PUNCTUATION);
      compare('trailing', text, sentenceTrimmed, oldTrimEnd(text, OLD_TRAILING_PUNCTUATION));
      compare('trailing re', text, sentenceTrimmed, text.replace(/[.,;:!?'"]+$/u, ''));
      compare('endOf', text, trailingRun(text, TRAILING_PUNCTUATION), oldEndOf(text));

      const closingTrimmed = trimEnd(text, CLOSING_PUNCTUATION);
      compare('closing', text, closingTrimmed, oldWithoutClosingPunctuation(text));
      compare('closing media', text, closingTrimmed, oldTrimEnd(text, OLD_CLOSING_PUNCTUATION));
      compare('closing re', text, closingTrimmed, text.replace(/[)\]}.,;:!?]+$/u, ''));

      compare('slash', text, trimEnd(text, SLASH), oldTrimEnd(text, new Set(['/'])));
      compare('canonical', text, trimEnd(text, SLASH) || '/', oldCanonicalPath(text));
      compare('edges', text, trimEdges(text, SLASH), oldWithoutEdgeSlashes(text));
      compare('edges re', text, trimEdges(text, SLASH), text.replace(/^\/+|\/+$/gu, ''));
    }

    expect(inputs.length).toBeGreaterThanOrEqual(100_000);
    expect(differences).toEqual([]);
  });

  // One 100,000-character check for every helper.
  it('reads a run of 100,000 inside the text and at its end fast', () => {
    const started = performance.now();
    for (const [run, chars] of [
      ['.', TRAILING_PUNCTUATION],
      [')', CLOSING_PUNCTUATION],
      ['/', SLASH],
    ] as const) {
      const long = run.repeat(100_000);
      expect(trimEnd(`a${long}b`, chars)).toBe(`a${long}b`);
      expect(trimEnd(`a${long}`, chars)).toBe('a');
      expect(trailingRun(`a${long}`, chars)).toBe(long);
      expect(trimEdges(`${long}a${long}b${long}`, chars)).toBe(`a${long}b`);
    }
    expect(performance.now() - started).toBeLessThan(50);
  });
});
