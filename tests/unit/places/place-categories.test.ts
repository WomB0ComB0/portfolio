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
 * @file The six place categories have one source (src/lib/places/categories.ts): the Effect
 * PlaceSchema accepts exactly them, the Studio schema lists exactly them in the same order (it is
 * not changed here, since that would need a Studio deploy), and each has a unique kebab slug that
 * maps back to its label.
 */

import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { PlaceSchema } from '@/hooks/sanity/schemas';
import {
  PLACE_CATEGORIES,
  PLACE_CATEGORY_SLUGS,
  placeCategoryLabel,
  placeCategorySlug,
} from '@/lib/places/categories';
import { placeType } from '@/sanity/schemaTypes/place';

/** A synthetic place, shaped like the documents the places query returns. */
const BASE = {
  _id: 'place-test',
  _type: 'place',
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-01-01T00:00:00Z',
  _rev: 'rev',
  name: 'Synthetic Venue',
  description: 'A place used only by this test.',
  latitude: 40.75,
  longitude: -73.98,
  order: 0,
  featured: false,
};

const decode = Schema.decodeUnknownEither(PlaceSchema);

/** The Studio field's options.list, read off the field as found. */
const studioValues = (): readonly unknown[] => {
  const field = placeType.fields.find(({ name }) => name === 'category') as
    | { readonly options?: { readonly list?: readonly { readonly value: unknown }[] } }
    | undefined;
  return (field?.options?.list ?? []).map(({ value }) => value);
};

describe('place categories', () => {
  it('are the Studio list, in its order', () => {
    expect(PLACE_CATEGORIES).toEqual([
      'Hackathon',
      'Conference',
      'Research',
      'Tech Office',
      'Mentorship',
      'Event',
    ]);
    expect(studioValues()).toEqual([...PLACE_CATEGORIES]);
  });

  it.each(PLACE_CATEGORIES)('PlaceSchema accepts %s', (category) => {
    const decoded = decode({ ...BASE, category });
    expect(decoded._tag).toBe('Right');
  });

  it('PlaceSchema rejects a category outside the list', () => {
    expect(decode({ ...BASE, category: 'Other' })._tag).toBe('Left');
    expect(decode({ ...BASE, category: 'tech-office' })._tag).toBe('Left');
  });

  it('have unique kebab slugs, A to Z by label, that map back to their labels', () => {
    expect(PLACE_CATEGORY_SLUGS).toEqual([
      'conference',
      'event',
      'hackathon',
      'mentorship',
      'research',
      'tech-office',
    ]);
    expect(new Set(PLACE_CATEGORY_SLUGS).size).toBe(PLACE_CATEGORIES.length);
    for (const label of PLACE_CATEGORIES) {
      expect(placeCategoryLabel(placeCategorySlug(label))).toBe(label);
    }
  });

  it('folds case, spaces, plus signs and underscores into one slug', () => {
    for (const raw of [
      'Tech Office',
      'tech office',
      'TECH  OFFICE',
      'Tech+Office',
      'tech_office',
    ]) {
      expect(placeCategorySlug(raw)).toBe('tech-office');
    }
    expect(placeCategorySlug('  Hackathon ')).toBe('hackathon');
  });

  it('names no label for an unknown slug, even one on Object.prototype', () => {
    expect(placeCategoryLabel('other')).toBeNull();
    expect(placeCategoryLabel('constructor')).toBeNull();
    expect(placeCategoryLabel('__proto__')).toBeNull();
  });
});
