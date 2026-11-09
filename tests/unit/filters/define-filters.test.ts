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
 * @file defineFilters, the server-safe schema every filter page declares: URL parsing on nuqs
 * (repeated keys for multi-select, so a GET form without JavaScript sends what the island
 * writes), legacy links resolved to today's slugs, AND across facets and OR within one,
 * disjunctive counts (each facet counted with every other filter but its own), and hrefs from
 * the same serialiser. The data is synthetic, shaped like /projects and /places rows.
 */

import { describe, expect, it } from 'vitest';

import { defineFilters, type FilterState } from '@/lib/filters';
import { PROJECTS, type Project, projects } from './filters-fixture';

const ids = (state: FilterState<'category' | 'tech'>): string[] =>
  projects.filter(PROJECTS, state).map((p) => p.id);

describe('reading the URL', () => {
  it('reads nothing as no filter', () => {
    expect(projects.parse('')).toEqual({ q: '', category: [], tech: [] });
    expect(projects.parse({})).toEqual({ q: '', category: [], tech: [] });
  });

  it('reads repeated keys, the way a GET form sends checkboxes that share a name', () => {
    expect(projects.parse('?tech=react&tech=go').tech).toEqual(['react', 'go']);
    expect(projects.parse({ tech: ['react', 'go'] }).tech).toEqual(['react', 'go']);
    expect(projects.parse(new URLSearchParams('tech=react&tech=python')).tech).toEqual([
      'react',
      'python',
    ]);
  });

  it('resolves old single-value links to today’s slugs and drops what it cannot place', () => {
    const state = projects.parse(
      '?category=Web%20Development%20(Elysium%20Freelance)&tech=Next.js&tech=ReactJS&tech=TailwindCSS',
    );

    expect(state.category).toEqual(['websites']);
    expect(state.tech).toEqual(['react', 'tailwind']);
  });

  it('keeps one value for a single-select facet, drops blanks and repeats', () => {
    expect(projects.parse('?category=tools&category=apps').category).toEqual(['tools']);
    expect(projects.parse('?tech=react&tech=&tech=React.js&tech=go').tech).toEqual(['react', 'go']);
  });

  it('normalises the search: first value, single-spaced, trimmed, capped', () => {
    expect(projects.parse('?q=%20%20alpha%20%20%20cli%20').q).toBe('alpha cli');
    expect(projects.parse({ q: ['first', 'second'] }).q).toBe('first');
    expect(projects.parse({ q: 'x'.repeat(80) }).q).toHaveLength(40);
  });

  it('ignores keys it does not know, and never reads the prototype chain', () => {
    expect(projects.parse('?constructor=1&category=toString&tech=__proto__')).toEqual({
      q: '',
      category: [],
      tech: [],
    });
  });

  it('refuses a facet named q, which the search owns', () => {
    expect(() =>
      defineFilters<Project, 'q'>({
        path: '/x',
        noun: { one: 'x', many: 'xs' },
        search: { haystack: (p) => p.title },
        facets: { q: { label: 'Q', valuesOf: () => [], labelOf: (s) => s } },
      }),
    ).toThrow(/q/);
  });
});

describe('matching', () => {
  it('ANDs across facets and ORs within one', () => {
    expect(ids(projects.parse('?tech=react'))).toEqual(['b', 'c', 'd']);
    expect(ids(projects.parse('?tech=react&tech=go'))).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(projects.parse('?tech=react&tech=go&category=tools'))).toEqual(['a']);
    expect(ids(projects.parse('?tech=python&category=hackathons'))).toEqual(['c']);
  });

  it('searches the haystack, ignoring case, and ANDs it with the facets', () => {
    expect(ids(projects.parse('?q=TYPESCRIPT'))).toEqual(['b', 'd']);
    expect(ids(projects.parse('?q=typescript&category=websites'))).toEqual(['d']);
    expect(ids(projects.parse('?q=nothing'))).toEqual([]);
  });

  it('tells a filtered state from an empty one', () => {
    expect(projects.isFiltered(projects.parse(''))).toBe(false);
    expect(projects.isFiltered(projects.parse('?q=a'))).toBe(true);
    expect(projects.isFiltered(projects.parse('?tech=go'))).toBe(true);
    expect(projects.empty()).toEqual({ q: '', category: [], tech: [] });
  });
});

describe('disjunctive counts', () => {
  it('counts each option with every other filter applied, never its own facet', () => {
    const { category, tech } = projects.options(PROJECTS, projects.parse('?tech=react&q=a'));

    // The kinds, with ?tech=react and ?q=a applied but not ?category: b (apps), c (hackathons)
    // and d (websites) all hold an "a".
    expect(category.all).toBe(3);
    expect(category.options.map((o) => [o.slug, o.count, o.current])).toEqual([
      ['tools', 0, false],
      ['apps', 1, false],
      ['hackathons', 1, false],
      ['websites', 1, false],
    ]);
    // The technologies, with ?q=a but not ?tech: all but Epsilon ("epsilon bot python") hold an
    // "a", so Python counts only Gamma.
    expect(tech.all).toBe(4);
    expect(tech.options.find((o) => o.slug === 'react')).toMatchObject({
      count: 3,
      current: true,
    });
    expect(tech.options.find((o) => o.slug === 'python')).toMatchObject({
      count: 1,
      current: false,
    });
  });

  it('keeps an option at 0 in place instead of dropping it', () => {
    const { category } = projects.options(PROJECTS, projects.parse('?tech=go'));

    expect(category.options.map((o) => o.slug)).toEqual([
      'tools',
      'apps',
      'hackathons',
      'websites',
    ]);
    expect(category.options.map((o) => o.count)).toEqual([1, 0, 0, 0]);
  });

  it('orders options without a fixed list by use, then by label', () => {
    const { tech } = projects.options(PROJECTS, projects.empty());

    expect(tech.options.map((o) => `${o.label} ${o.count}`)).toEqual([
      'React 3',
      'Python 2',
      'TypeScript 2',
      'Cobra 1',
      'Go 1',
      'Tailwind CSS 1',
    ]);
  });
});

