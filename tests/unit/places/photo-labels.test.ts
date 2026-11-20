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
 * @file The photos view's words: plurals that read right at one, each grid link's unique name
 * (starting with the card's words as shown, a range's dash included: WCAG 2.5.3), the wall's
 * spoken sentence, and the open photo's alt (its alt text, else its caption, else its place and
 * number).
 */

import { describe, expect, it } from 'vitest';

import {
  gridLinkName,
  gridLinkSuffix,
  photoAlt,
  photoCountLabel,
  photosFromVisits,
  placeMetaShown,
  placeMetaWords,
  shownDates,
  spokenDates,
  wallAnnouncement,
} from '@/app/(routes)/(main)/(personal)/places/photos/_lib/photo-labels';
import type { PhotoPlace, WallPhoto } from '@/types/places';
import { formatDateRange } from '@/utils/date';
import { containsShownWords, startsWithShownWords } from '../../utils/label-in-name';

const PLACE: PhotoPlace = {
  id: 'p1',
  name: 'Antler NYC',
  description: 'Demo day.',
  category: 'Hackathon',
  startDate: '2026-05-19',
  endDate: '2026-05-20',
  photoCount: 5,
};
const photo = (
  index: number,
  caption: string | null = null,
  alt: string | null = null,
): WallPhoto => ({
  key: `p1:${index}`,
  placeId: 'p1',
  index,
  caption,
  alt,
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

describe('shownDates', () => {
  it('is the dates as a card shows them, dash and all, and nothing for an undated place', () => {
    expect(shownDates('2026-05-19', '2026-05-20')).toBe('May 19 – 20, 2026');
    expect(shownDates('2025-12-30', '2026-01-02')).toBe('Dec 30, 2025 – Jan 2, 2026');
    expect(shownDates('2026-05-19', null)).toBe('May 19, 2026');
    expect(shownDates(null, null)).toBeNull();
    expect(shownDates('not a date', null)).toBeNull();
  });

  it('is word for word what formatDateRange writes for the card', () => {
    for (const [start, end] of [
      ['2024-04-20', '2024-04-21'],
      ['2026-07-29', '2026-09-15'],
      ['2025-12-30', '2026-01-02'],
      ['2026-05-19', null],
    ] as const) {
      expect(shownDates(start, end)).toBe(formatDateRange(start, end));
    }
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

describe('placeMetaShown', () => {
  it("is the line under a place's name as the card shows it: its category, then its dates", () => {
    expect(placeMetaShown(PLACE)).toEqual(['Hackathon', 'May 19 – 20, 2026']);
    expect(placeMetaShown({ ...PLACE, endDate: null })).toEqual(['Hackathon', 'May 19, 2026']);
    expect(placeMetaShown({ ...PLACE, startDate: null, endDate: null })).toEqual(['Hackathon']);
    expect(placeMetaShown({ ...PLACE, startDate: 'not a date' })).toEqual(['Hackathon']);
  });
});

describe('placeMetaWords', () => {
  it("is the line under a place's name in words: its category, then its dates as heard", () => {
    expect(placeMetaWords(PLACE)).toEqual(['Hackathon', 'May 19 to 20, 2026']);
    expect(placeMetaWords({ ...PLACE, endDate: null })).toEqual(['Hackathon', 'May 19, 2026']);
    expect(placeMetaWords({ ...PLACE, startDate: null, endDate: null })).toEqual(['Hackathon']);
  });
});

// Verify 2026-11-20 R2: built from the card's text nodes, Chromium ran the category into the
// dates and put a space before the comma ('IEEE LISAT 2024 ResearchNov 15, 2024 , photo 3 of 3').
// The whole name is now one string, its parts joined by a comma and a space.
describe('gridLinkName', () => {
  it('names the place, its category and dates, then the photo, each part after a comma', () => {
    expect(
      gridLinkName({
        fig: null,
        name: 'IEEE LISAT 2024',
        meta: ['Research', 'Nov 15, 2024'],
        suffix: ', photo 3 of 3: Devices on a table within a dining area',
      }),
    ).toBe(
      'IEEE LISAT 2024, Research, Nov 15, 2024, photo 3 of 3: Devices on a table within a dining area',
    );
  });

  it('starts with the figure number a later card in a run shows', () => {
    expect(
      gridLinkName({
        fig: 2,
        name: 'SparkMind',
        meta: ['Education', 'Jun – Sep 2024'],
        suffix: ', image 2 of 3',
      }),
    ).toBe('Fig. 2, SparkMind, Education, Jun – Sep 2024, image 2 of 3');
  });

  // The CI's axe run (label-content-name-mismatch, 2026-11-20): 'Apr 20 to 21, 2024' in the name
  // where the card shows 'Apr 20 – 21, 2024'. Words compare without punctuation, so the dash is
  // nothing and 'to' is a word the card does not show.
  it('starts with the card’s words, dates as shown, where "to" for the dash failed WCAG 2.5.3', () => {
    const card = 'Antler NYC Hackathon · May 19 – 20, 2026';
    const name = gridLinkName({
      fig: null,
      name: PLACE.name,
      meta: placeMetaShown(PLACE),
      suffix: gridLinkSuffix(photo(1), PLACE),
    });

    expect(name).toBe('Antler NYC, Hackathon, May 19 – 20, 2026, photo 1 of 5');
    expect(startsWithShownWords(name, card)).toBe(true);
    const spoken = gridLinkName({
      fig: null,
      name: PLACE.name,
      meta: placeMetaWords(PLACE),
      suffix: gridLinkSuffix(photo(1), PLACE),
    });
    expect(containsShownWords(spoken, card)).toBe(false);
  });

  it('leaves out an empty or blank part instead of doubling a comma', () => {
    expect(
      gridLinkName({ fig: null, name: 'Antler NYC', meta: ['', ' '], suffix: ', photo 1 of 5' }),
    ).toBe('Antler NYC, photo 1 of 5');
    expect(
      gridLinkName({ fig: null, name: ' Antler NYC ', meta: [' Hackathon '], suffix: '' }),
    ).toBe('Antler NYC, Hackathon');
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

  // Audit 2026-11-20 #6: Studio's Alternative Text says what the photo shows; it comes first.
  it("is the photo's own alt text before its caption", () => {
    expect(photoAlt(photo(3, 'Opening night', 'A crowd around a robot arm'), PLACE)).toBe(
      'A crowd around a robot arm',
    );
    expect(photoAlt(photo(4, null, 'Badges on a lanyard'), PLACE)).toBe('Badges on a lanyard');
  });
});

describe('the photo’s words where its image is decorative', () => {
  // The wall's and the grid's images have empty alts: the announcement and the link name are
  // their text alternatives, so they describe the photo the same way.
  it('use its alt text before its caption in the grid link and the wall announcement', () => {
    const described = photo(3, 'Opening night', 'A crowd around a robot arm');

    expect(gridLinkSuffix(described, PLACE)).toBe(', photo 3 of 5: A crowd around a robot arm');
    expect(wallAnnouncement(described, PLACE)).toBe(
      'Antler NYC, photo 3 of 5: A crowd around a robot arm. Hackathon, May 19 to 20, 2026',
    );
  });
});
