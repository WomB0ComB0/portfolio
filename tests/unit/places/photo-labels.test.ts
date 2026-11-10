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
 * @file The photos view's words: plurals that read right at one, each grid link's unique name,
 * the wall's spoken sentence, and the open photo's alt (its caption, else its place and number).
 */

import { describe, expect, it } from 'vitest';

import {
  gridLinkSuffix,
  photoAlt,
  photoCountLabel,
  photosFromVisits,
  spokenDates,
  wallAnnouncement,
} from '@/app/(routes)/(main)/(personal)/places/photos/_lib/photo-labels';
import type { PhotoPlace, WallPhoto } from '@/types/places';

const PLACE: PhotoPlace = {
  id: 'p1',
  name: 'Antler NYC',
  description: 'Demo day.',
  category: 'Hackathon',
  startDate: '2026-05-19',
  endDate: '2026-05-20',
  photoCount: 5,
};
const photo = (index: number, caption: string | null = null): WallPhoto => ({
  key: `p1:${index}`,
  placeId: 'p1',
  index,
  caption,
  ratio: 4 / 3,
  focus: null,
  thumb: 'https://cdn.sanity.io/t.jpg',
  full: 'https://cdn.sanity.io/f.jpg',
});

describe('plurals', () => {
  it('reads right at one', () => {
    expect(photoCountLabel(1)).toBe('1 photo');
    expect(photoCountLabel(266)).toBe('266 photos');
    expect(photosFromVisits(1, 1)).toBe('1 photo from 1 past visit');
    expect(photosFromVisits(266, 51)).toBe('266 photos from 51 past visits');
  });
});

describe('spokenDates', () => {
  it('says a range with "to", and nothing for an undated place', () => {
    expect(spokenDates('2026-05-19', '2026-05-20')).toBe('May 19 to 20, 2026');
    expect(spokenDates('2026-05-19', null)).toBe('May 19, 2026');
    expect(spokenDates(null, null)).toBeNull();
    expect(spokenDates('not a date', null)).toBeNull();
  });
});

describe('gridLinkSuffix', () => {
  it('numbers the photo in its place and adds the caption', () => {
    expect(gridLinkSuffix(photo(2), PLACE)).toBe(', photo 2 of 5');
    expect(gridLinkSuffix(photo(3, 'Opening night'), PLACE)).toBe(', photo 3 of 5: Opening night');
  });
});

describe('wallAnnouncement', () => {
  it('says the place, the number, the caption, the category and the dates', () => {
    expect(wallAnnouncement(photo(3, 'Opening night'), PLACE)).toBe(
      'Antler NYC, photo 3 of 5: Opening night. Hackathon, May 19 to 20, 2026',
    );
    expect(wallAnnouncement(photo(1), { ...PLACE, startDate: null, endDate: null })).toBe(
      'Antler NYC, photo 1 of 5. Hackathon',
    );
  });
});

describe('photoAlt', () => {
  it('is the caption, else the place and the number', () => {
    expect(photoAlt(photo(3, 'Opening night'), PLACE)).toBe('Opening night');
    expect(photoAlt(photo(2), PLACE)).toBe('Photo 2 of 5 at Antler NYC');
  });
});
