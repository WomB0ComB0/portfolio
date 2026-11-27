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
 * @file The Studio "How it fits together" fields on a project: an optional inline array of parts
 * right after the GitHub URL, then an optional lead sentence. Each part has a name, a role line, a
 * public repository address (https only), a weak reference to another project's page, its own
 * technologies and "My part". Everything typed here is public once published, so the descriptions
 * say so, the collapsed row says "No link (private)" when it has no address, and the checks warn
 * before Publish: a name shaped like a repository slug on a row with no address, another
 * project's repository typed as a plain part, a main repository no part lists, and an address
 * GitHub hides from visitors. The repository check's query runs on groq-js against a fake
 * dataset, and the GitHub check asks an injected fetch; every fixture repository is invented.
 */

import { evaluate, parse } from 'groq-js';
import type { ValidationContext } from 'sanity';
import { describe, expect, it, vi } from 'vitest';

import { MIN_PARTS, PART_LIMITS } from '@/sanity/project-part-rules';
import { projectType } from '@/sanity/schemaTypes/project';
import {
  notPublicOnGitHubCheck,
  PART_MESSAGES,
  partsListErrors,
  partsListWarnings,
  rejectSelfReference,
  warnIgnoredTechnologies,
  warnNotPublicOnGitHub,
  warnOtherProjectsRepo,
  warnRepoShapedName,
  warnSummaryWithoutParts,
} from '@/sanity/schemaTypes/project-parts';

/** The parts of a Studio field definition these tests read, as found on the definition. */
interface StudioField {
  readonly name: string;
  readonly type?: string;
  readonly title?: string;
  readonly description?: string;
  readonly rows?: number;
  readonly weak?: boolean;
  readonly hidden?: unknown;
  readonly to?: readonly { readonly type: string }[];
  readonly of?: readonly StudioMember[];
  readonly validation?: unknown;
  readonly options?: { readonly disableNew?: boolean; readonly filter?: unknown };
}

interface StudioMember {
  readonly name?: string;
  readonly type: string;
  readonly fields?: readonly StudioField[];
  readonly preview?: {
    readonly select?: Record<string, string>;
    readonly prepare?: (value: Record<string, unknown>) => { title?: unknown; subtitle?: unknown };
  };
}

const fieldOf = (fields: readonly unknown[], name: string): StudioField => {
  const field = (fields as readonly StudioField[]).find((candidate) => candidate.name === name);
  if (!field) throw new Error(`No Studio field named ${name}`);
  return field;
};

const partsField = fieldOf(projectType.fields, 'systemParts');
const summaryField = fieldOf(projectType.fields, 'systemSummary');
const partMember = partsField.of?.[0];
const partField = (name: string): StudioField => fieldOf(partMember?.fields ?? [], name);

/** One call a field's validation makes on its rule. */
interface RuleCall {
  readonly method: string;
  readonly args: readonly unknown[];
}

/** The calls a field's validation makes, in order, on a rule that records them. */
function ruleCallsOf(field: StudioField): RuleCall[] {
  const calls: RuleCall[] = [];
  const rule: Record<string, unknown> = new Proxy(
    {},
    {
      get:
        (_target, method) =>
        (...args: unknown[]) => {
          calls.push({ method: String(method), args });
          return rule;
        },
    },
  );
  const validation = field.validation as (rule: unknown) => unknown;
  validation(rule);
  return calls;
}

/** The method names a field's validation calls, in order. */
const methodsOf = (field: StudioField): string[] => ruleCallsOf(field).map(({ method }) => method);

/** The level each custom check runs at: the validator, and whether `.warning()` follows it. */
function customLevelsOf(field: StudioField): { readonly fn: unknown; readonly warning: boolean }[] {
  const calls = ruleCallsOf(field);
  return calls.flatMap((call, index) =>
    call.method === 'custom'
      ? [{ fn: call.args[0], warning: calls[index + 1]?.method === 'warning' }]
      : [],
  );
}

/** A validation context for a value inside a part (`parent`) of the document `document`. */
const contextOf = (parent: unknown, document: Record<string, unknown> = {}): ValidationContext =>
  ({ parent, document: { _id: 'drafts.proj-edited', _type: 'project', ...document } }) as never;

