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
 * @file /projects on the shared filter schema: ?category is the Kind (one at a time; today's
 * slug, a label in any case, or a whole old free-text category from a shared link), ?tech the
 * Technology (several at once, OR within, repeated keys; an old single ?tech=Python still
 * works), plus ?q. The lookups are plain JSON built on the server. Synthetic projects shaped
 * like the live data: combined categories, one-off kinds folded under Other, and technology
 * spellings that fold together.
 */

import { describe, expect, it } from 'vitest';

import {
  buildProjectLookups,
  MAX_KIND_CHIPS,
  OTHER_KIND,
  type ProjectFilterItem,
  projectFilters,
} from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-filters';
import {
  kindSlug,
  kindsOf,
  techKey,
} from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-text';

interface Synthetic extends ProjectFilterItem {
  readonly id: string;
}

/** [id, category, technologies]: synthetic, shaped like the live projects. */
const SOURCE: readonly (readonly [string, string, readonly string[]])[] = [
  ['p01', 'Web Development', ['React', 'TypeScript']],
  ['p02', 'Web Development (Elysium Freelance)', ['Next.js 15', 'Tailwind CSS']],
  ['p03', 'Hackathon / Web Development', ['Python', 'Flask']],
  ['p04', 'AI/ML / Full-Stack / Monorepo', ['Python', 'React']],
  ['p05', 'AI/ML', ['Python 3.12', 'TensorFlow']],
  ['p06', 'Civic Tech / Full-Stack', ['TypeScript', 'Bun']],
  ['p07', 'Education', ['Go']],
  ['p08', 'Education', ['ReactJS']],
  ['p09', 'CLI Tool / Developer Tools', ['Go']],
  ['p10', 'CLI Tool / Python / File Management', ['Python']],
  ['p11', 'Financial Technology', ['TypeScript']],
  ['p12', 'Financial Technology', ['TypeScript']],
  ['p13', 'Blockchain', ['Solidity']],
  ['p14', 'Public Safety', ['TypeScript']],
];

const lookups = buildProjectLookups(
  SOURCE.map(([, category, technologies]) => ({ category, technologies })),
);
const ITEMS: readonly Synthetic[] = SOURCE.map(([id, category, technologies]) => ({
  id,
  kindSlugs: kindsOf(category).map(kindSlug),
  techKeys: [...new Set(technologies.map(techKey))],
  haystack: `${id} ${category} ${technologies.join(' ')}`,
}));
const schema = projectFilters<Synthetic>(lookups);

/** The ids a URL's filters keep. */
const shown = (search: string): string[] =>
  schema.filter(ITEMS, schema.parse(search)).map(({ id }) => id);

describe('buildProjectLookups', () => {
  it('is plain JSON, so it crosses from the server page to the island', () => {
    expect(JSON.parse(JSON.stringify(lookups))).toEqual(lookups);
  });

  it(`gives the ${MAX_KIND_CHIPS} most used kinds a chip (ties A to Z) and folds the rest`, () => {
    // Five, so every chip shows on one line at 1440 with the live kinds (a sixth hid Other).
    expect(MAX_KIND_CHIPS).toBe(5);
    expect(lookups.kindOrder).toEqual([
      'web-development',
      'ai-ml',
      'cli-tool',
      'education',
      'financial-technology',
    ]);
    expect(lookups.folded).toContain('full-stack');
    expect(lookups.folded).toContain('blockchain');
    expect(lookups.folded).toContain('hackathon');
    expect(lookups.folded).not.toContain('web-development');
  });

  it('labels a technology with its most used spelling', () => {
    expect(lookups.techs.react).toBe('React');
    expect(lookups.techs.python).toBe('Python');
    expect(lookups.techs[techKey('Tailwind CSS')]).toBe('Tailwind CSS');
  });
});

