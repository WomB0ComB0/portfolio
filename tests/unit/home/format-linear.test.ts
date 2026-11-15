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
 * @file The home project tile's title split and one-line description read a project's text once
 * (src/app/_components/home/data/format.ts). The title's separator pattern retried from every
 * space of a run ('x ' + 20,000 spaces: 385 ms), and the sentence end re-tested its abbreviation
 * pattern over the whole line at every full stop ('a. ' repeated to 20,000 characters: 288 ms), on
 * every render of the home page. The patterns they replaced are kept here as the oracle: the new
 * code must give their answer for every input.
 */

import { describe, expect, it } from 'vitest';
import { firstSentence, splitTitle } from '@/app/_components/home/data/format';

// The oracle: splitTitle and firstSentence as they were.
const OLD_TITLE_SEPARATOR = /^(.+?)(?:\s+[-–—]\s+|:\s+)(.+)$/u;

function oldSplitTitle(full: string): { title: string; subtitle: string } {
  const text = full.trim();
  const match = OLD_TITLE_SEPARATOR.exec(text);
  const title = match?.[1]?.trim();
  const subtitle = match?.[2]?.trim();
  return title && subtitle ? { title, subtitle } : { title: text, subtitle: '' };
}

const OLD_SENTENCE_STOP = /[.!?]['")\]’”]*(?=\s|$)/gu;
const OLD_ENDS_IN_ABBREVIATION =
  /(?:^|[\s(["'‘“])(?:(?:\p{L}\.)+|vs\.|approx\.|incl\.|Inc\.|Dr\.|Mr\.|Ms\.|Mrs\.)$/u;

function oldFirstSentence(text: string): string {
  const line =
    text
      .split(/\r?\n/u)
      .map((part) => part.trim())
      .find(Boolean) ?? '';
  for (const stop of line.matchAll(OLD_SENTENCE_STOP)) {
    const throughStop = line.slice(0, stop.index + 1);
    if (stop[0].startsWith('.') && OLD_ENDS_IN_ABBREVIATION.test(throughStop)) continue;
    return line.slice(0, stop.index + stop[0].length);
  }
  return line;
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

// Spaces a pattern's \s reads, written by code point so they stay visible in this file.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
const NO_BREAK_SPACE = String.fromCharCode(0x00a0);
const IDEOGRAPHIC_SPACE = String.fromCharCode(0x3000);
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

const pick = <T>(random: () => number, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)] as T;

/** Text of up to `maxTokens` tokens drawn from `tokens`. */
function randomText(random: () => number, tokens: readonly string[], maxTokens: number): string {
  const count = Math.floor(random() * (maxTokens + 1));
  let text = '';
  for (let index = 0; index < count; index += 1) text += pick(random, tokens);
  return text;
}

/** Runs of one or two tokens with random text around and between them: the slow shapes. */
function adversarialText(random: () => number, tokens: readonly string[]): string {
  const run = (pick(random, tokens) + (random() < 0.5 ? pick(random, tokens) : '')).repeat(
    Math.floor(random() * 120),
  );
  const around = () => randomText(random, tokens, 4);
  return `${around()}${run}${around()}${random() < 0.3 ? run : ''}${around()}`;
}

/** Spaces of every kind (line ends included), the three dashes, the colon, and words. */
const TITLE_TOKENS = [
  ' ',
  ' ',
  '  ',
  '\t',
  '\n',
  '\r',
  '\r\n',
  LINE_SEPARATOR,
  PARAGRAPH_SEPARATOR,
  NO_BREAK_SPACE,
  IDEOGRAPHIC_SPACE,
  BYTE_ORDER_MARK,
  '-',
  '–',
  '—',
  ':',
  ' - ',
  ': ',
  'a',
  'Fraud',
  'B',
  '.',
  '/',
  '😀',
  '\ud800',
  '\udc00',
  '1',
];

/** Stops, closers, openers, letters (an astral one too), the short forms and line ends. */
const SENTENCE_TOKENS = [
  '.',
  '.',
  '!',
  '?',
  "'",
  '"',
  ')',
  ']',
  '’',
  '”',
  ' ',
  ' ',
  '\t',
  '\n',
  '\r',
  '\r\n',
  LINE_SEPARATOR,
  NO_BREAK_SPACE,
  '(',
  '[',
  '‘',
  '“',
  'a',
  'U',
  'S',
  'e',
  'g',
  'é',
  'Ω',
  '𝐀',
  '\ud835',
  '\udc00',
  '1',
  '-',
  'vs.',
  'approx.',
  'incl.',
  'Inc.',
  'Dr.',
  'Mr.',
  'Ms.',
  'Mrs.',
  'xvs.',
  'U.S.',
  'e.g. ',
  'Node.js',
];

const FUZZ_RANDOM = 100_000;
const FUZZ_ADVERSARIAL = 10_000;

/** The inputs on which `actual` and `expected` differ (the first ten), over the fuzz set. */
function differences<T>(
  seed: number,
  tokens: readonly string[],
  actual: (text: string) => T,
  expected: (text: string) => T,
): { readonly count: number; readonly found: readonly string[] } {
  const random = seeded(seed);
  const found: string[] = [];
  let count = 0;
  const check = (text: string): void => {
    count += 1;
    const got = JSON.stringify(actual(text));
    const want = JSON.stringify(expected(text));
    if (got !== want && found.length < 10) found.push(`${JSON.stringify(text)}: ${got} != ${want}`);
  };
  for (let index = 0; index < FUZZ_RANDOM; index += 1) check(randomText(random, tokens, 16));
  for (let index = 0; index < FUZZ_ADVERSARIAL; index += 1) check(adversarialText(random, tokens));
  return { count, found };
}

/** Milliseconds `run` takes. */
function timed(run: () => void): number {
  const started = performance.now();
  run();
  return performance.now() - started;
}

/** Far below the hundreds of milliseconds these inputs took; generous for a loaded runner. */
const FAST_MS = 50;

describe('splitTitle reads a title once', () => {
  it.each([
    ['a run of spaces with no dash after it', `x ${' '.repeat(20_000)}/`],
    ['a run of mixed spaces with a word after it', `x${` ${NO_BREAK_SPACE}\t`.repeat(7_000)}y`],
    ['colons before a line end', `x${': '.repeat(10_000)}\ny`],
    ['spaced dashes before a line end', `x${' - x'.repeat(10_000)}\ny`],
  ])('fast for %s', (_case, title) => {
    let parts = splitTitle('');
    const elapsed = timed(() => {
      parts = splitTitle(title);
    });

    expect(elapsed).toBeLessThan(FAST_MS);
    expect(parts).toEqual(oldSplitTitle(title));
  });

  it.each([
    ['Fraud Guard - AI-Powered Monitoring', 'Fraud Guard', 'AI-Powered Monitoring'],
    [`Fraud Guard ${NO_BREAK_SPACE}—${NO_BREAK_SPACE} Monitoring`, 'Fraud Guard', 'Monitoring'],
    ['Atlas: maps - and more', 'Atlas', 'maps - and more'],
    ['Atlas -\nmaps', 'Atlas', 'maps'],
    ['Atlas\n- maps', 'Atlas', 'maps'],
  ])('splits %j as before', (full, title, subtitle) => {
    expect(splitTitle(full)).toEqual({ title, subtitle });
  });

  it.each([
    ['a line end after the separator', 'Atlas: maps\nmore'],
    ['a line end before the separator', 'Atlas\nmore: maps'],
    ['a dash glued to a word', 'AI-Powered Guard'],
    ['a colon with no space after it', 'Standup at 10:30'],
  ])('keeps a title whole for %s, as before', (_case, full) => {
    expect(splitTitle(full)).toEqual({ title: full.trim(), subtitle: '' });
  });

  it('gives the old pattern’s answer for 110,000 random and adversarial titles', () => {
    const { count, found } = differences(1_114, TITLE_TOKENS, splitTitle, oldSplitTitle);

    expect(count).toBeGreaterThanOrEqual(100_000);
    expect(found).toEqual([]);
  });
});

describe('firstSentence reads a description once', () => {
  it.each([
    ['initials each ending a sentence', 'a. '.repeat(7_000)],
    ['U.S. repeated', 'U.S. '.repeat(8_000)],
    ['a run of initials before each stop', `${'b.'.repeat(5_000)} a. ${'xa. '.repeat(3_000)}`],
    ['short forms repeated', 'see vs. '.repeat(3_000)],
  ])('fast for %s', (_case, text) => {
    let sentence = '';
    const elapsed = timed(() => {
      sentence = firstSentence(text);
    });

    expect(elapsed).toBeLessThan(FAST_MS);
    expect(sentence).toBe(oldFirstSentence(text));
  });

  it.each([
    ['Built for the U.S. market. More.', 'Built for the U.S. market.'],
    ['Made by Dr. Who. More.', 'Made by Dr. Who.'],
    ['A 𝐀. B. C.', 'A 𝐀. B. C.'],
    ['Ends in xa. Then more.', 'Ends in xa.'],
    ['(e.g.) ships. More.', '(e.g.) ships.'],
    ['Mrs. Smith left. More.', 'Mrs. Smith left.'],
    ['It works vs. that. More.', 'It works vs. that.'],
    ['Avs. B. More.', 'Avs.'],
  ])('reads %j as before', (text, sentence) => {
    expect(firstSentence(text)).toBe(sentence);
  });

  it('gives the old pattern’s answer for 110,000 random and adversarial descriptions', () => {
    const { count, found } = differences(2_026, SENTENCE_TOKENS, firstSentence, oldFirstSentence);

    expect(count).toBeGreaterThanOrEqual(100_000);
    expect(found).toEqual([]);
  });
});