const part = (key: string, extra: Record<string, unknown> = {}) => ({
  _key: key,
  _type: 'projectPart',
  name: `Part ${key}`,
  role: `What part ${key} does.`,
  ...extra,
});

describe('where the fields sit', () => {
  it('puts the parts right after the GitHub URL and the lead sentence right after them', () => {
    const names = projectType.fields.map(({ name }) => name);

    expect(names.indexOf('systemParts')).toBe(names.indexOf('githubUrl') + 1);
    expect(names.indexOf('systemSummary')).toBe(names.indexOf('systemParts') + 1);
  });

  it('is one inline array of projectPart objects, with its fields in reading order', () => {
    expect(partsField.type).toBe('array');
    expect(partsField.title).toBe('How it fits together');
    expect(partsField.of).toHaveLength(1);
    expect(partMember?.type).toBe('object');
    expect(partMember?.name).toBe('projectPart');
    expect(partMember?.fields?.map(({ name }) => name)).toEqual([
      'name',
      'role',
      'repoUrl',
      'project',
      'technologies',
      'contribution',
    ]);
  });

  it('gives the lead sentence a two-row text box', () => {
    expect(summaryField.type).toBe('text');
    expect(summaryField.rows).toBe(2);
  });
});

describe('the field rules', () => {
  it('requires a name and a role, each capped', () => {
    expect(ruleCallsOf(partField('name'))).toEqual(
      expect.arrayContaining([
        { method: 'required', args: [] },
        { method: 'max', args: [PART_LIMITS.name] },
      ]),
    );
    expect(ruleCallsOf(partField('role'))).toEqual([
      { method: 'required', args: [] },
      { method: 'max', args: [PART_LIMITS.role] },
    ]);
  });

  it('allows only https repository addresses', () => {
    expect(partField('repoUrl').type).toBe('url');
    expect(ruleCallsOf(partField('repoUrl'))).toContainEqual({
      method: 'uri',
      args: [{ scheme: ['https'] }],
    });
  });

  it('makes the page link a weak reference to another project, with no "create new"', () => {
    const project = partField('project');

    expect(project.type).toBe('reference');
    expect(project.to).toEqual([{ type: 'project' }]);
    expect(project.weak).toBe(true);
    expect(project.options?.disableNew).toBe(true);
    expect(customLevelsOf(project)).toEqual([{ fn: rejectSelfReference, warning: false }]);
  });

  it("leaves the edited project, published and draft, out of the page link's picker", () => {
    const filter = partField('project').options?.filter as (context: unknown) => {
      filter: string;
      params: Record<string, unknown>;
    };
    const options = filter({ document: { _id: 'drafts.proj-edited' } });

    expect(options.params).toEqual({ published: 'proj-edited', draft: 'drafts.proj-edited' });
    expect(options.filter).toContain('$published');
    expect(options.filter).toContain('$draft');
  });

  it('keeps technologies unique and only warns about ones a page link makes moot', () => {
    expect(methodsOf(partField('technologies'))).toContain('unique');
    expect(customLevelsOf(partField('technologies'))).toEqual([
      { fn: warnIgnoredTechnologies, warning: true },
    ]);
  });

  it('hides empty technologies while a page link is set, but never hides typed ones', () => {
    const hidden = partField('technologies').hidden as (context: unknown) => boolean;

    expect(hidden({ parent: { project: { _ref: 'proj-other' } } })).toBe(true);
    expect(hidden({ parent: { project: { _ref: 'proj-other' }, technologies: [] } })).toBe(true);
    expect(hidden({ parent: { project: { _ref: 'proj-other' }, technologies: ['Go'] } })).toBe(
      false,
    );
    expect(hidden({ parent: {} })).toBe(false);
    expect(hidden({ parent: undefined })).toBe(false);
  });

  it('caps "My part" and the lead sentence', () => {
    expect(partField('contribution').type).toBe('text');
    expect(ruleCallsOf(partField('contribution'))).toEqual([
      { method: 'max', args: [PART_LIMITS.contribution] },
    ]);
    expect(ruleCallsOf(summaryField)).toContainEqual({
      method: 'max',
      args: [PART_LIMITS.summary],
    });
  });

  it('runs the list checks as an error and a warning, with a hard cap', () => {
    expect(ruleCallsOf(partsField)).toContainEqual({ method: 'max', args: [PART_LIMITS.max] });
    expect(customLevelsOf(partsField)).toEqual([
      { fn: partsListErrors, warning: false },
      { fn: partsListWarnings, warning: true },
    ]);
  });

  it("only warns about a repository-shaped name, another project's repository and a lone lead", () => {
    expect(customLevelsOf(partField('name'))).toEqual([{ fn: warnRepoShapedName, warning: true }]);
    expect(customLevelsOf(partField('repoUrl'))).toEqual([
      { fn: warnOtherProjectsRepo, warning: true },
      { fn: warnNotPublicOnGitHub, warning: true },
    ]);
    expect(customLevelsOf(summaryField)).toEqual([{ fn: warnSummaryWithoutParts, warning: true }]);
  });
});

