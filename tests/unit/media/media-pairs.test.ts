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
 * @file The hand-written map of pairs (media-pairs.ts): every rule must be something the page can
 * read (an http(s) address for the written piece, a YouTube link or id for the video), and no
 * piece may be promised to two partners.
 */

import { describe, expect, it } from 'vitest';
import { ruleKeys } from '@/app/(routes)/(dev)/media/_lib/media-pairing';
import { MEDIA_NOT_PAIRS, MEDIA_PAIRS } from '@/app/(routes)/(dev)/media/_lib/media-pairs';

describe('the pairs map', () => {
  it.each([
    ['MEDIA_PAIRS', MEDIA_PAIRS],
    ['MEDIA_NOT_PAIRS', MEDIA_NOT_PAIRS],
  ])('%s holds only rules the page can read', (_name, rules) => {
    for (const rule of rules) {
      expect(rule.written).toMatch(/^https?:\/\/\S+$/);
      expect(ruleKeys(rule)).not.toBeNull();
    }
  });

  it('names no piece twice in MEDIA_PAIRS', () => {
    const keys = MEDIA_PAIRS.map(ruleKeys).filter((each) => each !== null);
    const written = keys.map((each) => each.written);
    const filmed = keys.map((each) => each.video);

    expect(new Set(written).size).toBe(written.length);
    expect(new Set(filmed).size).toBe(filmed.length);
  });

  it('reads a rule as the keys the feed pairs by, or null when it cannot', () => {
    expect(
      ruleKeys({
        written: 'https://www.blog.example.dev/a-post/?ref=x',
        video: 'https://youtu.be/DOtNqJyanOA?si=1',
      }),
    ).toEqual({ written: 'url:blog.example.dev/a-post', video: 'yt:DOtNqJyanOA' });
    expect(ruleKeys({ written: 'https://blog.example.dev/a', video: 'DOtNqJyanOA' })?.video).toBe(
      'yt:DOtNqJyanOA',
    );
    expect(ruleKeys({ written: 'a-post', video: 'DOtNqJyanOA' })).toBeNull();
    expect(ruleKeys({ written: 'https://blog.example.dev/a', video: 'too-short' })).toBeNull();
    expect(ruleKeys({ written: 'ftp://blog.example.dev/a', video: 'DOtNqJyanOA' })).toBeNull();
  });
});
