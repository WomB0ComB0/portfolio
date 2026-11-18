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

import { defineField, defineType } from 'sanity';
import {
  hasMediaText,
  isMediaLink,
  validateMediaImage,
  validateMediaVideo,
} from '../portfolio-media-rules';

export const portfolioPhotoType = defineType({
  name: 'portfolioPhoto',
  title: 'Photo',
  type: 'object',
  fields: [
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true, accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif' },
      validation: (rule) => rule.required().custom(validateMediaImage),
    }),
    defineField({
      name: 'alt',
      title: 'Alternative text',
      type: 'string',
      description: 'Describe what this image shows for someone who cannot see it.',
      validation: (rule) =>
        rule
          .required()
          .custom(
            (value) => hasMediaText(value) || 'Describe the image; spaces alone are not enough.',
          ),
    }),
    defineField({
      name: 'caption',
      title: 'Caption',
      type: 'text',
      rows: 2,
      description: 'Optional context, outcome or credit shown below the image.',
    }),
  ],
  preview: { select: { title: 'alt', subtitle: 'caption', media: 'image' } },
});

export const portfolioVideoType = defineType({
  name: 'portfolioVideo',
  title: 'Video',
  type: 'object',
  validation: (rule) => rule.custom(validateMediaVideo),
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) =>
        rule
          .required()
          .custom((value) => hasMediaText(value) || 'Give the video a descriptive title.'),
    }),
    defineField({
      name: 'file',
      title: 'Upload video',
      type: 'file',
      options: { accept: 'video/mp4,video/webm' },
      description:
        'MP4 or WebM, preferably a short compressed walkthrough. Choose this OR an external watch URL.',
    }),
    defineField({
      name: 'externalUrl',
      title: 'External watch URL',
      type: 'url',
      description: 'Opens the video on its host. Choose this OR an uploaded video.',
      validation: (rule) =>
        rule
          .uri({ scheme: ['http', 'https'] })
          .custom(
            (value) =>
              value == null || isMediaLink(value) || 'Use an HTTP(S) URL without credentials.',
          ),
    }),
    defineField({
      name: 'poster',
      title: 'Poster image',
      type: 'image',
      options: { hotspot: true, accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif' },
      validation: (rule) => rule.custom(validateMediaImage),
      description: 'Shown before playback; use a clear frame that represents the video.',
    }),
    defineField({ name: 'caption', title: 'Caption', type: 'text', rows: 2 }),
    defineField({
      name: 'captionsFile',
      title: 'Captions (.vtt)',
      type: 'file',
      options: { accept: '.vtt,text/vtt' },
      description:
        'For uploaded videos with speech or meaningful audio. External videos use their host’s captions.',
    }),
    defineField({
      name: 'captionsLanguage',
      title: 'Captions language',
      type: 'string',
      initialValue: 'en',
      description: 'Language code, such as en, en-US or es.',
    }),
    defineField({
      name: 'captionsLabel',
      title: 'Captions label',
      type: 'string',
      initialValue: 'English',
      description: 'Readable name in the native player’s captions menu.',
    }),
  ],
  preview: { select: { title: 'title', subtitle: 'caption', media: 'poster' } },
});

/** Each owner gets its own ordered array; an empty field adds no section to the page. */
export const portfolioMediaField = () =>
  defineField({
    name: 'media',
    title: 'Photos and videos',
    type: 'array',
    description:
      'Ordered media shown on this detail page. Add only material you have permission to share.',
    of: [{ type: 'portfolioPhoto' }, { type: 'portfolioVideo' }],
  });
