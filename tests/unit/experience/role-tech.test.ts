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
 * @file A role's technologies as tokens: each links to /projects filtered by it only where a
 * project has that technology, with the number of projects that do. The key, the count and the
 * address all come from /projects' own filter schema, so a link always lands on rows.
 */

import { makeProject } from '@tests/fixtures/sanity-docs';
import { describe, expect, it } from 'vitest';

import {
  buildTechLinks,
  NO_TECH_LINKS,
  techTokensOf,
} from '@/app/(routes)/(main)/(professioal)/experience/_lib/role-tech';
import { projectFilters } from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-filters';
import { buildProjectIndex } from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-index';

const PROJECTS = [
  makeProject({ technologies: ['TypeScript', 'React', 'Tailwind CSS'] }),
  makeProject({ technologies: ['TypeScript', 'Next.js 15', 'TailwindCSS'] }),
  makeProject({ technologies: ['typescript', 'React.js', 'C#'] }),
  makeProject({ technologies: ['Python 3.12', 'TypeScript', 'TypeScript'] }),
];

describe('buildTechLinks', () => {
  it('counts the projects with each technology, each project once', () => {
    const links = buildTechLinks(PROJECTS);

    expect(links.get('typescript')?.projects).toBe(4);
    expect(links.get('react')?.projects).toBe(2);
    expect(links.get('python')?.projects).toBe(1);
  });

  it("folds spellings as /projects does, and labels a technology by /projects' spelling", () => {
    const links = buildTechLinks(PROJECTS);

    expect(links.get('tailwindcss')).toMatchObject({ projects: 2 });
    expect(links.get('react')?.label).toBe('React');
    expect(links.get('nextjs')?.label).toBe('Next.js 15');
  });

  it('links to /projects filtered by that one technology', () => {
    expect(buildTechLinks(PROJECTS).get('csharp')).toEqual({
      href: '/projects?tech=csharp',
      label: 'C#',
      projects: 1,
    });
  });

  it("writes addresses /projects' own filter reads back to as many rows as it counted", () => {
    const { entries, lookups } = buildProjectIndex(PROJECTS, () => []);
    const schema = projectFilters(lookups);
    const links = buildTechLinks(PROJECTS);

    expect(links.size).toBeGreaterThan(0);
    for (const [key, link] of links) {
      const state = schema.parse(link.href.slice(link.href.indexOf('?')));
      expect(state.tech).toEqual([key]);
      expect(schema.filter(entries, state)).toHaveLength(link.projects);
    }
  });

  it('has no links without projects', () => {
    expect(buildTechLinks([]).size).toBe(0);
    expect(NO_TECH_LINKS.size).toBe(0);
  });
});

describe('techTokensOf', () => {
  const links = buildTechLinks(PROJECTS);

  it("keeps the role's own spelling and order, linking what /projects has", () => {
    expect(techTokensOf(['Rust', 'TypeScript', 'React.js', 'Nix'], links)).toEqual([
      { name: 'Rust', link: null },
      {
        name: 'TypeScript',
        link: { href: '/projects?tech=typescript', label: 'TypeScript', projects: 4 },
      },
      { name: 'React.js', link: { href: '/projects?tech=react', label: 'React', projects: 2 } },
      { name: 'Nix', link: null },
    ]);
  });

  it('keeps C, C++ and C# apart', () => {
    const tokens = techTokensOf(['C', 'C++', 'C#'], links);

    expect(tokens.map((token) => token.link?.href ?? null)).toEqual([
      null,
      null,
      '/projects?tech=csharp',
    ]);
  });

  it('links nothing without the projects, and drops a blank technology', () => {
    expect(techTokensOf(['TypeScript', '  ', ''], NO_TECH_LINKS)).toEqual([
      { name: 'TypeScript', link: null },
    ]);
    expect(techTokensOf([], links)).toEqual([]);
  });

  it('never links a technology named like an object property', () => {
    const tokens = techTokensOf(['constructor', 'toString'], links);

    expect(tokens.every((token) => token.link === null)).toBe(true);
  });
});
