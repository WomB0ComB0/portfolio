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
 * @file /places on the shared filter schema: six category chips in a fixed A to Z order (a
 * category with no place keeps its chip at 0), every old shared link (the Studio label in any
 * case, its + and %20 forms, the slug) resolving to today's kebab slug, 'all', bogus, blank and
 * over-long values (over 100 characters once the blanks around them are trimmed) showing
 * everything, ?q over the name and description only (capped at 100), slug links, disjunctive
 * counts, and a filter that keeps the server's order. Synthetic places.
 */

import { describe, expect, it } from 'vitest';

import {
  placeFilters,
  resolvePlaceCategory,
} from '@/app/(routes)/(main)/(personal)/places/_lib/place-filters';
import type { PlaceItem } from '@/types/places';

/** A synthetic place; only the fields the schema reads matter. */
const place = (
  id: string,
  category: string,
  name = `Venue ${id}`,
  description = `What happened at ${id}.`,
): PlaceItem => ({
  id,
  name,
  description,
  latitude: 40.7,
  longitude: -74,
  category,
  startDate: '2026-08-11',
  endDate: null,
  photos: [],
});

const PLACES: readonly PlaceItem[] = [
  place('a', 'Hackathon', 'Antler NYC', 'A weekend build.'),
  place('b', 'Hackathon'),
  place('c', 'Event', 'Founders Dinner', 'Talked about hackathon judging.'),
  place('d', 'Tech Office'),
  place('e', 'Conference'),
  place('f', 'Mentorship'),
];

const ids = (items: readonly PlaceItem[]): string[] => items.map((item) => item.id);

describe('placeFilters', () => {
  it('lists all six categories A to Z by label, with counts and a 0 chip kept in place', () => {
    const { category } = placeFilters.options(PLACES, placeFilters.empty());

    expect(category.all).toBe(PLACES.length);
    expect(category.options.map(({ slug, label, count }) => [slug, label, count])).toEqual([
      ['conference', 'Conference', 1],
      ['event', 'Event', 1],
      ['hackathon', 'Hackathon', 2],
      ['mentorship', 'Mentorship', 1],
      ['research', 'Research', 0],
      ['tech-office', 'Tech Office', 1],
    ]);
  });

  it.each([
    ['?category=Hackathon', 'hackathon'],
    ['?category=Tech%20Office', 'tech-office'],
    ['?category=Tech+Office', 'tech-office'],
    ['?category=tech%20office', 'tech-office'],
    ['?category=TECH-OFFICE', 'tech-office'],
    ['?category=tech-office', 'tech-office'],
    ['?category=Tech%2BOffice', 'tech-office'],
    ['?category=Tech_Office', 'tech-office'],
  ])('reads the old link %s as %s', (search, slug) => {
    expect(placeFilters.parse(search).category).toEqual([slug]);
  });

  it.each([
    ['all', '?category=all'],
    ['All', '?category=All'],
    ['a bogus value', '?category=Bogus'],
    ['a blank value', '?category='],
    ['a 101-character value', `?category=${'h'.repeat(101)}`],
  ])('shows every place for %s', (_label, search) => {
    const state = placeFilters.parse(search);
    expect(state.category).toEqual([]);
    expect(placeFilters.isFiltered(state)).toBe(false);
    expect(placeFilters.filter(PLACES, state)).toHaveLength(PLACES.length);
  });

  it('drops a value over 100 characters before reading it', () => {
    expect(resolvePlaceCategory(`Hackathon${' '.repeat(92)}`)).toBeNull();
    expect(resolvePlaceCategory('Hackathon')).toBe('hackathon');
  });

  it('reads a value without the blanks around it, as the search is read, then caps it', () => {
    // The kit trims every value before resolving it (and ?q before capping it), so padding is
    // never part of the value: 'Hackathon' and 95 encoded spaces is 104 characters in the URL
    // and 9 as read.
    expect(placeFilters.parse(`?category=Hackathon${'+'.repeat(95)}`).category).toEqual([
      'hackathon',
    ]);
    expect(placeFilters.parse(`?category=${'%20'.repeat(40)}Hackathon`).category).toEqual([
      'hackathon',
    ]);
    expect(placeFilters.parse(`?q=antler${'+'.repeat(120)}`).q).toBe('antler');
    // Text over 100 characters once trimmed is still dropped.
    expect(placeFilters.parse(`?category=Hackathon${'x'.repeat(92)}`).category).toEqual([]);
  });

  it('searches the name and the description, ignoring case, but not the category', () => {
    expect(ids(placeFilters.filter(PLACES, placeFilters.parse('?q=ANTLER')))).toEqual(['a']);
    expect(ids(placeFilters.filter(PLACES, placeFilters.parse('?q=judging')))).toEqual(['c']);
    // "hackathon" is a category label, so only the place whose description says it matches.
    expect(ids(placeFilters.filter(PLACES, placeFilters.parse('?q=hackathon')))).toEqual(['c']);
    expect(placeFilters.filter(PLACES, placeFilters.parse('?q=tech%20office'))).toEqual([]);
  });

  it('caps the search at 100 characters', () => {
    expect(placeFilters.maxLength).toBe(100);
    expect(placeFilters.parse(`?q=${'x'.repeat(140)}`).q).toHaveLength(100);
  });

  it('writes chip links with the slug, and Clear as the bare path', () => {
    const state = placeFilters.parse('?q=nyc');
    expect(placeFilters.hrefFor(placeFilters.empty(), { category: 'tech-office' })).toBe(
      '/places?category=tech-office',
    );
    expect(placeFilters.hrefFor(state, { category: 'hackathon' })).toBe(
      '/places?category=hackathon&q=nyc',
    );
    expect(placeFilters.serialize(placeFilters.empty())).toBe('/places');
  });

  it('keeps the server order: negative orders on the same day, before and after a filter', () => {
    // As placesQuery orders them: the same start date, order -94 then -74, then legacy 0 and 22.
    const ordered = [
      place('late', 'Event'),
      place('earlier', 'Hackathon'),
      place('legacy-0', 'Event'),
      place('legacy-22', 'Hackathon'),
    ];

    expect(ids(placeFilters.filter(ordered, placeFilters.empty()))).toEqual([
      'late',
      'earlier',
      'legacy-0',
      'legacy-22',
    ]);
    expect(ids(placeFilters.filter(ordered, placeFilters.parse('?category=event')))).toEqual([
      'late',
      'legacy-0',
    ]);
    expect(ids(placeFilters.filter(ordered, placeFilters.parse('?q=venue')))).toEqual([
      'late',
      'earlier',
      'legacy-0',
      'legacy-22',
    ]);
  });

  it('counts each chip with the search applied but not the chosen category', () => {
    const state = placeFilters.parse('?category=hackathon&q=hackathon');
    const { category } = placeFilters.options(PLACES, state);

    expect(ids(placeFilters.filter(PLACES, state))).toEqual([]);
    expect(category.all).toBe(1);
    expect(category.options.find((option) => option.slug === 'event')?.count).toBe(1);
    expect(category.options.find((option) => option.slug === 'hackathon')).toMatchObject({
      count: 0,
      current: true,
    });
  });

  it('names the chosen category in the empty state', () => {
    expect(placeFilters.noMatchSentence(placeFilters.parse('?category=research'))).toMatch(
      /in Research/,
    );
  });
});
