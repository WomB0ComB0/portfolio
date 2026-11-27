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
 * @file A project's parts and lead sentence, from GROQ to the decoded Project: the three project
 * queries ask for them with one identical projection (the reference kept as an id, never
 * dereferenced), and the decoder reads them leniently. The loaders drop a whole document that
 * fails to decode, so one malformed part must cost only itself: a bad part never removes its
 * project from /projects, its page, the sitemap or the home page.
 */

import { makeProject, makeProjectPart } from '@tests/fixtures/sanity-docs';
import { Schema } from 'effect';
import { evaluate, parse } from 'groq-js';
import { describe, expect, it } from 'vitest';

import { ProjectSchema } from '@/hooks/sanity/schemas';
import { featuredProjectsQuery, projectBySlugQuery, projectsQuery } from '@/lib/sanity/queries';

const decode = Schema.decodeUnknownSync(ProjectSchema);

const QUERIES = [
  ['projectsQuery', projectsQuery],
  ['featuredProjectsQuery', featuredProjectsQuery],
  ['projectBySlugQuery', projectBySlugQuery],
] as const;

/** The parts projection's body; it has no nested braces, so a flat match reads all of it. */
const PARTS_PROJECTION = /"systemParts":\s*systemParts\[\]\s*\{([^}]+)\}/u;

describe('the project queries', () => {
  it.each(QUERIES)('%s asks for every part field, keeping the page link an id', (_name, query) => {
    const projection = PARTS_PROJECTION.exec(query)?.[1];

    expect(projection).toBeDefined();
    const fields = (projection ?? '').split(',').map((field) => field.trim());
    expect(fields).toEqual([
      '_key',
      '_type',
      'name',
      'role',
      'repoUrl',
      '"projectId": project._ref',
      'technologies',
      'contribution',
    ]);
    expect(projection).not.toContain('->');
  });

  it.each(QUERIES)(
    '%s asks for the lead sentence and the parts after the GitHub URL',
    (_name, query) => {
      expect(query).toMatch(/^\s*systemSummary,$/mu);
      expect(query.indexOf('systemSummary')).toBeGreaterThan(query.indexOf('githubUrl'));
      expect(query.indexOf('"systemParts"')).toBeGreaterThan(query.indexOf('githubUrl'));
    },
  );

  it('uses one identical parts projection in all three, so they cannot drift', () => {
    const projections = QUERIES.map(([, query]) => PARTS_PROJECTION.exec(query)?.[0]);

    expect(projections[0]).toBeDefined();
    expect(new Set(projections).size).toBe(1);
  });

  it('leaves every order() clause as it was, so the home page and v1 keep their order', () => {
    expect(projectsQuery).toContain('order(featured desc, order asc, startDate desc)');
    expect(featuredProjectsQuery).toContain('order(order asc, startDate desc)');
    expect(projectBySlugQuery).not.toContain('order(');
  });
});