describe('what the descriptions say', () => {
  it('says on the list that everything is public, how a private repository is entered, and that Latest work ignores parts', () => {
    const description = String(partsField.description);

    expect(description).toMatch(/public/i);
    expect(description).toMatch(/private/i);
    expect(description).toContain('Latest work');
    expect(description).toContain('/api/v1/sanity/projects');
    expect(description).toMatch(/two or more/i);
  });

  it('says on the address that only a public repository goes there, and a private one stays empty', () => {
    const description = String(partField('repoUrl').description);

    expect(description).toMatch(/public/i);
    expect(description).toMatch(/private/i);
    expect(description).toMatch(/leave it empty/i);
  });

  it('asks for what a private part is, never its repository name', () => {
    expect(String(partField('name').description)).toMatch(/private/i);
  });
});

describe('the collapsed row', () => {
  const prepare = (value: Record<string, unknown>) => {
    const fn = partMember?.preview?.prepare;
    if (!fn) throw new Error('No preview.prepare on projectPart');
    return fn(value);
  };

  it('selects the name, role, address and the linked page title', () => {
    expect(partMember?.preview?.select).toEqual({
      title: 'name',
      role: 'role',
      repoUrl: 'repoUrl',
      page: 'project.title',
    });
  });

  it('says "No link (private)" for a row with no address and no page', () => {
    expect(prepare({ title: 'Core service', role: 'Runs the jobs.' })).toEqual({
      title: 'Core service',
      subtitle: 'No link (private) · Runs the jobs.',
    });
  });

  it('shows the linked page first, then the address without its scheme', () => {
    expect(
      prepare({
        title: 'Example Shortener',
        role: 'Short links.',
        repoUrl: 'https://github.com/example-org/example-shortener',
        page: 'Example Shortener',
      }),
    ).toEqual({
      title: 'Example Shortener',
      subtitle: '→ Example Shortener · github.com/example-org/example-shortener · Short links.',
    });
  });

  it('shows the address without its scheme or www', () => {
    expect(
      prepare({ title: 'Web app', role: 'The app.', repoUrl: 'https://www.example.com/code' }),
    ).toEqual({ title: 'Web app', subtitle: 'example.com/code · The app.' });
  });

  it('does not call a row with a page link but no address private', () => {
    expect(prepare({ title: 'Viewer', role: 'Draws it.', page: 'Example Viewer' })).toEqual({
      title: 'Viewer',
      subtitle: '→ Example Viewer · Draws it.',
    });
  });
});

describe('partsListErrors', () => {
  it.each([
    ['no list', undefined],
    ['an empty list', []],
    [
      'a public and a private part',
      [part('a', { repoUrl: 'https://github.com/example-org/example-web' }), part('b')],
    ],
    ['two private parts', [part('a'), part('b')]],
    [
      'two parts on different repositories',
      [
        part('a', { repoUrl: 'https://github.com/example-org/example-web' }),
        part('b', { repoUrl: 'https://github.com/example-org/example-api' }),
      ],
    ],
    ['something that is not a list', 'bad'],
  ])('accepts %s', (_label, value) => {
    expect(partsListErrors(value)).toBe(true);
  });

  it('refuses exactly one part, which never shows on the site', () => {
    expect(MIN_PARTS).toBe(2);
    expect(partsListErrors([part('a')])).toBe(PART_MESSAGES.oneOnly);
  });

  it('refuses two parts on one repository, compared in any case', () => {
    expect(
      partsListErrors([
        part('a', { repoUrl: 'https://github.com/example-org/example-web' }),
        part('b', { repoUrl: 'https://github.com/Example-Org/Example-Web.git' }),
      ]),
    ).toBe(PART_MESSAGES.sameRepo);
  });

  it('refuses two parts on one address another host serves', () => {
    expect(
      partsListErrors([
        part('a', { repoUrl: 'https://gitlab.com/example-org/example-web' }),
        part('b', { repoUrl: ' https://gitlab.com/example-org/example-web ' }),
      ]),
    ).toBe(PART_MESSAGES.sameRepo);
  });

  it('refuses two parts that link one project page', () => {
    expect(
      partsListErrors([
        part('a', { project: { _ref: 'proj-other' } }),
        part('b', { project: { _ref: 'proj-other' } }),
      ]),
    ).toBe(PART_MESSAGES.sameProject);
  });
});

