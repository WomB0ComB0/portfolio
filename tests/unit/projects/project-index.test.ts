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
 * @file buildProjectIndex: every project as one ordered row entry (its group, words, kinds,
 * technologies, start month, links, search text and preview), with the filter lookups and the
 * header's figures. The cover URL comes from an injected function, so the pure module never
 * imports the Sanity client. Synthetic projects only.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  buildProjectIndex,
  type IndexableProject,
} from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-index';
import { FEATURED_GROUP } from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-order';

/** A synthetic project with only what the index reads, plus the image coverOf looks at. */
type TestProject = IndexableProject & {
  readonly image: { readonly asset: { readonly _ref: string } } | null;
};

const p = (_id: string, extra: Partial<Omit<TestProject, '_id'>> = {}): TestProject => ({
  _id,
  title: `${_id} title`,
  description: 'Does a thing. Then another.',
  category: 'Web Development',
  technologies: ['TypeScript'],
  featured: false,
  order: 0,
  startDate: null,
  githubUrl: null,
  liveUrl: null,
  image: null,
  ...extra,
});

const PROJECTS: readonly TestProject[] = [
  p('plain', { startDate: '2024-05-01', technologies: ['Python 3.12', 'Flask (Web Docs)'] }),
  p('star', {
    title: 'Star - The Shining One',
    featured: true,
    startDate: '2025-03-01',
    category: 'AI/ML / Full-Stack',
    technologies: ['React', 'ReactJS', 'Go', 'Bun', 'Vite'],
    githubUrl: 'https://github.com/example/star',
    liveUrl: 'https://star.example',
    image: { asset: { _ref: 'image-a' } },
  }),
  p('other', { startDate: '2024-09-01', technologies: ['Python', 'Flask'] }),
];

const coverOf = vi.fn((project: TestProject) =>
  project.image ? `https://cdn.example/${project._id}.jpg` : null,
);
const index = buildProjectIndex(PROJECTS, coverOf);
const byId = (id: string) => index.entries.find((entry) => entry.id === id);

describe('buildProjectIndex', () => {
  it('orders the entries Featured first, then the years', () => {
    expect(index.entries.map(({ id, group }) => `${id}:${group}`)).toEqual([
      `star:${FEATURED_GROUP}`,
      'other:2024',
      'plain:2024',
    ]);
    expect(byId('star')?.groupLabel).toBe('Featured');
  });

  it('splits the title and keeps every kind, labelled', () => {
    const star = byId('star');

    expect(star?.title).toBe('Star');
    expect(star?.summary).toBe('The Shining One');
    expect(star?.kindLabels).toEqual(['AI/ML', 'Full-Stack']);
    expect(star?.kindSlugs).toEqual(['ai-ml', 'full-stack']);
  });

  it('lists each technology once, under its most used spelling', () => {
    expect(byId('star')?.techLabels).toEqual(['React', 'Go', 'Bun', 'Vite']);
    expect(byId('star')?.techKeys).toEqual(['react', 'go', 'bun', 'vite']);
    expect(byId('plain')?.techLabels).toEqual(['Python', 'Flask']);
  });

  it('keeps the original words in the search text', () => {
    const haystack = byId('plain')?.haystack ?? '';

    expect(haystack).toContain('Python 3.12');
    expect(haystack).toContain('Web Development');
    expect(haystack).toContain('Does a thing.');
  });

  it('carries the start month, the links and the preview', () => {
    const star = byId('star');

    expect(star?.started).toEqual({ iso: '2025-03', name: 'Mar', year: '2025' });
    expect(star?.githubUrl).toBe('https://github.com/example/star');
    expect(star?.liveUrl).toBe('https://star.example');
    expect(star?.preview).toEqual({
      title: 'Star',
      kind: 'AI/ML',
      cover: 'https://cdn.example/star.jpg',
    });
    expect(byId('plain')?.preview.cover).toBeNull();
    expect(byId('plain')?.githubUrl).toBeNull();
  });

  it('counts the header figures', () => {
    expect(index.stats).toEqual({ projects: 3, technologies: 6, withLive: 1 });
  });

  it('builds the lookups from the same projects', () => {
    expect(index.lookups.kindOrder).toContain('web-development');
    expect(index.lookups.techs.python).toBe('Python');
  });
});