describe('a round trip through GROQ and the decoder', () => {
  /** Parts as Studio stores them: the page link is a weak reference object. */
  const STORED_PARTS = [
    {
      _key: 'web',
      _type: 'projectPart',
      name: 'Web app',
      role: 'Where people sign in.',
      repoUrl: 'https://github.com/example-org/example-web',
      technologies: ['Next.js', 'Supabase'],
      contribution: 'Sole author.',
    },
    {
      _key: 'shortener',
      _type: 'projectPart',
      name: 'Example Shortener',
      role: 'Short links.',
      repoUrl: 'https://github.com/example-org/example-shortener',
      project: { _type: 'reference', _ref: 'proj-shortener', _weak: true },
    },
    { _key: 'core', _type: 'projectPart', name: 'Core service', role: 'Runs the jobs.' },
  ];

  /** The same parts as the projection answers them, decoded: nulls read as absent. */
  const DECODED_PARTS = [
    STORED_PARTS[0],
    {
      _key: 'shortener',
      _type: 'projectPart',
      name: 'Example Shortener',
      role: 'Short links.',
      repoUrl: 'https://github.com/example-org/example-shortener',
      projectId: 'proj-shortener',
    },
    { _key: 'core', _type: 'projectPart', name: 'Core service', role: 'Runs the jobs.' },
  ];

  const source = makeProject({
    featured: true,
    slug: { _type: 'slug', current: 'example-system' },
  });
  const stored = {
    ...source,
    systemParts: STORED_PARTS,
    systemSummary: 'People use the web app; it calls the core service.',
  };

  it.each(QUERIES)(
    '%s keeps every row, its page link id and the lead sentence',
    async (_name, query) => {
      const answer = await evaluate(parse(query), {
        dataset: [stored],
        params: { slug: 'example-system' },
      });
      const value = await answer.get();
      const project = decode(Array.isArray(value) ? value[0] : value);

      expect(project.title).toBe(source.title);
      expect(project.systemParts).toEqual(DECODED_PARTS);
      expect(project.systemSummary).toBe('People use the web app; it calls the core service.');
    },
  );

  it('answers null for a document written before the fields, and decodes it unchanged', async () => {
    const answer = await evaluate(parse(projectsQuery), { dataset: [source] });
    const [value] = (await answer.get()) as Record<string, unknown>[];

    expect(value?.systemParts).toBeNull();
    expect(value?.systemSummary).toBeNull();
    const project = decode(value);
    expect(project.systemParts).toBeNull();
    expect(project).not.toHaveProperty('systemSummary');
    expect(project.title).toBe(source.title);
  });
});

describe('decoding parts leniently', () => {
  const valid = makeProjectPart({
    name: 'Web app',
    repoUrl: 'https://github.com/example-org/example-web',
  });

  it('leaves a missing list missing and keeps an explicit null', () => {
    const project = makeProject();

    expect(decode(project)).not.toHaveProperty('systemParts');
    expect(decode({ ...project, systemParts: null }).systemParts).toBeNull();
  });

  it('reads a value that is not a list as no parts, keeping the project', () => {
    const project = makeProject();
    const decoded = decode({ ...project, systemParts: 'bad' });

    expect(decoded.systemParts).toEqual([]);
    expect(decoded.title).toBe(project.title);
  });

  it('drops each malformed part and keeps its valid siblings and its project', () => {
    const project = makeProject();
    const decoded = decode({
      ...project,
      systemParts: [
        valid,
        {},
        null,
        'bad',
        { _key: 'k', name: 3 },
        { _key: 't', name: 'x', technologies: ['Go', 3] },
        { _key: 'w', _type: 'other', name: 'x' },
        { name: 'No key' },
      ],
    });

    expect(decoded._id).toBe(project._id);
    expect(decoded.title).toBe(project.title);
    expect(decoded.systemParts).toEqual([valid]);
  });

  it('keeps a part whose optional fields are null or missing, with only its key', () => {
    const decoded = decode({
      ...makeProject(),
      systemParts: [
        {
          _key: 'bare',
          _type: null,
          name: null,
          role: null,
          repoUrl: null,
          projectId: null,
          technologies: null,
          contribution: null,
        },
        { _key: 'minimal' },
      ],
    });

    expect(decoded.systemParts).toEqual([{ _key: 'bare' }, { _key: 'minimal' }]);
  });

  it('reads a null lead sentence as absent and keeps a written one', () => {
    const project = makeProject();

    expect(decode({ ...project, systemSummary: null })).not.toHaveProperty('systemSummary');
    expect(decode({ ...project, systemSummary: 'How it works.' }).systemSummary).toBe(
      'How it works.',
    );
  });

  it('still rejects a lead sentence that is not text', () => {
    expect(() => decode({ ...makeProject(), systemSummary: 3 })).toThrow();
  });
});

describe('makeProjectPart', () => {
  it('makes a part that decodes as it is, with an invented address and a unique key', () => {
    const first = makeProjectPart();
    const second = makeProjectPart();

    expect(first._key).not.toBe(second._key);
    expect(first.repoUrl).toMatch(/^https:\/\/github\.com\/example-org\//u);
    expect(decode({ ...makeProject(), systemParts: [first, second] }).systemParts).toEqual([
      first,
      second,
    ]);
  });
});