describe('a chosen value shown under its group', () => {
  interface Cert {
    readonly family: string;
    readonly chip: string;
  }
  const LABELS: Readonly<Record<string, string>> = {
    google: 'Google',
    ibm: 'IBM',
    aws: 'AWS',
    other: 'Other',
  };
  const certs: readonly Cert[] = [
    { family: 'google', chip: 'google' },
    { family: 'google', chip: 'google' },
    { family: 'ibm', chip: 'other' },
    { family: 'aws', chip: 'other' },
  ];
  const schema = defineFilters<Cert, 'issuer'>({
    path: '/certifications',
    noun: { one: 'certificate', many: 'certificates' },
    search: { haystack: (c) => c.family },
    facets: {
      issuer: {
        label: 'Issuer',
        /** A one-off issuer is itself and Other, as on /certifications. */
        valuesOf: (c) => (c.chip === 'other' ? [c.family, 'other'] : [c.family]),
        /** A known slug's label, else the slug. */
        labelOf: (slug) => LABELS[slug] ?? slug,
        values: ['google', 'other'],
        /** The one-off issuers show under Other; the rest under nothing. */
        groupOf: (slug) => (slug === 'ibm' || slug === 'aws' ? 'other' : null),
        /** Any slug with a label, today's or one-off; anything else is dropped. */
        resolve: (raw) => (Object.hasOwn(LABELS, raw) ? raw : null),
      },
    },
  });

  it('takes the group option’s place, named and counted as itself', () => {
    const { issuer } = schema.options(certs, schema.parse('?issuer=ibm'));

    expect(issuer.options).toEqual([
      { slug: 'google', label: 'Google', count: 2, current: false },
      { slug: 'ibm', label: 'IBM', count: 1, current: true },
    ]);
    expect(schema.filter(certs, schema.parse('?issuer=other')).map((c) => c.family)).toEqual([
      'ibm',
      'aws',
    ]);
  });
});

describe('hrefs', () => {
  const state = projects.parse('?category=tools&tech=go&tech=python&q=cli');

  it('serialises a state in the facets’ order, empty values left out', () => {
    expect(projects.serialize(state)).toBe('/projects?category=tools&tech=go&tech=python&q=cli');
    expect(projects.serialize(projects.empty())).toBe('/projects');
  });

  it('builds a link from a patch: a value replaces, null clears, a list sets every value', () => {
    expect(projects.hrefFor(state, { category: 'apps' })).toBe(
      '/projects?category=apps&tech=go&tech=python&q=cli',
    );
    expect(projects.hrefFor(state, { category: null, q: null })).toBe(
      '/projects?tech=go&tech=python',
    );
    expect(projects.hrefFor(state, { tech: ['react'] })).toBe(
      '/projects?category=tools&tech=react&q=cli',
    );
  });

  it('round-trips: what it writes reads back as the same state', () => {
    for (const search of ['', '?q=a%20b', '?tech=react&tech=go', '?category=websites&q=x%26y']) {
      const read = projects.parse(search);
      expect(projects.parse(projects.serialize(read).replace('/projects', ''))).toEqual(read);
    }
  });
});

describe('state changes, pure', () => {
  const base = projects.parse('?category=tools&tech=go');

  it('choose replaces a single facet’s value, or clears it with null', () => {
    expect(projects.choose(base, 'category', 'apps').category).toEqual(['apps']);
    expect(projects.choose(base, 'category', null).category).toEqual([]);
    expect(base.category).toEqual(['tools']);
  });

  it('toggle adds or removes one value of a multi-select facet', () => {
    expect(projects.toggle(base, 'tech', 'react').tech).toEqual(['go', 'react']);
    expect(projects.toggle(base, 'tech', 'go').tech).toEqual([]);
    // On a single facet it chooses the value, or clears it when it is the current one.
    expect(projects.toggle(base, 'category', 'apps').category).toEqual(['apps']);
    expect(projects.toggle(base, 'category', 'tools').category).toEqual([]);
    expect(base.tech).toEqual(['go']);
  });
});

describe('sentences', () => {
  it('says what removed everything, facet by facet, after the search', () => {
    expect(projects.noMatchSentence(projects.parse('?q=rust&category=tools'))).toBe(
      'Nothing matches “rust” in Tools.',
    );
    expect(projects.noMatchSentence(projects.parse('?category=apps&tech=go&tech=python'))).toBe(
      'No projects in Apps with Go or Python.',
    );
    expect(projects.noMatchSentence(projects.empty())).toBe('No projects match.');
  });

  it('words the status line: quiet on a first load, then the count', () => {
    const filtered = projects.parse('?tech=go');
    const empty = projects.empty();

    expect(projects.statusText({ state: empty, shown: 5, total: 5, touched: false })).toBe('');
    expect(projects.statusText({ state: filtered, shown: 1, total: 5, touched: false })).toBe(
      'Showing 1 of 5 projects',
    );
    expect(projects.statusText({ state: empty, shown: 5, total: 5, touched: true })).toBe(
      'Showing all 5 projects',
    );
  });
});