describe('partsListWarnings', () => {
  const main = 'https://github.com/example-org/example-web';
  const listsMain = [
    part('a', { repoUrl: 'https://github.com/Example-Org/Example-Web' }),
    part('b', { repoUrl: 'https://github.com/example-org/example-api' }),
  ];

  it('warns above the soft cap of parts', () => {
    const many = Array.from({ length: PART_LIMITS.soft + 1 }, (_, index) => part(`p${index}`));

    expect(partsListWarnings(many, contextOf(undefined))).toBe(PART_MESSAGES.tooMany);
    expect(partsListWarnings(many.slice(0, PART_LIMITS.soft), contextOf(undefined))).toBe(true);
  });

  it('warns when the main repository is a single repository no part lists', () => {
    expect(
      partsListWarnings([part('a'), part('b')], contextOf(undefined, { githubUrl: main })),
    ).toBe(PART_MESSAGES.mainMissing);
  });

  it('stays quiet when a part lists the main repository, in any case', () => {
    expect(partsListWarnings(listsMain, contextOf(undefined, { githubUrl: main }))).toBe(true);
  });

  it.each([
    ['an organisation root', 'https://github.com/resq-software'],
    ['no GitHub URL', undefined],
    ['another host', 'https://gitlab.com/example-org/example-web'],
  ])('stays quiet when the main address is %s', (_label, githubUrl) => {
    expect(partsListWarnings([part('a'), part('b')], contextOf(undefined, { githubUrl }))).toBe(
      true,
    );
  });

  it('leaves fewer than two parts to the error', () => {
    expect(partsListWarnings([part('a')], contextOf(undefined, { githubUrl: main }))).toBe(true);
    expect(partsListWarnings(undefined, contextOf(undefined, { githubUrl: main }))).toBe(true);
  });
});

describe('warnRepoShapedName', () => {
  it('warns about an owner/repo name on a row with no address', () => {
    expect(warnRepoShapedName('example-org/example-core', contextOf({}))).toBe(
      PART_MESSAGES.repoShapedName,
    );
    expect(warnRepoShapedName('example-org/example-core', contextOf({ repoUrl: '  ' }))).toBe(
      PART_MESSAGES.repoShapedName,
    );
  });

  it('stays quiet once the row has an address, or for a descriptive name', () => {
    expect(
      warnRepoShapedName(
        'example-org/example-web',
        contextOf({ repoUrl: 'https://github.com/example-org/example-web' }),
      ),
    ).toBe(true);
    expect(warnRepoShapedName('Core platform', contextOf({}))).toBe(true);
    expect(warnRepoShapedName('API / CDN', contextOf({}))).toBe(true);
    expect(warnRepoShapedName(undefined, contextOf({}))).toBe(true);
  });
});

describe('rejectSelfReference', () => {
  it.each([
    ['its draft', 'drafts.proj-edited'],
    ['its published document', 'proj-edited'],
    ['a release version', 'versions.rRelease1.proj-edited'],
  ])('refuses a page link to the project itself, editing %s', (_label, _id) => {
    expect(rejectSelfReference({ _ref: 'proj-edited' }, contextOf({}, { _id }))).toBe(
      PART_MESSAGES.selfReference,
    );
  });

  it('accepts another project, or no link', () => {
    expect(rejectSelfReference({ _ref: 'proj-other' }, contextOf({}))).toBe(true);
    expect(rejectSelfReference(undefined, contextOf({}))).toBe(true);
    expect(rejectSelfReference({}, contextOf({}))).toBe(true);
  });
});

