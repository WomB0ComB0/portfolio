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
 * @file The /projects view of a project's parts (projects/_lib/project-parts.ts): one threshold,
 * MIN_PARTS, decides everything, so a project with no tidy part, or only one, reads exactly as a
 * one-repository project does today. Above it the module gives the card's repository count, the
 * page's "How it fits together" rows, the technologies the filter and Built with read (the main
 * list first, part technologies only when new) and the words search reads. A row links its
 * repository only through safeHref, links another project's page only when that project is
 * listed and is not this one, and is called private only when nothing was typed. Every fixture
 * repository is invented.
 */

import { makeProject, makeProjectPart } from '@tests/fixtures/sanity-docs';
import { describe, expect, it } from 'vitest';

import {
  allTechnologiesOf,
  caseSystemOf,
  type PartOwner,
  partRepoHrefs,
  partSourcesOf,
  partWords,
  repoCountOf,
} from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-parts';
import type { Project } from '@/hooks/sanity/schemas';

/** A project with `systemParts` as given (left off when undefined), main technologies first. */
const owner = (systemParts?: unknown, extra: Partial<Project> = {}): Project =>
  ({
    ...makeProject({ technologies: ['Next.js', 'Google Gemini API'], ...extra }),
    ...(systemParts === undefined ? {} : { systemParts }),
  }) as Project;

const web = makeProjectPart({
  _key: 'web',
  name: 'Web app',
  role: 'Where people sign in.',
  repoUrl: 'https://github.com/example-org/example-web',
  technologies: ['Next.js', 'Supabase', 'Gemini'],
  contribution: 'The scraper and the PWA.',
});
const api = makeProjectPart({
  _key: 'api',
  name: 'Scraper API',
  role: 'Fetches pages for the web app.',
  repoUrl: 'https://github.com/example-org/example-api',
  technologies: ['Express', 'Puppeteer'],
});
const core = makeProjectPart({
  _key: 'core',
  name: 'Core service',
  role: 'Runs the jobs.',
  repoUrl: undefined,
  technologies: ['Go'],
});
const shortener = makeProjectPart({
  _key: 'shortener',
  name: 'Example Shortener',
  role: 'Short links.',
  repoUrl: 'https://github.com/example-org/example-shortener',
  projectId: 'proj-shortener',
  technologies: ['Hono'],
});

/** The other projects the page loads; the system links only to ones listed here. */
const LISTED = [{ _id: 'proj-shortener' }, { _id: 'proj-other' }];

describe('below two tidy parts, a project reads as one repository', () => {
  it.each([
    ['no field', undefined],
    ['null', null],
    ['an empty list', []],
    ['a value that is not a list', 'bad'],
    ['one part', [web]],
    ['one part and a malformed one', [web, { _key: 'x', name: 3 }]],
  ])('%s', (_label, systemParts) => {
    const project = owner(systemParts);

    expect(partSourcesOf(project)).toEqual([]);
    expect(repoCountOf(project)).toBe(0);
    expect(allTechnologiesOf(project)).toEqual(['Next.js', 'Google Gemini API']);
    expect(caseSystemOf(project, LISTED)).toBeNull();
    expect(partWords(project)).toEqual([]);
    expect(partRepoHrefs(project)).toEqual([]);
  });
});

describe('partSourcesOf and repoCountOf', () => {
  it('keeps Studio order', () => {
    expect(partSourcesOf(owner([api, web, core])).map(({ _key }) => _key)).toEqual([
      'api',
      'web',
      'core',
    ]);
  });

  it('keeps the first valid part of a key and drops later ones, whatever came before', () => {
    const sources = partSourcesOf(
      owner([
        { _key: 'web', name: 3 },
        { ...web, name: 'First valid' },
        api,
        { ...web, name: 'Duplicate' },
        { ...api, _key: ' api ', name: 'Spaced duplicate' },
      ]),
    );

    expect(sources.map(({ _key, name }) => [_key, name])).toEqual([
      ['web', 'First valid'],
      ['api', 'Scraper API'],
    ]);
  });

  it.each([
    ['no name', { ...web, _key: 'n', name: undefined }],
    ['a blank name', { ...web, _key: 'n', name: '   ' }],
    ['no key', { ...web, _key: undefined }],
    ['a blank key', { ...web, _key: '  ' }],
    ['another type', { ...web, _key: 'n', _type: 'anotherObject' }],
    ['a number for a role', { ...web, _key: 'n', role: 3 }],
    ['a number for an address', { ...web, _key: 'n', repoUrl: 3 }],
    ['a number for a page link', { ...web, _key: 'n', projectId: 3 }],
    ['a number among technologies', { ...web, _key: 'n', technologies: ['Go', 3] }],
    ['technologies that are not a list', { ...web, _key: 'n', technologies: 'Go' }],
    ['a number for "My part"', { ...web, _key: 'n', contribution: 3 }],
    ['null', null],
    ['text', 'part'],
  ])('drops a part with %s', (_label, bad) => {
    expect(partSourcesOf(owner([bad, web, api])).map(({ _key }) => _key)).toEqual(['web', 'api']);
  });

  it('accepts a part with no type, as an old draft may have', () => {
    const untyped = { _key: 'untyped', name: 'Untyped' };

    expect(partSourcesOf(owner([untyped, web])).map(({ _key }) => _key)).toEqual([
      'untyped',
      'web',
    ]);
  });

  it('counts two valid parts beside a malformed one', () => {
    expect(repoCountOf(owner([web, { _key: 'bad' }, api]))).toBe(2);
  });

  it('counts private and linked parts, because each is a repository', () => {
    expect(repoCountOf(owner([web, core, shortener]))).toBe(3);
  });
});

