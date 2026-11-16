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
 * @file The Screens view's data and words, pure and server-safe. The view is the /places photos
 * view's own parts (the wall, the touch sheet, the grid and the open view), so every image of
 * every project the filters keep becomes a photo as they take it (in page order: a project's
 * cover, then its gallery), each project a place as they take it (its title, its kind, how many
 * images; never a date, as its period is already a word), and the words they say are this
 * page's: images of projects, not photos of visits. Sentence case; the counts say images, since
 * not every picture is a screen (a logo, a diagram).
 */

import { countOf } from '@/components/console/folio/byline-items';
import type { PhotoPlace, WallPhoto } from '@/types/places';
import type { ImageFocus, ProjectEntry } from './project-index';
import { PROJECT_NOUN } from './project-text';

/** A project as the photo parts take a place, with the byline they show under its name. */
export interface ScreenProject extends PhotoPlace {
  /** Its kind and its period: ['Public Safety', 'Apr 2026 – now']. */
  readonly meta: readonly string[];
}

/** What the open view says under an image's project, and the image's alt. */
export interface ScreenCaption {
  /** As shown: 'Public Safety · Apr 2026 – now · Image 1 of 2'. */
  readonly meta: string;
  /** As heard: 'Public Safety, Apr 2026 to now, image 1 of 2'. */
  readonly heard: string;
  /** The image's Studio alt text, or null. */
  readonly words: string | null;
  /** Its alt text, else 'Image 2 of 3 from SparkMind'. */
  readonly alt: string;
}

const IMAGE_NOUN = { one: 'image', many: 'images' } as const;
/** The visual range separator, and what a screen reader hears instead. */
const RANGE_SEPARATOR = ' – ';
const SPOKEN_SEPARATOR = ' to ';

/** The lines under the wall, which it points to with aria-describedby (as on /places). */
export const SCREENS_WALL_HINTS = {
  page: 'Drag in any direction, or use the arrow keys once it has focus; Enter opens an image.',
  sheet: 'Drag to explore; tap an image to open it.',
} as const;

/** What the wall is called to a screen reader. */
export const SCREENS_WALL_ROLE = 'image wall';
/** The grid's name, and the open view's link to a project. */
export const SCREENS_GRID_LABEL = 'Images';
export const OPEN_PROJECT_LABEL = 'Open project';

/** Every image of these projects, in their order, as the photo parts take a photo. */
export function screensOf(entries: readonly Pick<ProjectEntry, 'id' | 'images'>[]): WallPhoto[] {
  return entries.flatMap(({ id, images }) =>
    images.map((image, at) => ({
      key: `${id}:${at + 1}`,
      placeId: id,
      index: at + 1,
      caption: image.alt,
      ratio: image.ratio,
      focus: image.focus,
      // The whole image; next/image sizes it for the card and for the open view.
      thumb: image.src,
      full: image.src,
    })),
  );
}

/** The projects with images, by id, as the photo parts take places. */
export function screenProjectsOf(
  entries: readonly Pick<
    ProjectEntry,
    'id' | 'title' | 'description' | 'kindLabels' | 'period' | 'images'
  >[],
): ReadonlyMap<string, ScreenProject> {
  return new Map(
    entries
      .filter((entry) => entry.images.length > 0)
      .map((entry) => [
        entry.id,
        {
          id: entry.id,
          name: entry.title,
          description: entry.description,
          category: entry.kindLabels[0] ?? '',
          startDate: null,
          endDate: null,
          photoCount: entry.images.length,
          meta: [entry.kindLabels[0], entry.period].filter((part): part is string => Boolean(part)),
        },
      ]),
  );
}

/** '1 image', '65 images'. */
export const imageCount = (count: number): string => countOf(count, IMAGE_NOUN);

/** '65 images from 25 projects'. */
export const imagesFromProjects = (images: number, projects: number): string =>
  `${imageCount(images)} from ${countOf(projects, PROJECT_NOUN)}`;

/** The touch sheet's title: '65 images' over 'from 25 projects'. */
export const screensSheetTitle = (
  images: number,
  projects: number,
): { readonly lead: string; readonly sub: string } => ({
  lead: imageCount(images),
  sub: `from ${countOf(projects, PROJECT_NOUN)}`,
});

/** A byline as heard: its parts joined by commas, a range read as 'to'. */
const heardMeta = (meta: readonly string[]): string =>
  meta.map((part) => part.replace(RANGE_SEPARATOR, SPOKEN_SEPARATOR)).join(', ');

/** 'image 2 of 3', with ': <caption>' when it has one. */
const numbered = (photo: WallPhoto, place: PhotoPlace): string =>
  `image ${photo.index} of ${place.photoCount}${photo.caption ? `: ${photo.caption}` : ''}`;

/**
 * The hidden end of a grid link's name, after the project's name and byline it shows, so every
 * image of one project has a name of its own: ', image 2 of 3: The demo video'.
 */
export const screenSuffix = (photo: WallPhoto, place: PhotoPlace): string =>
  `, ${numbered(photo, place)}`;

/**
 * What the wall's live region says for an image: 'SparkMind, image 2 of 3: The demo video.
 * Education, Jun to Sep 2024'.
 */
export function screenAnnouncement(
  photo: WallPhoto,
  place: PhotoPlace,
  meta: readonly string[],
): string {
  const head = `${place.name}, ${numbered(photo, place)}`;
  return meta.length === 0 ? head : `${head}. ${heardMeta(meta)}`;
}

/** The open image's alt: its caption, else 'Image 2 of 3 from SparkMind'. */
export const screenAlt = (photo: WallPhoto, place: PhotoPlace): string =>
  photo.caption ?? `Image ${photo.index} of ${place.photoCount} from ${place.name}`;

/** An image's focus as an object-position ('30% 70%'); centred without one. */
export const focusPosition = (focus: ImageFocus | null): string =>
  focus ? `${focus.x * 100}% ${focus.y * 100}%` : '50% 50%';

/** The open view's caption: the project's byline and the image's number, its words, its alt. */
export function screenCaption(
  photo: WallPhoto,
  place: PhotoPlace,
  meta: readonly string[],
): ScreenCaption {
  const number = `Image ${photo.index} of ${place.photoCount}`;
  return {
    meta: [...meta, number].join(' · '),
    heard: [heardMeta(meta), number.toLowerCase()].filter(Boolean).join(', '),
    words: photo.caption,
    alt: screenAlt(photo, place),
  };
}