describe('warnIgnoredTechnologies', () => {
  it('warns only when technologies are typed while a page link is set', () => {
    const linked = { project: { _ref: 'proj-other' } };

    expect(warnIgnoredTechnologies(['Go'], contextOf(linked))).toBe(PART_MESSAGES.ignoredTech);
    expect(warnIgnoredTechnologies([], contextOf(linked))).toBe(true);
    expect(warnIgnoredTechnologies(undefined, contextOf(linked))).toBe(true);
    expect(warnIgnoredTechnologies(['Go'], contextOf({}))).toBe(true);
  });
});

describe('warnSummaryWithoutParts', () => {
  it('warns about a lead sentence on a project with fewer than two parts', () => {
    expect(warnSummaryWithoutParts('How it works.', contextOf(undefined))).toBe(
      PART_MESSAGES.summaryAlone,
    );
    expect(
      warnSummaryWithoutParts('How it works.', contextOf(undefined, { systemParts: [part('a')] })),
    ).toBe(PART_MESSAGES.summaryAlone);
  });

  it('stays quiet with two parts, or with no sentence', () => {
    expect(
      warnSummaryWithoutParts(
        'How it works.',
        contextOf(undefined, { systemParts: [part('a'), part('b')] }),
      ),
    ).toBe(true);
    expect(warnSummaryWithoutParts('   ', contextOf(undefined))).toBe(true);
    expect(warnSummaryWithoutParts(undefined, contextOf(undefined))).toBe(true);
  });
});

describe('warnOtherProjectsRepo', () => {
  /** Projects (and one other document) as the dataset holds them; every repository is invented. */
  const DATASET = [
    {
      _id: 'proj-shortener',
      _type: 'project',
      title: 'Example Shortener',
      githubUrl: 'https://github.com/example-org/example-shortener',
    },
    {
      _id: 'drafts.proj-shortener',
      _type: 'project',
      title: 'Example Shortener',
      githubUrl: 'https://github.com/example-org/example-shortener',
    },
    {
      _id: 'proj-edited',
      _type: 'project',
      title: 'Edited',
      githubUrl: 'https://github.com/example-org/example-web',
    },
    {
      _id: 'versions.rRelease1.proj-edited',
      _type: 'project',
      title: 'Edited',
      githubUrl: 'https://github.com/example-org/example-web',
    },
    {
      _id: 'proj-org',
      _type: 'project',
      title: 'Example Org',
      githubUrl: 'https://github.com/example-org',
    },
    {
      _id: 'proj-untitled',
      _type: 'project',
      githubUrl: 'https://github.com/example-org/untitled',
    },
    { _id: 'proj-nolink', _type: 'project', title: 'No Link' },
    {
      _id: 'book-elsewhere',
      _type: 'book',
      title: 'A Book',
      githubUrl: 'https://github.com/example-org/example-book',
    },
  ];

  /** A context for a part of the project `_id`, whose client answers from DATASET via groq-js. */
  function partContext(parent: Record<string, unknown>, _id = 'drafts.proj-edited') {
    const fetch = vi.fn(async (query: string, params: Record<string, unknown>) => {
      const result = await evaluate(parse(query), { dataset: DATASET, params });
      return result.get();
    });
    const getClient = vi.fn((_options: { readonly apiVersion: string }) => ({ fetch }));
    const context = { getClient, parent, document: { _id, _type: 'project' } } as never;
    return { context: context as ValidationContext, getClient, fetch };
  }

  it('names the project whose repository a plain part repeats, in any case', async () => {
    const url = 'https://github.com/Example-Org/Example-Shortener';
    const { context, getClient } = partContext({ repoUrl: url });

    const result = await warnOtherProjectsRepo(url, context);

    expect(result).toContain('Example Shortener');
    expect(result).toContain('Its own project page');
    expect(getClient).toHaveBeenCalledWith({ apiVersion: '2024-10-14' });
  });

  it('falls back to "another project" for one with no title', async () => {
    const url = 'https://github.com/example-org/untitled';

    expect(await warnOtherProjectsRepo(url, partContext({ repoUrl: url }).context)).toContain(
      'another project',
    );
  });

  it.each([
    ['its draft', 'drafts.proj-edited'],
    ['its published document', 'proj-edited'],
    ['a release version', 'versions.rRelease1.proj-edited'],
  ])("stays quiet for the project's own repository, editing %s", async (_label, id) => {
    const url = 'https://github.com/example-org/example-web';
    const { context, fetch } = partContext({ repoUrl: url }, id);

    expect(await warnOtherProjectsRepo(url, context)).toBe(true);
    expect(fetch.mock.calls[0]?.[1]).toEqual({
      published: 'proj-edited',
      draft: 'drafts.proj-edited',
    });
  });

  it('stays quiet when no other project has the repository, and ignores other types', async () => {
    for (const url of [
      'https://github.com/example-org/example-api',
      'https://github.com/example-org/example-book',
    ]) {
      expect(await warnOtherProjectsRepo(url, partContext({ repoUrl: url }).context)).toBe(true);
    }
  });

  it('asks nothing when the part already links a page, has no address, or names no repository', async () => {
    const linked = partContext({ project: { _ref: 'proj-shortener' } });
    expect(
      await warnOtherProjectsRepo(
        'https://github.com/example-org/example-shortener',
        linked.context,
      ),
    ).toBe(true);
    expect(linked.getClient).not.toHaveBeenCalled();

    const plain = partContext({});
    expect(await warnOtherProjectsRepo(undefined, plain.context)).toBe(true);
    expect(await warnOtherProjectsRepo('https://github.com/example-org', plain.context)).toBe(true);
    expect(await warnOtherProjectsRepo('https://example.com/code', plain.context)).toBe(true);
    expect(plain.getClient).not.toHaveBeenCalled();
  });

  it('asks nothing without a document id', async () => {
    const getClient = vi.fn();
    const context = { getClient, parent: {}, document: undefined } as never;

    expect(
      await warnOtherProjectsRepo('https://github.com/example-org/example-shortener', context),
    ).toBe(true);
    expect(getClient).not.toHaveBeenCalled();
  });

  it('stays quiet when the lookup fails, because it is only a nudge', async () => {
    const fetch = vi.fn(async () => {
      throw new Error('offline');
    });
    const context = {
      getClient: () => ({ fetch }),
      parent: {},
      document: { _id: 'drafts.proj-edited', _type: 'project' },
    } as never;

    expect(
      await warnOtherProjectsRepo('https://github.com/example-org/example-shortener', context),
    ).toBe(true);
  });
});

