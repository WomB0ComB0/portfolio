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
 * @file The Studio "Featured rank" for /projects: an optional whole number (1 to 99) beside the
 * Featured switch, with no default, whose description says what it does; the three project
 * queries fetch it; and the decoder reads a missing or null value (every document written
 * before the field) as absent, so no project is ever dropped for lacking one.
 */

import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { ProjectSchema } from '@/hooks/sanity/schemas';
import { featuredProjectsQuery, projectBySlugQuery, projectsQuery } from '@/lib/sanity/queries';
import { projectType } from '@/sanity/schemaTypes/project';

/** Only some field types declare these, so they are read off the field as found. */
const rankField = projectType.fields.find(({ name }) => name === 'featuredRank') as
  | {
      readonly type?: unknown;
      readonly title?: unknown;
      readonly description?: unknown;
      readonly initialValue?: unknown;
      readonly validation?: unknown;
    }
  | undefined;

/** A synthetic project, shaped like the documents the projects query returns. */
const BASE = {
  _id: 'project-test',
  _type: 'project',
  _createdAt: '2025-10-30T05:25:29Z',
  _updatedAt: '2025-10-30T06:17:25Z',
  _rev: 'rev',
  title: 'Synthetic Project',
  slug: { _type: 'slug', current: 'synthetic-project' },
  description: 'A project used only by this test.',
  category: 'Web Development',
  technologies: ['TypeScript'],
  status: 'Completed',
  featured: false,
  order: 4,
};

const decode = Schema.decodeUnknownSync(ProjectSchema);

describe('the Featured rank field in Studio', () => {
  it('is a number titled Featured rank, with no default', () => {
    expect(rankField).toBeDefined();
    expect(rankField?.type).toBe('number');
    expect(rankField?.title).toBe('Featured rank');
    expect(rankField?.initialValue).toBeUndefined();
    expect(typeof rankField?.validation).toBe('function');
  });

  it('says where it puts the project, the order, and what an empty rank and the switch do', () => {
    const description = String(rankField?.description ?? '');

    expect(description).toContain('Featured group');
    expect(description).toContain('/projects');
    expect(description).toMatch(/lowest number first/i);
    expect(description).toMatch(/leave it empty/i);
    expect(description).toMatch(/home page always uses the Featured switch/i);
  });

  it('sits right after the Featured switch, so the two feature controls are together', () => {
    const names = projectType.fields.map(({ name }) => name);

    expect(names.indexOf('featuredRank')).toBe(names.indexOf('featured') + 1);
  });
});

describe('fetching and decoding featuredRank', () => {
  it.each([
    ['projectsQuery', projectsQuery],
    ['featuredProjectsQuery', featuredProjectsQuery],
    ['projectBySlugQuery', projectBySlugQuery],
  ])('%s fetches it', (_name, query) => {
    expect(query).toMatch(/^\s*featuredRank,?$/m);
  });

  it('leaves every order() clause as it was, so the home page and v1 keep their order', () => {
    expect(projectsQuery).toContain('order(featured desc, order asc, startDate desc)');
    expect(featuredProjectsQuery).toContain('order(order asc, startDate desc)');
  });

  it('keeps a rank', () => {
    expect(decode({ ...BASE, featuredRank: 3 }).featuredRank).toBe(3);
  });

  it('reads a missing or null value as absent, never dropping the project', () => {
    expect(decode(BASE).featuredRank).toBeUndefined();
    expect(decode({ ...BASE, featuredRank: null }).featuredRank).toBeUndefined();
    expect(decode({ ...BASE, featuredRank: null }).title).toBe('Synthetic Project');
  });

  it('still rejects a value that is not a number', () => {
    expect(() => decode({ ...BASE, featuredRank: 'x' })).toThrow();
  });
});