describe('?category, the Kind', () => {
  it('offers the chips in order, then Other', () => {
    expect(schema.facets.category.values).toEqual([...lookups.kindOrder, OTHER_KIND]);
    expect(schema.facets.category.label).toBe('Kind');
    expect(schema.facets.category.multiple).toBeFalsy();
  });

  it.each([
    ['today’s slug', '?category=web-development'],
    ['an old single category', '?category=Web%20Development'],
    ['a label in another case', '?category=WEB+DEVELOPMENT'],
    ['an old category with a qualifier', '?category=Web%20Development%20(Elysium%20Freelance)'],
  ])('reads %s as that kind', (_name, search) => {
    expect(schema.parse(search).category).toEqual(['web-development']);
    expect(shown(search)).toEqual(['p01', 'p02', 'p03']);
  });

  it('reads a whole old combined category as its first kind', () => {
    const search = `?category=${encodeURIComponent('AI/ML / Full-Stack / Monorepo')}`;

    expect(schema.parse(search).category).toEqual(['ai-ml']);
    expect(shown(search)).toEqual(['p04', 'p05']);
  });

  it.each([
    ['an old combined category no project has any more', 'AI/ML / Full-Stack', ['ai-ml']],
    ['one whose first kind is gone', 'Retired Kind / Education', ['education']],
    [
      'one with a qualifier, its kinds since re-spelt',
      'Gone (Old) / CLI Tool / Gone Too',
      ['cli-tool'],
    ],
    ['one none of whose kinds is known', 'Gone / Also Gone', []],
  ])('reads %s as its first kind that is still known', (_name, raw, expected) => {
    expect(schema.parse(`?category=${encodeURIComponent(raw)}`).category).toEqual(expected);
  });

  it.each(['?category=all', '?category=All', '?category=bogus', '?category='])(
    'drops %s: every project shows, with nothing filtered',
    (search) => {
      const state = schema.parse(search);

      expect(state.category).toEqual([]);
      expect(schema.isFiltered(state)).toBe(false);
      expect(shown(search)).toHaveLength(ITEMS.length);
    },
  );

  it('keeps a project with a folded kind under Other', () => {
    expect(shown('?category=other')).toEqual(['p03', 'p04', 'p06', 'p09', 'p10', 'p13', 'p14']);
  });

  it('shows a folded kind from a link in Other’s place, under its own name', () => {
    const state = schema.parse('?category=blockchain');
    const { options } = schema.options(ITEMS, state).category;
    const standIn = options.find(({ current }) => current);

    expect(shown('?category=blockchain')).toEqual(['p13']);
    expect(standIn).toMatchObject({ slug: 'blockchain', label: 'Blockchain', count: 1 });
    expect(options.map(({ slug }) => slug)).not.toContain(OTHER_KIND);
  });
});

describe('?tech, the Technology', () => {
  it('is multi-select, labelled Technology', () => {
    expect(schema.facets.tech.multiple).toBe(true);
    expect(schema.facets.tech.label).toBe('Technology');
  });

  it('reads an old single ?tech=Python, in any case and with a version', () => {
    expect(schema.parse('?tech=Python').tech).toEqual(['python']);
    expect(schema.parse('?tech=python').tech).toEqual(['python']);
    expect(shown('?tech=Python')).toEqual(['p03', 'p04', 'p05', 'p10']);
  });

  it('folds React.js into React', () => {
    expect(shown('?tech=react.js')).toEqual(['p01', 'p04', 'p08']);
  });

  it('ORs repeated keys within the facet', () => {
    expect(schema.parse('?tech=python&tech=go').tech).toEqual(['python', 'go']);
    expect(shown('?tech=python&tech=go')).toEqual(['p03', 'p04', 'p05', 'p07', 'p09', 'p10']);
  });

  it('drops a value far longer than any spelling, fast (no regex backtracking on URL input)', () => {
    const hostile = `?tech=a${'+'.repeat(10_000)}x&category=a${'+'.repeat(10_000)}x`;
    const start = performance.now();
    const state = schema.parse(hostile);

    expect(performance.now() - start).toBeLessThan(100);
    expect(state.tech).toEqual([]);
    expect(state.category).toEqual([]);
    expect(schema.parse(`?tech=${'Python'.padEnd(101, '!')}`).tech).toEqual([]);
  });

  it('drops a technology no project has', () => {
    expect(schema.parse('?tech=COBOL').tech).toEqual([]);
    expect(shown('?tech=COBOL')).toHaveLength(ITEMS.length);
  });

  it('ANDs across facets', () => {
    expect(shown('?category=education&tech=go')).toEqual(['p07']);
  });
});

describe('counts, links and words', () => {
  it('counts each facet with every other filter applied but its own', () => {
    const options = schema.options(ITEMS, schema.parse('?tech=python'));
    const web = options.category.options.find(({ slug }) => slug === 'web-development');

    expect(options.category.all).toBe(4);
    expect(web?.count).toBe(1);
    expect(options.tech.all).toBe(ITEMS.length);
  });

  it('serialises a state as the URL a link, a form and an in-place change all write', () => {
    const state = { q: 'cli', category: ['cli-tool'], tech: ['go', 'python'] };

    expect(schema.serialize(state)).toBe('/projects?category=cli-tool&tech=go&tech=python&q=cli');
    expect(schema.hrefFor(schema.empty(), { category: 'education' })).toBe(
      '/projects?category=education',
    );
  });

  it('names the chosen values in the empty state', () => {
    const sentence = schema.noMatchSentence(schema.parse('?category=education&tech=go&tech=bun'));

    expect(sentence).toContain('in Education');
    expect(sentence).toContain('with Go or Bun');
  });

  it('searches the haystack, capped at 100 characters', () => {
    expect(schema.maxLength).toBe(100);
    expect(shown('?q=elysium')).toEqual(['p02']);
    expect(shown('?q=TENSORFLOW')).toEqual(['p05']);
  });
});