describe('warnNotPublicOnGitHub', () => {
  /** A fetch that answers every request with `status` (or throws), recording each call. */
  const answering = (status: number | Error) =>
    vi.fn(async (_url: string, _init?: RequestInit) => {
      if (status instanceof Error) throw status;
      return { status };
    });

  it('warns when GitHub hides the repository from visitors, and says how to enter a private one', async () => {
    const check = notPublicOnGitHubCheck(answering(404));

    const result = await check('https://github.com/example-org/example-hidden');

    expect(result).toBe(PART_MESSAGES.notPublic);
    expect(PART_MESSAGES.notPublic).toContain('private');
    expect(PART_MESSAGES.notPublic).toContain('clear');
  });

  it('stays quiet for a repository GitHub shows', async () => {
    expect(await notPublicOnGitHubCheck(answering(200))('https://github.com/example-org/a')).toBe(
      true,
    );
  });

  it.each([
    ['a rate limit', 403],
    ['too many requests', 429],
    ['a server error', 502],
    ['a refused or failed request', new TypeError('Failed to fetch')],
  ])('fails open on %s: no warning, nothing blocks Publish', async (_label, status) => {
    expect(
      await notPublicOnGitHubCheck(answering(status))('https://github.com/example-org/b'),
    ).toBe(true);
  });

  it('asks GitHub nothing for an empty field, an organisation root or another host', async () => {
    const fetchImpl = answering(404);
    const check = notPublicOnGitHubCheck(fetchImpl);

    for (const url of [
      undefined,
      '',
      'https://github.com/example-org',
      'https://gitlab.com/example-org/c',
    ]) {
      expect(await check(url)).toBe(true);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("is the field's check, looking through the browser's own fetch", async () => {
    const fetchImpl = answering(404);
    vi.stubGlobal('fetch', fetchImpl);
    try {
      expect(await warnNotPublicOnGitHub('https://github.com/example-org/d')).toBe(
        PART_MESSAGES.notPublic,
      );
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
