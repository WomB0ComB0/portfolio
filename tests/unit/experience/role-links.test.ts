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
 * @file The addresses in a role's text as named links, each once: a proper name where the text
 * gives one right before the address, a repository's slug on a code host, and the host
 * otherwise. A name is only ever read from the text; when in doubt the host stands.
 */

import { describe, expect, it } from 'vitest';

import {
  mergeOrganizationLink,
  organizationLinkOf,
  type RoleLink,
  roleLinksOf,
  siteOf,
} from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-links';

const labels = (links: readonly RoleLink[]): string[] => links.map((link) => link.label);

const CASE_STUDY = 'https://developforgood.notion.site/Case-Study-429302dbba7f4622ab6d4694988433db';
const NHA =
  'https://circular-teller-aff.notion.site/NHA-Nevada-Homeless-Alliance-Case-Study-d27f95730cc540059396c213db14f2e9';
const BARBERSHOP =
  'https://developforgood.notion.site/Barbershop-Books-Inspiring-Kids-To-Read-For-Fun-250fbe7117c0802a9bfbdc1450e33d91';
const ROOTED =
  'https://developforgood.notion.site/Rooted-Minds_Case-Study-2fafbe7117c0808abfbfd62faff77e1a';

describe('organizationLinkOf', () => {
  it('names code-host organizations explicitly', () => {
    expect(organizationLinkOf('https://github.com/resq-software')).toEqual({
      href: 'https://github.com/resq-software',
      label: 'GitHub organization',
      host: 'github.com',
      token: false,
    });
  });

  it('uses neutral GitHub wording for repository destinations', () => {
    expect(organizationLinkOf('https://github.com/resq-software/api')?.label).toBe('GitHub');
  });

  it('deduplicates organization links by address identity', () => {
    const existing: readonly RoleLink[] = [
      {
        href: 'https://github.com/resq-software',
        label: 'resq-software',
        host: 'github.com',
        token: true,
      },
    ];
    expect(mergeOrganizationLink('https://github.com/resq-software/', existing)).toEqual([
      {
        href: 'https://github.com/resq-software/',
        label: 'GitHub organization',
        host: 'github.com',
        token: false,
      },
    ]);
  });

  it('rejects invalid and non-http organization URLs', () => {
    expect(organizationLinkOf('ftp://github.com/resq-software')).toBeNull();
    expect(organizationLinkOf('not a url')).toBeNull();
    expect(organizationLinkOf(null)).toBeNull();
  });
});

describe('roleLinksOf: a proper name from the text', () => {
  it('names a link by the capitalised words right before its bracket', () => {
    const links = roleLinksOf([
      `Rose to Product Lead over 5 projects. Case studies: 3D Girls (${CASE_STUDY}), Nevada Homeless Alliance (${NHA}), Barbershop Books (${BARBERSHOP}), and Melanin Minds Matter (${ROOTED}); also worked with FullCircle Experience.`,
    ]);

    expect(links).toEqual([
      { href: CASE_STUDY, label: '3D Girls', host: 'notion.site', token: false },
      { href: NHA, label: 'Nevada Homeless Alliance', host: 'notion.site', token: false },
      { href: BARBERSHOP, label: 'Barbershop Books', host: 'notion.site', token: false },
      { href: ROOTED, label: 'Melanin Minds Matter', host: 'notion.site', token: false },
    ]);
  });

  it('reads a name with capitals and figures, and stops at the first ordinary word', () => {
    const links = roleLinksOf([
      'Published a survey paper on CNN image classification in IEEE LISAT 2024 (https://ieeexplore.ieee.org/document/10808142) and posted a preprint on chaos and fractals in neural networks on TechRxiv (https://www.techrxiv.org/doi/full/10.36227/techrxiv.174952616.65147326/v1).',
    ]);

    expect(links).toEqual([
      {
        href: 'https://ieeexplore.ieee.org/document/10808142',
        label: 'IEEE LISAT 2024',
        host: 'ieee.org',
        token: false,
      },
      {
        href: 'https://www.techrxiv.org/doi/full/10.36227/techrxiv.174952616.65147326/v1',
        label: 'TechRxiv',
        host: 'techrxiv.org',
        token: false,
      },
    ]);
  });

  it('falls back to the host when the words before are not a name', () => {
    const links = roleLinksOf([
      "Built Curvance's company blog (https://blog.curvance.com) and moved the lending application (https://app.curvance.com) to Next.js 16.",
      "Built Kappa Theta Pi's national website (https://www.kappathetapi.org/) as a client project.",
    ]);

    expect(links).toEqual([
      { href: 'https://blog.curvance.com', label: 'blog.curvance.com', host: null, token: false },
      { href: 'https://app.curvance.com', label: 'app.curvance.com', host: null, token: false },
      {
        href: 'https://www.kappathetapi.org/',
        label: 'kappathetapi.org',
        host: null,
        token: false,
      },
    ]);
  });

  it('does not take the word that opens a sentence for a name', () => {
    // "Rooted" may be a verb here or the first word of a name: the host is the safe label.
    expect(
      labels(roleLinksOf(['Rooted Minds (https://example.org/rooted) was the fifth.'])),
    ).toEqual(['example.org']);
    expect(
      labels(roleLinksOf(['Done. Posted TechRxiv (https://www.techrxiv.org/a) twice.'])),
    ).toEqual(['techrxiv.org']);
    // The opening word is judged by where the run starts, also when a word of it repeats.
    expect(
      labels(roleLinksOf(['Done. New York New School (https://example.org/n) hosted it.'])),
    ).toEqual(['example.org']);
  });

  it('keeps the small words inside a name and drops them from its ends', () => {
    expect(
      labels(
        roleLinksOf([
          'worked with the Alliance of Nevada (https://example.org/a) and for the Books for Kids (https://example.org/b)',
        ]),
      ),
    ).toEqual(['Alliance of Nevada', 'Books for Kids']);
  });

  it('does not name a bare address, which no words lead up to', () => {
    expect(
      roleLinksOf(['Presented at IEEE LISAT 2024 — https://ieeexplore.ieee.org/document/1']),
    ).toEqual([
      {
        href: 'https://ieeexplore.ieee.org/document/1',
        label: 'ieeexplore.ieee.org',
        host: null,
        token: false,
      },
    ]);
  });

  it('gives up on a name that runs on too long', () => {
    expect(
      labels(
        roleLinksOf([
          'worked with The Very Long Name Of An Organization That Never Ends (https://example.org/x)',
        ]),
      ),
    ).toEqual(['example.org']);
  });
});