describe('the rows of caseSystemOf', () => {
  const project = owner([web, api, core, shortener], {
    _id: 'proj-system',
    systemSummary: '  People use the web app;\n it calls the API.  ',
  });

  it('gives one row per tidy part, in Studio order, with the tidied lead sentence', () => {
    const system = caseSystemOf(project, LISTED);

    expect(system?.summary).toBe('People use the web app; it calls the API.');
    expect(system?.parts.map(({ key }) => key)).toEqual(['web', 'api', 'core', 'shortener']);
  });

  it('reads a public part fully: name, role, repository link, technologies and "My part"', () => {
    expect(caseSystemOf(project, LISTED)?.parts[0]).toEqual({
      key: 'web',
      name: 'Web app',
      role: 'Where people sign in.',
      page: null,
      repo: {
        href: 'https://github.com/example-org/example-web',
        label: 'example-org/example-web',
      },
      isPrivate: false,
      technologies: ['Next.js', 'Supabase', 'Gemini'],
      contribution: 'The scraper and the PWA.',
    });
  });

  it('calls a part private when no address was typed and it links no page', () => {
    const row = caseSystemOf(project, LISTED)?.parts[2];

    expect(row?.repo).toBeNull();
    expect(row?.isPrivate).toBe(true);
    expect(row?.technologies).toEqual(['Go']);
  });

  it("links a listed project's page, and gives that part no technologies of its own", () => {
    const row = caseSystemOf(project, LISTED)?.parts[3];

    expect(row?.page).toBe('/projects/proj-shortener');
    expect(row?.repo?.label).toBe('example-org/example-shortener');
    expect(row?.technologies).toEqual([]);
    expect(row?.isPrivate).toBe(false);
  });

  it('gives no page for a link to the project itself or to a project that is not listed', () => {
    const self = makeProjectPart({ _key: 'self', projectId: 'proj-system', repoUrl: undefined });
    const gone = makeProjectPart({ _key: 'gone', projectId: 'proj-unlisted', repoUrl: undefined });
    const rows = caseSystemOf(owner([web, self, gone], { _id: 'proj-system' }), [
      ...LISTED,
      { _id: 'proj-system' },
    ])?.parts;

    expect(rows?.[1]?.page).toBeNull();
    expect(rows?.[2]?.page).toBeNull();
    expect(rows?.[2]?.isPrivate).toBe(false);
    expect(rows?.[2]?.repo).toBeNull();
  });

  it.each([
    ['a javascript: address', 'javascript:alert(1)'],
    ['an address without slashes', 'https:x'],
    ['a relative address', 'example-org/example-web'],
  ])('links no repository for %s, and does not call it private', (_label, repoUrl) => {
    const row = caseSystemOf(owner([{ ...web, repoUrl }, api]), LISTED)?.parts[0];

    expect(row?.repo).toBeNull();
    expect(row?.isPrivate).toBe(false);
  });

  it.each([
    ['an empty address', ''],
    ['a blank address', '   '],
    ['a null address', null],
  ])('calls a part with %s private', (_label, repoUrl) => {
    const row = caseSystemOf(owner([{ ...web, repoUrl }, api]), LISTED)?.parts[0];

    expect(row?.repo).toBeNull();
    expect(row?.isPrivate).toBe(true);
  });

  it('labels a repository owner/repo and links it as Studio wrote it, trimmed', () => {
    const row = caseSystemOf(
      owner([{ ...web, repoUrl: '  https://github.com/example-org/example-web/tree/main  ' }, api]),
      LISTED,
    )?.parts[0];

    expect(row?.repo).toEqual({
      href: 'https://github.com/example-org/example-web/tree/main',
      label: 'example-org/example-web',
    });
  });

  it('tidies text: collapses the name, trims the key, and gives null for blank text', () => {
    const row = caseSystemOf(
      owner([
        { ...web, _key: ' web ', name: '  Web \n app ', role: '  ', contribution: '\n' },
        api,
      ]),
      LISTED,
    )?.parts[0];

    expect(row).toMatchObject({ key: 'web', name: 'Web app', role: null, contribution: null });
  });

  it('dedupes a row’s technologies by key, keeping the first spelling, and drops blanks', () => {
    const row = caseSystemOf(
      owner([{ ...web, technologies: ['React', 'React.js', ' ', 'ReactJS', 'Vue 3', 'Vue'] }, api]),
      LISTED,
    )?.parts[0];

    expect(row?.technologies).toEqual(['React', 'Vue 3']);
  });

  it('gives no lead sentence when none is written, or only spaces', () => {
    expect(caseSystemOf(owner([web, api]), LISTED)?.summary).toBeNull();
    expect(caseSystemOf(owner([web, api], { systemSummary: '  ' }), LISTED)?.summary).toBeNull();
  });
});

