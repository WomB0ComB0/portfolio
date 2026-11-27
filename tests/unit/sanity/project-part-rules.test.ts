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
 * @file The repository rules a project's parts share between Studio and the site
 * (src/sanity/project-part-rules.ts): one threshold, MIN_PARTS, below which a project reads as
 * one repository; the 'owner/repo' path of a GitHub address, which tells two parts (or a part and
 * another project) apart case-insensitively and never matches an organisation's root; the link
 * text a row shows; and the shape of a name that reads like a repository slug, which Studio
 * warns about while the row has no address.
 */

import { describe, expect, it } from 'vitest';

import {
  isSameRepo,
  looksLikeRepoSlug,
  MIN_PARTS,
  PART_LIMITS,
  repoLabelOf,
  repoPathOf,
} from '@/sanity/project-part-rules';

describe('MIN_PARTS and PART_LIMITS', () => {
  it('make two parts the least a project shows as a system', () => {
    expect(MIN_PARTS).toBe(2);
  });

  it('cap the Studio text and the number of parts, with a softer cap that only warns', () => {
    expect(PART_LIMITS).toEqual({
      name: 60,
      role: 120,
      contribution: 240,
      summary: 240,
      soft: 8,
      max: 12,
    });
    expect(PART_LIMITS.soft).toBeLessThan(PART_LIMITS.max);
  });
});

describe('repoPathOf', () => {
  it.each([
    [
      'a repository address',
      'https://github.com/example-org/example-repo',
      'example-org/example-repo',
    ],
    [
      'a .git suffix',
      'https://github.com/example-org/example-repo.git',
      'example-org/example-repo',
    ],
    [
      'a trailing slash',
      'https://github.com/example-org/example-repo/',
      'example-org/example-repo',
    ],
    [
      'a branch page',
      'https://github.com/example-org/example-repo/tree/main/src',
      'example-org/example-repo',
    ],
    [
      'a query and a hash',
      'https://github.com/example-org/example-repo?tab=readme#top',
      'example-org/example-repo',
    ],
    [
      'surrounding spaces',
      '  https://github.com/example-org/example-repo  ',
      'example-org/example-repo',
    ],
    ['the www host', 'https://www.github.com/example-org/example-repo', 'example-org/example-repo'],
    [
      'an upper-case host',
      'https://GitHub.com/example-org/example-repo',
      'example-org/example-repo',
    ],
    [
      'dots and underscores',
      'https://github.com/example-org/example_repo.v2',
      'example-org/example_repo.v2',
    ],
  ])('reads %s as owner/repo', (_label, url, path) => {
    expect(repoPathOf(url)).toBe(path);
  });

  it('keeps the case the address was written in', () => {
    expect(repoPathOf('https://github.com/lluciiiia/SparkMind')).toBe('lluciiiia/SparkMind');
  });

  it.each([
    ['an organisation root', 'https://github.com/resq-software'],
    ['an organisation root with a slash', 'https://github.com/resq-software/'],
    ['a profile', 'https://github.com/example-user'],
    ['github.com itself', 'https://github.com/'],
    ['another code host', 'https://gitlab.com/example-org/example-repo'],
    ['a look-alike host', 'https://github.com.example.com/example-org/example-repo'],
    ['a non-web scheme', 'ftp://github.com/example-org/example-repo'],
    ['text that is not an address', 'example-org/example-repo'],
    ['a malformed address', 'https://'],
    ['a repository named only .git', 'https://github.com/example-org/.git'],
    ['an encoded character', 'https://github.com/example-org/example%20repo'],
    ['an empty string', ''],
    ['null', null],
    ['undefined', undefined],
  ])('gives null for %s', (_label, url) => {
    expect(repoPathOf(url)).toBeNull();
  });
});

describe('isSameRepo', () => {
  it('matches one repository written in different cases and forms', () => {
    expect(
      isSameRepo(
        'https://github.com/lluciiiia/sparkmind',
        'https://github.com/lluciiiia/SparkMind',
      ),
    ).toBe(true);
    expect(
      isSameRepo(
        'https://github.com/example-org/example-repo.git',
        'https://www.github.com/Example-Org/Example-Repo/tree/main',
      ),
    ).toBe(true);
  });

  it('tells two repositories of one owner apart', () => {
    expect(
      isSameRepo(
        'https://github.com/example-org/example-web',
        'https://github.com/example-org/example-api',
      ),
    ).toBe(false);
  });

  it('never matches an organisation root, not even with itself', () => {
    expect(isSameRepo('https://github.com/resq-software', 'https://github.com/resq-software')).toBe(
      false,
    );
    expect(
      isSameRepo('https://github.com/resq-software', 'https://github.com/resq-software/viz'),
    ).toBe(false);
  });

  it('never matches a missing address or another host', () => {
    expect(isSameRepo(undefined, undefined)).toBe(false);
    expect(isSameRepo(null, 'https://github.com/example-org/example-repo')).toBe(false);
    expect(
      isSameRepo(
        'https://gitlab.com/example-org/example-repo',
        'https://gitlab.com/example-org/example-repo',
      ),
    ).toBe(false);
  });
});

describe('repoLabelOf', () => {
  it.each([
    [
      'GitHub',
      'https://github.com/WomB0ComB0/sparkmind-extension',
      'WomB0ComB0/sparkmind-extension',
    ],
    [
      'a GitHub branch page',
      'https://github.com/example-org/example-repo/tree/main',
      'example-org/example-repo',
    ],
    [
      'a .git suffix',
      'https://github.com/example-org/example-repo.git',
      'example-org/example-repo',
    ],
    [
      'Bitbucket',
      'https://bitbucket.org/example-org/example-repo/src/main/',
      'example-org/example-repo',
    ],
    ['GitLab', 'https://gitlab.com/example-org/example-repo', 'example-org/example-repo'],
    [
      'a GitLab subgroup',
      'https://gitlab.com/example-org/tools/example-repo/-/tree/main',
      'example-org/tools/example-repo',
    ],
  ])('is owner/repo on %s', (_label, url, label) => {
    expect(repoLabelOf(url)).toBe(label);
  });

  it.each([
    [
      'another host',
      'https://codeberg.org/example-org/example-repo/',
      'codeberg.org/example-org/example-repo',
    ],
    ['a www host', 'https://www.example.com/code/', 'example.com/code'],
    ['an organisation root', 'https://github.com/resq-software', 'github.com/resq-software'],
    ['a bare host', 'https://example.com', 'example.com'],
    ['a query and hash', 'https://example.com/code?x=1#y', 'example.com/code'],
  ])('is the host and path on %s', (_label, url, label) => {
    expect(repoLabelOf(url)).toBe(label);
  });

  it('falls back to the trimmed text for something that is not an address', () => {
    expect(repoLabelOf('  not a url  ')).toBe('not a url');
  });
});

describe('looksLikeRepoSlug', () => {
  it.each(['example-org/example-repo', 'WomB0ComB0/api', 'owner/repo.js', ' owner/repo ', 'CI/CD'])(
    'is true for %j',
    (text) => {
      expect(looksLikeRepoSlug(text)).toBe(true);
    },
  );

  it.each([
    'Core platform',
    'API / CDN',
    'CI/CD pipeline',
    'Web app',
    'owner/',
    '/repo',
    'a/b/c',
    '',
  ])('is false for %j', (text) => {
    expect(looksLikeRepoSlug(text)).toBe(false);
  });
});