describe('roleLinksOf: a repository on a code host', () => {
  it('names it by its owner and repository, as a token, with the host beside it', () => {
    const links = roleLinksOf([
      'Led product-decoder (https://github.com/WomB0ComB0/product-decoder), a web app',
      'Trained a brain-tumor classifier (https://bitbucket.org/womb0comb0/ml-models-win-25/src/main/) on 7,023 MRI scans',
      'Co-wrote PG-FMS (https://gitlab.com/WomB0ComB0/pg-fms), a command-line file manager',
    ]);

    expect(links).toEqual([
      {
        href: 'https://github.com/WomB0ComB0/product-decoder',
        label: 'WomB0ComB0/product-decoder',
        host: 'github.com',
        token: true,
      },
      {
        href: 'https://bitbucket.org/womb0comb0/ml-models-win-25/src/main/',
        label: 'womb0comb0/ml-models-win-25',
        host: 'bitbucket.org',
        token: true,
      },
      {
        href: 'https://gitlab.com/WomB0ComB0/pg-fms',
        label: 'WomB0ComB0/pg-fms',
        host: 'gitlab.com',
        token: true,
      },
    ]);
  });

  it('names an owner page by the owner, and the bare host by the host', () => {
    expect(roleLinksOf(['See https://github.com/ElysiumOSS and https://github.com/'])).toEqual([
      {
        href: 'https://github.com/ElysiumOSS',
        label: 'ElysiumOSS',
        host: 'github.com',
        token: true,
      },
      { href: 'https://github.com/', label: 'github.com', host: null, token: false },
    ]);
  });
});

describe('roleLinksOf: each address once, in reading order', () => {
  it('reads the description first, then the duties, and keeps the first of a repeat', () => {
    const links = roleLinksOf([
      'Published a survey paper in IEEE LISAT 2024 (https://ieeexplore.ieee.org/document/10808142).',
      'Published "Optimizing Image Classification Through CNNs" in IEEE LISAT 2024 (https://ieeexplore.ieee.org/document/10808142)',
      'Wrote it up at https://example.org/notes',
    ]);

    expect(links.map((link) => [link.label, link.href])).toEqual([
      ['IEEE LISAT 2024', 'https://ieeexplore.ieee.org/document/10808142'],
      ['example.org', 'https://example.org/notes'],
    ]);
  });

  it('treats a trailing slash, the case of the host and www as the same address', () => {
    expect(
      roleLinksOf([
        'the blog (https://blog.curvance.com)',
        'blog.curvance.com (https://Blog.Curvance.com/), then https://www.blog.curvance.com',
      ]),
    ).toHaveLength(1);
  });

  it('tells apart two links to different parts of one page, and keeps one for the same part', () => {
    const links = roleLinksOf([
      'Read the intro (https://example.org/guide#intro) and the setup (https://example.org/guide#setup).',
      'The intro again: https://example.org/guide#intro',
    ]);

    expect(links.map((link) => link.href)).toEqual([
      'https://example.org/guide#intro',
      'https://example.org/guide#setup',
    ]);
  });

  it('keeps a full stop or comma after an address out of it', () => {
    expect(roleLinksOf(['See https://example.org/path/. Then, http://a.io, too'])).toEqual([
      { href: 'https://example.org/path/', label: 'example.org', host: null, token: false },
      { href: 'http://a.io', label: 'a.io', host: null, token: false },
    ]);
  });

  it('links only http and https addresses, and none for text without one', () => {
    expect(roleLinksOf(['Ran javascript:alert(1) and ftp://files', ''])).toEqual([]);
    expect(roleLinksOf([])).toEqual([]);
  });
});

describe('siteOf', () => {
  it('is the site a host belongs to, without www or its subdomain', () => {
    expect(siteOf('developforgood.notion.site')).toBe('notion.site');
    expect(siteOf('ieeexplore.ieee.org')).toBe('ieee.org');
    expect(siteOf('www.techrxiv.org')).toBe('techrxiv.org');
    expect(siteOf('example.org')).toBe('example.org');
  });

  it('keeps three parts under a two-part country suffix', () => {
    expect(siteOf('papers.example.co.uk')).toBe('example.co.uk');
    expect(siteOf('shop.example.com.au')).toBe('example.com.au');
  });
});
