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
 * @file The order of /projects: the Featured group first (the ranked projects once any rank
 * exists, else the projects switched to Featured, in Studio display order), then the years
 * newest first, then Undated, each project exactly once. Synthetic projects only.
 */

import { describe, expect, it } from 'vitest';

import {
  FEATURED_FALLBACK_MAX,
  FEATURED_GROUP,
  featuredOf,
  groupInOrder,
  groupLabel,
  type OrderableProject,
  orderProjects,
  UNDATED_GROUP,
} from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-order';

/** A synthetic project with only what ordering reads. */
const p = (_id: string, extra: Partial<Omit<OrderableProject, '_id'>> = {}): OrderableProject => ({
  _id,
  title: _id.toUpperCase(),
  featured: false,
  order: 0,
  startDate: null,
  ...extra,
});

const ids = (items: readonly { readonly item: OrderableProject }[]): string[] =>
  items.map(({ item }) => item._id);

describe('featuredOf', () => {
  it('with no rank anywhere, is the projects switched to Featured, in Studio order', () => {
    const projects = [
      p('late', { featured: true, order: 2, startDate: '2025-01-01' }),
      p('plain', { order: 0, startDate: '2026-01-01' }),
      p('newer', { featured: true, order: 1, startDate: '2025-06-01' }),
      p('older', { featured: true, order: 1, startDate: '2023-06-01' }),
    ];

    expect(featuredOf(projects).map(({ _id }) => _id)).toEqual(['newer', 'older', 'late']);
  });

  it('once any project has a rank, is only the ranked projects, lowest first', () => {
    const projects = [
      p('switched', { featured: true, order: 0 }),
      p('second', { featuredRank: 2 }),
      p('first', { featuredRank: 1, featured: false }),
      p('tie-b', { featuredRank: 3, order: 1, title: 'B' }),
      p('tie-a', { featuredRank: 3, order: 1, title: 'A' }),
    ];

    expect(featuredOf(projects).map(({ _id }) => _id)).toEqual([
      'first',
      'second',
      'tie-a',
      'tie-b',
    ]);
  });

  it('breaks rank ties by display order, then the newer start', () => {
    const projects = [
      p('a', { featuredRank: 1, order: 2 }),
      p('b', { featuredRank: 1, order: 1, startDate: '2020-01-01' }),
      p('c', { featuredRank: 1, order: 1, startDate: '2024-01-01' }),
    ];

    expect(featuredOf(projects).map(({ _id }) => _id)).toEqual(['c', 'b', 'a']);
  });

  it('with no rank anywhere, keeps only the first four switched to Featured (as /certifications)', () => {
    const projects = Array.from({ length: 6 }, (_, index) =>
      p(`f${index}`, { featured: true, order: index, startDate: `202${index}-01-01` }),
    );

    expect(FEATURED_FALLBACK_MAX).toBe(4);
    expect(featuredOf(projects).map(({ _id }) => _id)).toEqual(['f0', 'f1', 'f2', 'f3']);
  });

  it('once ranks exist, features every ranked project, uncapped (the owner chooses them)', () => {
    const projects = Array.from({ length: 6 }, (_, index) =>
      p(`r${index}`, { featuredRank: index + 1 }),
    );

    expect(featuredOf(projects)).toHaveLength(6);
  });

  it('ignores a null rank', () => {
    const projects = [p('a', { featured: true, featuredRank: null }), p('b')];

    expect(featuredOf(projects).map(({ _id }) => _id)).toEqual(['a']);
  });
});

describe('orderProjects', () => {
  const projects = [
    p('undated'),
    p('y2023', { startDate: '2023-04-01' }),
    p('y2025-mar', { startDate: '2025-03-01' }),
    p('feat', { featured: true, startDate: '2025-09-01' }),
    p('y2025-nov', { startDate: '2025-11-01' }),
    p('y2025-nov-b', { startDate: '2025-11-01', order: -1 }),
  ];

  it('puts Featured first, then years newest first with Undated last', () => {
    const ordered = orderProjects(projects);

    expect(ids(ordered)).toEqual([
      'feat',
      'y2025-nov-b',
      'y2025-nov',
      'y2025-mar',
      'y2023',
      'undated',
    ]);
    expect(ordered.map(({ group }) => group)).toEqual([
      FEATURED_GROUP,
      '2025',
      '2025',
      '2025',
      '2023',
      UNDATED_GROUP,
    ]);
  });

  it('lists every project exactly once', () => {
    const ordered = ids(orderProjects(projects));

    expect(ordered).toHaveLength(projects.length);
    expect(new Set(ordered).size).toBe(projects.length);
  });

  it('has no Featured group when nothing is featured or ranked', () => {
    const ordered = orderProjects([p('a', { startDate: '2024-01-01' }), p('b')]);

    expect(ordered.map(({ group }) => group)).toEqual(['2024', UNDATED_GROUP]);
  });

  it('puts the switched-to-Featured projects past the first four back under their years', () => {
    const projects = Array.from({ length: 6 }, (_, index) =>
      p(`f${index}`, { featured: true, order: index, startDate: `202${index}-01-01` }),
    );

    expect(orderProjects(projects).map(({ item, group }) => `${item._id}:${group}`)).toEqual([
      `f0:${FEATURED_GROUP}`,
      `f1:${FEATURED_GROUP}`,
      `f2:${FEATURED_GROUP}`,
      `f3:${FEATURED_GROUP}`,
      'f5:2025',
      'f4:2024',
    ]);
  });

  it('keeps a ranked project out of its year once it is featured by rank', () => {
    const ordered = orderProjects([
      p('ranked', { featuredRank: 1, startDate: '2024-01-01' }),
      p('switched', { featured: true, startDate: '2024-02-01' }),
    ]);

    expect(ordered.map(({ item, group }) => `${item._id}:${group}`)).toEqual([
      `ranked:${FEATURED_GROUP}`,
      'switched:2024',
    ]);
  });
});

describe('groupInOrder and groupLabel', () => {
  it('groups by key in the order first seen, keeping each group in the given order', () => {
    const groups = groupInOrder(['a1', 'b1', 'a2', 'c1', 'b2'], (value) => value[0] ?? '');

    expect(groups).toEqual([
      { key: 'a', items: ['a1', 'a2'] },
      { key: 'b', items: ['b1', 'b2'] },
      { key: 'c', items: ['c1'] },
    ]);
  });

  it('names the groups in words', () => {
    expect(groupLabel(FEATURED_GROUP)).toBe('Featured');
    expect(groupLabel(UNDATED_GROUP)).toBe('Undated');
    expect(groupLabel('2024')).toBe('2024');
  });
});
