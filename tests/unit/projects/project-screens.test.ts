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
 * @file The Screens view's data and words, as the /places photo parts take them: every image of
 * the projects kept, in their order, numbered within its project, with the alt text as its
 * caption; each project a place (its title, kind and image count, never a date); and this page's
 * words (images of projects): a unique name for each grid link, the wall's spoken sentence, the
 * open view's caption and alt, the sheet's title. Synthetic values only.
 */

import { describe, expect, it } from 'vitest';

import {
  focusPosition,
  imageCount,
  imagesFromProjects,
  screenAlt,
  screenAnnouncement,
  screenCaption,
  screenProjectsOf,
  screenSuffix,
  screensOf,
  screensSheetTitle,
} from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-screens';
import type { WallPhoto } from '@/types/places';

const image = (name: string, alt: string | null = null) => ({
  src: `https://cdn.example/${name}.jpg`,
  ratio: 16 / 9,
  alt,
  focus: null,
});

const ENTRIES = [
  {
    id: 'spark',
    title: 'SparkMind',
    description: 'Learns with you.',
    kindLabels: ['Education'],
    period: 'Jun – Sep 2024',
    images: [image('cover', 'The hero'), image('demo')],
  },
  {
    id: 'empty',
    title: 'Empty',
    description: '',
    kindLabels: [],
    period: null,
    images: [],
  },
  {
    id: 'ktp',
    title: 'KTP',
    description: 'A national site.',
    kindLabels: [],
    period: null,
    images: [image('home')],
  },
];

const PROJECTS = screenProjectsOf(ENTRIES);

/** The fixture's first two images: SparkMind's captioned cover and its uncaptioned demo. */
function sparkImages(): readonly [WallPhoto, WallPhoto] {
  const [hero, demo] = screensOf(ENTRIES);
  if (!hero || !demo) throw new Error('the fixture has two SparkMind images');
  return [hero, demo];
}

const spark = () => {
  const project = PROJECTS.get('spark');
  if (!project) throw new Error('SparkMind has images');
  return project;
};

describe('screensOf and screenProjectsOf', () => {
  it('lists every image in project order, numbered within its project', () => {
    expect(screensOf(ENTRIES).map(({ key, placeId, index }) => [key, placeId, index])).toEqual([
      ['spark:1', 'spark', 1],
      ['spark:2', 'spark', 2],
      ['ktp:1', 'ktp', 1],
    ]);
  });

  it('carries the alt text as the caption, the shape and the whole image', () => {
    expect(sparkImages()[0]).toMatchObject({
      caption: 'The hero',
      ratio: 16 / 9,
      thumb: 'https://cdn.example/cover.jpg',
      full: 'https://cdn.example/cover.jpg',
    });
  });

  it('makes each project with images a place: its title, kind, count and byline, no dates', () => {
    expect([...PROJECTS.keys()]).toEqual(['spark', 'ktp']);
    expect(spark()).toMatchObject({
      name: 'SparkMind',
      category: 'Education',
      photoCount: 2,
      startDate: null,
      endDate: null,
      meta: ['Education', 'Jun – Sep 2024'],
    });
    expect(PROJECTS.get('ktp')?.meta).toEqual([]);
  });
});

describe('screen words', () => {
  it('ends each grid link’s name with its number and caption, so no two read the same', () => {
    const [hero, demo] = sparkImages();

    expect(screenSuffix(hero, spark())).toBe(', image 1 of 2: The hero');
    expect(screenSuffix(demo, spark())).toBe(', image 2 of 2');
  });

  it('says on the wall what an image is, with its project’s byline read as words', () => {
    const [hero, demo] = sparkImages();

    expect(screenAnnouncement(hero, spark(), spark().meta)).toBe(
      'SparkMind, image 1 of 2: The hero. Education, Jun to Sep 2024',
    );
    expect(screenAnnouncement(demo, spark(), [])).toBe('SparkMind, image 2 of 2');
  });

  it('captions the open image: the byline and its number shown, and heard as words', () => {
    const [hero, demo] = sparkImages();

    expect(screenCaption(hero, spark(), spark().meta)).toEqual({
      meta: 'Education · Jun – Sep 2024 · Image 1 of 2',
      heard: 'Education, Jun to Sep 2024, image 1 of 2',
      words: 'The hero',
      alt: 'The hero',
    });
    expect(screenCaption(demo, spark(), [])).toMatchObject({
      meta: 'Image 2 of 2',
      heard: 'image 2 of 2',
      words: null,
    });
  });

  it('falls back to a numbered alt when Studio has none', () => {
    const [hero, demo] = sparkImages();

    expect(screenAlt(hero, spark())).toBe('The hero');
    expect(screenAlt(demo, spark())).toBe('Image 2 of 2 from SparkMind');
  });

  it('counts images and projects in sentence case', () => {
    expect(imageCount(1)).toBe('1 image');
    expect(imagesFromProjects(65, 25)).toBe('65 images from 25 projects');
    expect(imagesFromProjects(1, 1)).toBe('1 image from 1 project');
    expect(screensSheetTitle(65, 25)).toEqual({ lead: '65 images', sub: 'from 25 projects' });
  });

  it('places the picture on its focus, centred without one', () => {
    expect(focusPosition(null)).toBe('50% 50%');
    expect(focusPosition({ x: 0.3, y: 0.7 })).toBe('30% 70%');
  });
});
