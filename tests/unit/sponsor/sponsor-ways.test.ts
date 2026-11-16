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
 * @file The ways to sponsor, as /sponsor lists them: GitHub Sponsors always first, a way with no
 * usable link left out, and each link opening where it should. A web link opens a new tab; a
 * mailto: or an internal link stays in this one (the old contact card opened mail in a new tab).
 */

import { describe, expect, it } from 'vitest';

import {
  anchorAttrs,
  linkTargetOf,
  PRIMARY_WAY_ID,
  SPONSOR_WAYS,
  type SponsorWaySource,
  shapeWays,
} from '@/app/(routes)/(dev)/sponsor/_lib/ways';

const way = (overrides: Partial<SponsorWaySource> & Pick<SponsorWaySource, 'id'>) =>
  ({
    name: overrides.id,
    url: `https://example.com/${overrides.id}`,
    purpose: 'A line on what it is for.',
    ...overrides,
  }) satisfies SponsorWaySource;

describe('linkTargetOf', () => {
  it('keeps a mailto: link in this tab', () => {
    expect(linkTargetOf('mailto:hello@example.com')).toEqual({
      href: 'mailto:hello@example.com',
      newTab: false,
    });
  });

  it('reads the scheme without regard to case, and keeps tel: in this tab too', () => {
    expect(linkTargetOf('MAILTO:hello@example.com')?.newTab).toBe(false);
    expect(linkTargetOf('tel:+12015550123')?.newTab).toBe(false);
  });

  it('opens a web link in a new tab, trimmed', () => {
    expect(linkTargetOf('  https://ko-fi.com/someone ')).toEqual({
      href: 'https://ko-fi.com/someone',
      newTab: true,
    });
    expect(linkTargetOf('http://example.com')?.newTab).toBe(true);
  });

  it('keeps an internal path in this tab', () => {
    expect(linkTargetOf('/sponsor')).toEqual({ href: '/sponsor', newTab: false });
    expect(linkTargetOf('/')).toEqual({ href: '/', newTab: false });
    expect(linkTargetOf('/guestbook?from=sponsor#top')).toEqual({
      href: '/guestbook?from=sponsor#top',
      newTab: false,
    });
  });

  // A browser reads a backslash as a slash and drops tabs and newlines from a URL, so each of
  // these opens https://evil.example/ while starting with one slash.
  it.each([
    '/\\evil.example',
    '/\\/evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    '/\r\\evil.example',
    '  /\\evil.example',
  ])('links nothing for %j, which a browser opens as another site', (href) => {
    expect(linkTargetOf(href)).toBeNull();
  });

  it('links nothing for a path with a control character anywhere in it', () => {
    expect(linkTargetOf('/spon\tsor')).toBeNull();
    expect(linkTargetOf('/sponsor\u0000')).toBeNull();
  });

  it('links nothing for a blank, bare-hash, script or protocol-relative href', () => {
    expect(linkTargetOf(undefined)).toBeNull();
    expect(linkTargetOf('   ')).toBeNull();
    expect(linkTargetOf('#')).toBeNull();
    expect(linkTargetOf('javascript:alert(1)')).toBeNull();
    expect(linkTargetOf('//evil.example')).toBeNull();
  });
});

describe('anchorAttrs', () => {
  it('gives a new-tab link target and rel, so the opened page cannot reach back', () => {
    expect(anchorAttrs({ href: 'https://example.com', newTab: true })).toEqual({
      href: 'https://example.com',
      target: '_blank',
      rel: 'noopener noreferrer',
    });
  });

  it('gives a mailto: link neither, so mail opens without a blank tab', () => {
    const attrs = anchorAttrs({ href: 'mailto:hello@example.com', newTab: false });
    expect(attrs).toEqual({ href: 'mailto:hello@example.com' });
    expect(attrs).not.toHaveProperty('target');
    expect(attrs).not.toHaveProperty('rel');
  });
});

describe('shapeWays', () => {
  it('puts the primary way first and keeps the others in their order', () => {
    const shaped = shapeWays(
      [way({ id: 'ko-fi' }), way({ id: 'open-collective' }), way({ id: PRIMARY_WAY_ID })],
      PRIMARY_WAY_ID,
    );
    expect(shaped.map((item) => item.id)).toEqual([PRIMARY_WAY_ID, 'ko-fi', 'open-collective']);
  });

  it('leaves out a way with no usable link', () => {
    const shaped = shapeWays([
      way({ id: PRIMARY_WAY_ID }),
      way({ id: 'ko-fi', url: '#' }),
      way({ id: 'open-collective', url: 'javascript:void(0)' }),
      way({ id: 'buy-me-a-coffee', url: '  ' }),
    ]);
    expect(shaped.map((item) => item.id)).toEqual([PRIMARY_WAY_ID]);
  });

  it('lists a way once when the data names it twice, keeping the first', () => {
    const shaped = shapeWays([
      way({ id: 'ko-fi', name: 'Ko-fi' }),
      way({ id: 'ko-fi', name: 'Ko-fi again' }),
    ]);
    expect(shaped.map((item) => item.name)).toEqual(['Ko-fi']);
  });

  it('carries each link trimmed, with where it opens', () => {
    const [shaped] = shapeWays([way({ id: 'ko-fi', url: ' https://ko-fi.com/x ' })]);
    expect(shaped).toMatchObject({ href: 'https://ko-fi.com/x', newTab: true });
  });

  it('returns a list it does not share with its input', () => {
    const input = [way({ id: 'ko-fi' }), way({ id: PRIMARY_WAY_ID })];
    shapeWays(input);
    expect(input.map((item) => item.id)).toEqual(['ko-fi', PRIMARY_WAY_ID]);
  });
});

describe('the shipped ways', () => {
  const shaped = shapeWays(SPONSOR_WAYS);

  it('starts with GitHub Sponsors', () => {
    expect(shaped[0]).toMatchObject({
      id: PRIMARY_WAY_ID,
      name: 'GitHub Sponsors',
      href: 'https://github.com/sponsors/WomB0ComB0',
    });
  });

  it('lists every platform the page had, each opening an https page in a new tab', () => {
    expect(shaped.map((item) => item.name)).toEqual([
      'GitHub Sponsors',
      'Open Collective',
      'Ko-fi',
      'Buy Me a Coffee',
    ]);
    for (const item of shaped) {
      expect(item.href).toMatch(/^https:\/\//);
      expect(item.newTab).toBe(true);
    }
  });

  it('gives each one sentence-case line, with no handle or opaque id in it', () => {
    for (const item of shaped) {
      expect(item.purpose).toMatch(/^[A-Z][^A-Z]*(?:GitHub[^A-Z]*)?\.$/);
      expect(item.purpose).not.toMatch(/@|Y8Y77AJEA/);
    }
  });
});
