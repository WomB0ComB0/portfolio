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
 * @file A project's screens (case-screens.ts): the cover then the gallery, each asset once, at
 * its real shape (less a Studio crop), with Studio's own words or none; how the cover is framed
 * (a browser frame only for a web page's shape with a live site); how the next screen joins it
 * (a phone screenshot in front, anything else behind); and the Screens section, which leaves out
 * the cover the header shows: a figure for one screen, a strip for two, a contact sheet from three.
 * The cover link's name starts with the address its browser frame shows (WCAG 2.5.3).
 */

import { describe, expect, it } from 'vitest';
import {
  coverFrame,
  coverLabel,
  isCut,
  openLabel,
  peekStyle,
  type Screen,
  screensCount,
  screensLayout,
  screensOf,
  sectionScreens,
  tileRatio,
} from '@/app/(routes)/(main)/(professioal)/projects/_components/detail/case-screens';
import type { Project } from '@/hooks/sanity/schemas';
import { startsWithShownWords } from '../../utils/label-in-name';

type SanityImage = NonNullable<Project['image']>;

const image = (
  name: string,
  size: string,
  extra: Partial<Omit<SanityImage, '_type' | 'asset'>> = {},
): SanityImage => ({
  _type: 'image',
  asset: { _type: 'reference', _ref: `image-${name}-${size}-jpg` },
  ...extra,
});

const screenOf = (size: string): Screen => {
  const [screen] = screensOf({ image: image('x', size) });
  if (!screen) throw new Error('no screen');
  return screen;
};

describe('screensOf', () => {
  it('lists the cover, then the gallery, each asset once', () => {
    const cover = image('cover', '3200x1800', { alt: 'Home page' });
    const screens = screensOf({
      image: cover,
      images: [cover, image('second', '780x1688', { alt: 'On a phone' })],
    });

    expect(screens.map((screen) => screen.key)).toEqual([
      'image-cover-3200x1800-jpg',
      'image-second-780x1688-jpg',
    ]);
    expect(screens[1]).toMatchObject({ width: 780, height: 1688, words: 'On a phone' });
  });

  it("takes the caption first, then the alt text, and invents nothing when there's neither", () => {
    const screens = screensOf({
      images: [
        image('a', '100x100', { caption: ' Demo  day ', alt: 'ignored' }),
        image('b', '100x100', { alt: 'The alt' }),
        image('c', '100x100'),
      ],
    });

    expect(screens.map((screen) => screen.words)).toEqual(['Demo day', 'The alt', null]);
  });

  it("reads a Studio crop into the screen's shape", () => {
    const [screen] = screensOf({
      image: image('a', '2000x1000', { crop: { top: 0, bottom: 0.5, left: 0, right: 0 } }),
    });

    expect(screen).toMatchObject({ width: 2000, height: 500, ratio: 4 });
  });

  it('leaves out an image whose asset id carries no size', () => {
    const broken: SanityImage = {
      _type: 'image',
      asset: { _type: 'reference', _ref: 'image-a-jpg' },
    };

    expect(screensOf({ image: broken, images: null })).toEqual([]);
    expect(screensOf({})).toEqual([]);
  });
});

describe('coverFrame', () => {
  it('frames a web page with a live site in a browser', () => {
    expect(coverFrame(screenOf('3200x1800'), true)).toBe('browser');
  });

  it('shows a cover as a print without a live site, or when it is not a page shape', () => {
    expect(coverFrame(screenOf('3200x1800'), false)).toBe('print');
    expect(coverFrame(screenOf('512x512'), true)).toBe('print');
    expect(coverFrame(screenOf('768x942'), true)).toBe('print');
  });
});

describe('peekStyle', () => {
  it('stands a phone screenshot in front of the cover', () => {
    expect(peekStyle(screenOf('780x1688'))).toBe('phone');
  });

  it('peeks anything else from behind, a desktop page captured whole included', () => {
    expect(peekStyle(screenOf('3200x1800'))).toBe('behind');
    expect(peekStyle(screenOf('2880x6186'))).toBe('behind');
    expect(peekStyle(screenOf('2880x3488'))).toBe('behind');
  });
});

describe('the Screens section', () => {
  it('leaves out the cover, keeping each screen at its place among all of them', () => {
    const screens = screensOf({
      image: image('cover', '3200x1800'),
      images: [image('two', '3200x1800'), image('three', '780x1688')],
    });

    expect(sectionScreens(screens).map(({ screen, index }) => [screen.key, index])).toEqual([
      ['image-two-3200x1800-jpg', 1],
      ['image-three-780x1688-jpg', 2],
    ]);
  });

  it('has nothing for a project with only a cover, or none', () => {
    expect(sectionScreens(screensOf({ image: image('cover', '3200x1800') }))).toEqual([]);
    expect(sectionScreens([])).toEqual([]);
  });

  it('is a figure for one screen, a strip for two, a contact sheet from three, none for none', () => {
    expect(screensLayout(0)).toBeNull();
    expect(screensLayout(1)).toBe('single');
    expect(screensLayout(2)).toBe('strip');
    expect(screensLayout(3)).toBe('sheet');
    expect(screensLayout(6)).toBe('sheet');
  });
});

describe('tiles', () => {
  it("keeps a screen's own shape, a phone's included", () => {
    expect(tileRatio(1600 / 900)).toBeCloseTo(1.7778, 3);
    expect(tileRatio(780 / 1688)).toBeCloseTo(0.462, 3);
    expect(isCut(780 / 1688)).toBe(false);
  });

  it('cuts a full-page capture taller than a phone to a phone shape, from its top', () => {
    expect(tileRatio(2880 / 8482)).toBe(0.46);
    expect(isCut(2880 / 8482)).toBe(true);
  });
});

describe('words', () => {
  it("names each link by its place and Studio's words", () => {
    expect(openLabel(1, 4, 'Sponsorship tiers')).toBe('Open screen 2 of 4: Sponsorship tiers');
    expect(openLabel(2, 7, null)).toBe('Open screen 3 of 7');
    expect(openLabel(0, 1, null)).toBe('Open the cover');
  });

  // The CI's axe run, 2026-11-20 (label-content-name-mismatch, desktop and phone): the cover's
  // browser frame shows the live address, which its name ('Open screen 1 of 2: …') left out.
  it('starts the cover’s name with the address its browser frame shows, then says what it opens', () => {
    expect(coverLabel(2, 'The live map', 'grepo.example.com')).toBe(
      'grepo.example.com, open screen 1 of 2: The live map',
    );
    expect(coverLabel(4, null, 'duo.example.vercel.app')).toBe(
      'duo.example.vercel.app, open screen 1 of 4',
    );
    expect(coverLabel(1, 'Solo home', 'solo.example.dev')).toBe(
      'solo.example.dev, open the cover: Solo home',
    );
    expect(
      startsWithShownWords(coverLabel(2, 'The live map', 'grepo.example.com'), 'grepo.example.com'),
    ).toBe(true);
  });

  it('names a print cover, which shows no words, as any screen', () => {
    expect(coverLabel(2, 'The live map', null)).toBe(openLabel(0, 2, 'The live map'));
    expect(coverLabel(1, null, null)).toBe('Open the cover');
  });

  it('counts the screens for the note under the cover', () => {
    expect(screensCount(1)).toBe('1 screen');
    expect(screensCount(4)).toBe('4 screens');
  });
});