describe('allTechnologiesOf', () => {
  it('lists the main technologies first, as written, then each part technology with a new key', () => {
    expect(allTechnologiesOf(owner([web, api, core]))).toEqual([
      'Next.js',
      'Google Gemini API',
      'Supabase',
      'Express',
      'Puppeteer',
      'Go',
    ]);
  });

  it("keeps the main list's spelling when a part spells a technology another way", () => {
    const all = allTechnologiesOf(owner([web, api]));

    expect(all.filter((tech) => /gemini/i.test(tech))).toEqual(['Google Gemini API']);
  });

  it("lists a part's Express and Convex once beside the main list's Express.js and Convex.dev", () => {
    const project = owner(
      [
        { ...web, technologies: ['Next.js', 'Convex'] },
        { ...api, technologies: ['Express', 'Puppeteer'] },
      ],
      { technologies: ['Next.js', 'Express.js', 'Convex.dev'] },
    );

    expect(allTechnologiesOf(project)).toEqual([
      'Next.js',
      'Express.js',
      'Convex.dev',
      'Puppeteer',
    ]);
  });

  it("ignores a linked part's technologies: that project's own card answers its filter", () => {
    expect(allTechnologiesOf(owner([web, shortener]))).not.toContain('Hono');
  });

  it('keeps a repeat in the main list, which it never rewrites', () => {
    const project = owner([web, api], { technologies: ['Next.js', 'Next.js', 'Go'] });

    expect(allTechnologiesOf(project).slice(0, 3)).toEqual(['Next.js', 'Next.js', 'Go']);
  });

  it('adds a part technology once, even when two parts list it', () => {
    const all = allTechnologiesOf(owner([api, { ...core, technologies: ['Puppeteer', 'Go'] }]));

    expect(all.filter((tech) => tech === 'Puppeteer')).toHaveLength(1);
  });
});

describe('partWords', () => {
  const words = partWords(
    owner([web, api, core, shortener], { systemSummary: 'A lead sentence nobody searches.' }),
  );

  it('holds the names, roles, own technologies and public repository paths', () => {
    expect(words).toEqual(
      expect.arrayContaining([
        'Web app',
        'Where people sign in.',
        'Supabase',
        'example-org/example-web',
        'Scraper API',
        'Puppeteer',
        'example-org/example-api',
        'Core service',
        'Go',
        'Example Shortener',
        'example-org/example-shortener',
      ]),
    );
  });

  it('leaves out "My part", the lead sentence and a linked part’s technologies', () => {
    expect(words).not.toContain('The scraper and the PWA.');
    expect(words).not.toContain('A lead sentence nobody searches.');
    expect(words).not.toContain('Hono');
  });

  it('holds no blank words', () => {
    const blank = partWords(owner([{ ...web, role: ' ' }, core]));

    expect(blank.every((word) => word.trim() !== '')).toBe(true);
  });
});

describe('partRepoHrefs', () => {
  it('gives each safe repository link in page order, leaving out private parts', () => {
    expect(partRepoHrefs(owner([api, core, web, shortener]))).toEqual([
      'https://github.com/example-org/example-api',
      'https://github.com/example-org/example-web',
      'https://github.com/example-org/example-shortener',
    ]);
  });

  it('leaves out an unsafe address', () => {
    expect(partRepoHrefs(owner([{ ...web, repoUrl: 'javascript:alert(1)' }, api]))).toEqual([
      'https://github.com/example-org/example-api',
    ]);
  });
});

describe('immutability', () => {
  it('changes none of its inputs', () => {
    const project = owner([web, { ...api, technologies: ['React', 'React.js'] }, core, shortener], {
      systemSummary: ' Lead. ',
    });
    const listed = [...LISTED];
    const before = JSON.stringify([project, listed]);

    partSourcesOf(project);
    repoCountOf(project);
    allTechnologiesOf(project);
    partWords(project);
    caseSystemOf(project, listed);
    partRepoHrefs(project);

    expect(JSON.stringify([project, listed])).toBe(before);
  });

  it('accepts the shape a decoded Project has', () => {
    const project: PartOwner = owner([web, api]);

    expect(repoCountOf(project)).toBe(2);
  });
});
