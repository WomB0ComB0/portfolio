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
 * @file Studio descriptions carry raw links in brackets ("the blog (https://blog.curvance.com)").
 * The detail page shows them as links named by their address without the scheme; only http and
 * https become links, and the brackets and a sentence's last full stop stay text.
 */

import { describe, expect, it } from 'vitest';

import { roleLinksOf } from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-links';
import { splitLinks } from '@/app/(routes)/(main)/(professioal)/experience/_lib/text-links';

describe('splitLinks', () => {
  it('turns a bracketed address into a link, keeping the brackets as text', () => {
    expect(splitLinks('Built the blog (https://blog.curvance.com) from scratch.')).toEqual([
      { kind: 'text', text: 'Built the blog (' },
      { kind: 'link', href: 'https://blog.curvance.com', label: 'blog.curvance.com' },
      { kind: 'text', text: ') from scratch.' },
    ]);
  });

  it('keeps a full stop or comma after an address out of it', () => {
    expect(splitLinks('See https://www.example.org/path/. Then, http://a.io, too')).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'link', href: 'https://www.example.org/path/', label: 'example.org/path' },
      { kind: 'text', text: '. Then, ' },
      { kind: 'link', href: 'http://a.io', label: 'a.io' },
      { kind: 'text', text: ', too' },
    ]);
  });

  it('keeps a bracketed part inside an address whole, and stops at the bracket that closes the text', () => {
    expect(
      splitLinks('the planet (https://en.wikipedia.org/wiki/Mercury_(planet)) and more'),
    ).toEqual([
      { kind: 'text', text: 'the planet (' },
      {
        kind: 'link',
        href: 'https://en.wikipedia.org/wiki/Mercury_(planet)',
        label: 'en.wikipedia.org/wiki/Mercury_(planet)',
      },
      { kind: 'text', text: ') and more' },
    ]);
    // An unbalanced closing bracket is the text's, even with no space before it.
    expect(splitLinks('(see https://a.io/x)').map((part) => part.kind)).toEqual([
      'text',
      'link',
      'text',
    ]);
  });

  it('leaves text without an http address alone', () => {
    expect(splitLinks('Ran javascript:alert(1) and ftp://files')).toEqual([
      { kind: 'text', text: 'Ran javascript:alert(1) and ftp://files' },
    ]);
    expect(splitLinks('')).toEqual([]);
  });

  it('drops a run of closing punctuation and the slashes that end a label', () => {
    expect(splitLinks('Read https://x.dev/a/b//?!... then more')).toEqual([
      { kind: 'text', text: 'Read ' },
      { kind: 'link', href: 'https://x.dev/a/b//', label: 'x.dev/a/b' },
      { kind: 'text', text: '?!... then more' },
    ]);
    expect(splitLinks('"https://a.io/x"')).toEqual([
      { kind: 'text', text: '"' },
      { kind: 'link', href: 'https://a.io/x', label: 'a.io/x' },
      { kind: 'text', text: '"' },
    ]);
  });
});

/**
 * One Studio description written as a single link with a 100,000-character run cost about ten
 * seconds per /experience render while the trims were patterns ending in '+$' (each start in the
 * run re-scanned it). They are loops now, so the time grows with the text, not its square.
 */
describe('a 100,000-character run inside a link', () => {
  const RUN = 100_000;
  /** Far below the ten seconds the pattern trims took; generous for a loaded runner. */
  const FAST_MS = 250;

  const timed = (run: () => void): number => {
    const start = performance.now();
    run();
    return performance.now() - start;
  };

  const dots = '.'.repeat(RUN);
  const slashes = '/'.repeat(RUN);

  // Only a sentence's last full stops leave the address; trailing slashes leave only the label.
  it.each([
    ['full stops', `https://x.dev/${dots}a`, `https://x.dev/${dots}a`, `x.dev/${dots}a`],
    ['slashes', `https://x.dev/${slashes}a`, `https://x.dev/${slashes}a`, `x.dev/${slashes}a`],
    ['full stops at the end', `https://x.dev/a${dots}`, 'https://x.dev/a', 'x.dev/a'],
    ['slashes at the end', `https://x.dev/a${slashes}`, `https://x.dev/a${slashes}`, 'x.dev/a'],
  ])('splits a link holding %s fast, and keeps the address', (_case, text, href, label) => {
    let parts: ReturnType<typeof splitLinks> = [];
    const elapsed = timed(() => {
      parts = splitLinks(text);
    });

    expect(elapsed).toBeLessThan(FAST_MS);
    expect(parts[0]).toEqual({ kind: 'link', href, label });
  });

  it("reads a role's links from such a description fast", () => {
    const description = `The blog https://x.dev/${'.'.repeat(RUN)}a and more.`;
    let links: ReturnType<typeof roleLinksOf> = [];
    const elapsed = timed(() => {
      links = roleLinksOf([description, `Duty https://y.dev/${'/'.repeat(RUN)}b`]);
    });

    expect(elapsed).toBeLessThan(FAST_MS);
    expect(links).toHaveLength(2);
  });
});
