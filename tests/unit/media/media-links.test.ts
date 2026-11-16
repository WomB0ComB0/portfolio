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
 * @file The links /media reads out of a description or an excerpt (src/app/(routes)/(dev)/media/
 * _lib/media-links.ts) and the keys it makes of them. A description written as one link with a
 * long run of closing punctuation or slashes used to cost time that grew with the square of the
 * run (each '+$' trim re-scanned it from every start), on every page that builds the feed. The
 * trims are loops now, and only the first 5,000 characters of a text are read for links.
 */

import { describe, expect, it } from 'vitest';
import {
  DESCRIPTION_LINK_MAX,
  LINK_TEXT_MAX,
  linksIn,
  urlKey,
} from '@/app/(routes)/(dev)/media/_lib/media-links';

const RUN = 100_000;
/** Far below the five to six seconds a 100,000-character run took; generous for a loaded runner. */
const FAST_MS = 250;

const timed = (run: () => void): number => {
  const start = performance.now();
  run();
  return performance.now() - start;
};

describe('linksIn on ordinary text', () => {
  it('reads every link in order, closing punctuation trimmed', () => {
    expect(
      linksIn(
        'Code (https://github.com/a/b). Slides: https://x.dev/talk/?q=1#t, end. https://y.io!?',
      ),
    ).toEqual(['https://github.com/a/b', 'https://x.dev/talk/?q=1#t', 'https://y.io']);
  });

  it('keeps a trailing slash and what is not closing punctuation', () => {
    expect(linksIn('https://x.dev/a/ and https://x.dev/b-_~')).toEqual([
      'https://x.dev/a/',
      'https://x.dev/b-_~',
    ]);
  });

  it('reads nothing from no text, and at most 50 links', () => {
    expect(linksIn(null)).toEqual([]);
    expect(linksIn(undefined)).toEqual([]);
    const many = Array.from({ length: 60 }, (_, n) => `https://x.dev/${n}`).join(' ');
    expect(linksIn(many)).toHaveLength(DESCRIPTION_LINK_MAX);
  });

  it('reads links from the first 5,000 characters only', () => {
    expect(LINK_TEXT_MAX).toBe(5_000);
    const early = 'https://early.dev/a ';
    const text = `${early}${'x'.repeat(LINK_TEXT_MAX - early.length)} https://late.dev/b`;
    expect(linksIn(text)).toEqual(['https://early.dev/a']);
  });
});

describe('urlKey', () => {
  it('keys an address by host without www and path without trailing slashes', () => {
    expect(urlKey('https://www.Example.org/a/b///?q=1#x')).toBe('url:example.org/a/b');
    expect(urlKey('https://x.dev')).toBe('url:x.dev');
    expect(urlKey('https://x.dev///')).toBe('url:x.dev');
    expect(urlKey('  http://x.dev/a  ')).toBe('url:x.dev/a');
  });

  it('keys nothing that is not an http(s) address', () => {
    expect(urlKey('javascript:alert(1)')).toBeNull();
    expect(urlKey('not a url')).toBeNull();
  });
});

describe('a 100,000-character run', () => {
  it.each([
    ['full stops', `https://x.dev/${'.'.repeat(RUN)}a`],
    ['closing brackets', `https://x.dev/${')'.repeat(RUN)}a`],
    ['mixed closers', `https://x.dev/${').]},;:!?'.repeat(RUN / 10)}a`],
  ])('in a link of %s is read fast', (_case, text) => {
    let links: string[] = [];
    const elapsed = timed(() => {
      links = linksIn(text);
    });

    expect(elapsed).toBeLessThan(FAST_MS);
    // Only the first 5,000 characters are read: the address and closers, which are trimmed.
    expect(links).toEqual(['https://x.dev/']);
  });

  it('in each of 200 descriptions at the 5,000-character cap is read fast', () => {
    // The channel cap of uploads, each description as long as the schema allows (5,000), one
    // link each: about 4.5 s in all while the trim was a '+$' pattern.
    const descriptions = Array.from(
      { length: 200 },
      (_, n) => `https://x.dev/${n}${'.'.repeat(5_000 - 20)}a`,
    );
    let links: string[][] = [];
    const elapsed = timed(() => {
      links = descriptions.map((text) => linksIn(text));
    });

    expect(elapsed).toBeLessThan(FAST_MS);
    expect(links.map((found) => found.length)).toEqual(descriptions.map(() => 1));
    expect(links[7]?.[0]).toBe(descriptions[7]);
  });

  it('of closers at the end of a link is trimmed fast', () => {
    const text = `see https://x.dev/a${')'.repeat(RUN)}`;
    let links: string[] = [];
    const elapsed = timed(() => {
      links = linksIn(text);
    });

    expect(elapsed).toBeLessThan(FAST_MS);
    expect(links).toEqual(['https://x.dev/a']);
  });

  it('of slashes inside or at the end of a path is keyed fast', () => {
    let keys: (string | null)[] = [];
    const elapsed = timed(() => {
      keys = [
        urlKey(`https://x.dev/a${'/'.repeat(RUN)}b`),
        urlKey(`https://x.dev/a${'/'.repeat(RUN)}`),
      ];
    });

    expect(elapsed).toBeLessThan(FAST_MS);
    expect(keys).toEqual([`url:x.dev/a${'/'.repeat(RUN)}b`, 'url:x.dev/a']);
  });
});
