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
 * @file A /media row's summary reads each description line once to find a link
 * (src/app/(routes)/(dev)/media/_lib/media-summary.ts). Security review F2: the short-link
 * pattern ('dsc.gg/…', 'bit.ly/…') scanned the rest of a letter-hyphen run from every word edge in
 * it, 30 to 34 ms for one capped description of 'a-' repeated, on every /media request. The old
 * function is kept here as the oracle: the new one must give its answer for every input.
 */

import { describe, expect, it } from 'vitest';
import { cleanSummary } from '@/app/(routes)/(dev)/media/_lib/media-summary';

// The oracle: cleanSummary as it was.
const SUMMARY_MAX = 160;
const SUMMARY_READ_MAX = 5_000;
const TEMPLATE_START = /^\p{Extended_Pictographic}/u;
const OLD_HAS_LINK = /\bhttps?:\/\/|\bwww\.|\b[a-z\d-]+\.(?:gg|ly|ee)\//i;
const FIRST_SENTENCE = /^.+?[.!?](?=\s|$)/;

function capAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const end = lastSpace > max / 2 ? lastSpace : max;
  return `${cut.slice(0, end).replace(/[\s,;:.\-–—]+$/, '')}…`;
}

function oldCleanSummary(text: string | null | undefined): string {
  if (!text) return '';
  const kept: string[] = [];
  for (const raw of text.slice(0, SUMMARY_READ_MAX).split(/\r?\n/)) {
    const line = raw.trim();
    if (TEMPLATE_START.test(line)) break;
    if (line !== '' && !OLD_HAS_LINK.test(line)) kept.push(line);
  }
  const prose = kept.join(' ').replaceAll(/\s+/g, ' ').trim();
  if (prose === '') return '';
  return capAtWord(FIRST_SENTENCE.exec(prose)?.[0] ?? prose, SUMMARY_MAX);
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

/** Pieces of links and near-links: label characters, word characters that are not, the hosts. */
const TOKENS = [
  'a',
  'Z',
  '0',
  '-',
  '-',
  '_',
  '.',
  '.',
  '/',
  'gg',
  'GG',
  'ly',
  'Ly',
  'ee',
  'eE',
  'g',
  'l',
  'y',
  'e',
  'http',
  'HTTPS',
  's',
  '://',
  ':/',
  'www',
  'WWW',
  ' ',
  ' ',
  '\t',
  String.fromCharCode(0x00a0),
  '@',
  'é',
  // Dotless i upper-cases to I and the Kelvin sign folds to k, yet neither matches an ASCII
  // letter in an 'i' pattern without the 'u' flag, which the link patterns are.
  String.fromCharCode(0x0131),
  String.fromCharCode(0x212a),
  '!',
  '?',
  'dsc.gg/',
  'x.ly/',
];

const pick = (random: () => number): string => TOKENS[Math.floor(random() * TOKENS.length)] ?? '';

/** One line of up to `maxTokens` tokens: the summary is '' exactly when it has a link. */
function randomLine(random: () => number, maxTokens: number): string {
  const count = 1 + Math.floor(random() * maxTokens);
  let line = '';
  for (let index = 0; index < count; index += 1) line += pick(random);
  return line;
}

/** A run of one or two tokens between random pieces: the shape that was slow. */
function adversarialLine(random: () => number): string {
  const run = (pick(random) + pick(random)).repeat(Math.floor(random() * 150));
  return `${randomLine(random, 3)}${run}${randomLine(random, 3)}`;
}

const FUZZ_RANDOM = 100_000;
const FUZZ_ADVERSARIAL = 10_000;

describe('cleanSummary reads each line once', () => {
  it('reads twenty capped descriptions of a letter-hyphen run fast', () => {
    const description = 'a-'.repeat(2_500);
    const started = performance.now();
    const summaries = Array.from({ length: 20 }, () => cleanSummary(description));
    const elapsed = performance.now() - started;

    // Twenty cost 600 to 700 ms before; generous for a loaded runner.
    expect(elapsed).toBeLessThan(50);
    expect(summaries[0]).toBe(oldCleanSummary(description));
  });

  it.each([
    ['a dsc.gg invite', 'Join at dsc.gg/abc\nA real sentence. More.', 'A real sentence.'],
    ['a bit.ly link in capitals', 'See BIT.LY/x\nA real sentence.', 'A real sentence.'],
    ['a www. address', 'Visit WWW.example.com now.\nThe talk.', 'The talk.'],
    ['an address after an @', 'Mail a@b.ee/ ok.\nThe talk.', 'The talk.'],
    ['a label after an underscore and a hyphen', 'Use _-x.ly/y today.\nThe talk.', 'The talk.'],
  ])('drops a line with %s', (_case, description, summary) => {
    expect(cleanSummary(description)).toBe(summary);
  });

  it.each([
    ['a label glued to an underscore', '_abc.gg/x is here.'],
    ['a host with no slash after it', 'It runs on fly.ee and more.'],
    ['a host that is not a short-link one', 'Read a.com/x today.'],
  ])('keeps a line with %s, as before', (_case, line) => {
    expect(cleanSummary(line)).toBe(line);
  });

  it('gives the old function’s answer for 110,000 random and adversarial descriptions', () => {
    const random = seeded(52_026);
    const found: string[] = [];
    let count = 0;
    const check = (text: string): void => {
      count += 1;
      const got = cleanSummary(text);
      const want = oldCleanSummary(text);
      if (got !== want && found.length < 10)
        found.push(`${JSON.stringify(text)}: ${got} != ${want}`);
    };
    for (let index = 0; index < FUZZ_RANDOM; index += 1) check(randomLine(random, 24));
    for (let index = 0; index < FUZZ_ADVERSARIAL; index += 1) check(adversarialLine(random));

    expect(count).toBeGreaterThanOrEqual(100_000);
    expect(found).toEqual([]);
  });
});
