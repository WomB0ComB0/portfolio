/**
 * Copyright 2025 Mike Odnis
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

import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { PlaceSchema, PlacesSchema } from '../../../src/hooks/sanity/schemas';

const basePlace = {
  _id: 'place-test',
  _type: 'place',
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-01-01T00:00:00Z',
  _rev: 'rev',
  name: 'Test Venue',
  description: 'A test venue.',
  category: 'Event',
  latitude: 40.75,
  longitude: -73.98,
  order: 0,
  featured: false,
};

const decodePlace = Schema.decodeUnknownSync(PlaceSchema);

describe('PlaceSchema dates', () => {
  it('keeps valid YYYY-MM-DD dates', () => {
    const place = decodePlace({ ...basePlace, startDate: '2026-05-19', endDate: '2026-05-20' });
    expect(place.startDate).toBe('2026-05-19');
    expect(place.endDate).toBe('2026-05-20');
  });

  it('leaves absent dates absent and null dates null', () => {
    expect(decodePlace(basePlace).startDate).toBeUndefined();
    expect(decodePlace({ ...basePlace, startDate: null }).startDate).toBeNull();
  });

  it.each([
    ['slashes', '2026/05/12'],
    ['prose', 'May 12, 2026'],
    ['impossible day', '2026-02-30'],
    ['datetime', '2026-05-12T10:00:00Z'],
    ['empty', ''],
  ])('normalizes a malformed date (%s) to null instead of failing', (_label, value) => {
    const place = decodePlace({ ...basePlace, startDate: value, endDate: value });
    expect(place.startDate).toBeNull();
    expect(place.endDate).toBeNull();
  });

  it('still decodes the whole list when one document has a malformed date', () => {
    const places = Schema.decodeUnknownSync(PlacesSchema)([
      { ...basePlace, _id: 'good', startDate: '2026-08-21' },
      { ...basePlace, _id: 'bad', startDate: 'not-a-date' },
    ]);
    expect(places.map((p) => p.startDate)).toEqual(['2026-08-21', null]);
  });

  it('still rejects a non-string date value', () => {
    expect(() => decodePlace({ ...basePlace, startDate: 20260519 })).toThrow();
  });
});
