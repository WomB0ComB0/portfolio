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

import { defineField, defineType } from 'sanity';

/**
 * Presentation schema with support for multiple media formats.
 * Presentations can be provided as:
 * - PDF file upload
 * - External URL (Google Slides, Canva, Speaker Deck, etc.)
 * - Video recording link
 */
export const presentationType = defineType({
  name: 'presentation',
  title: 'Presentation',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 4,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'eventName',
      title: 'Event Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'eventUrl',
      title: 'Event URL',
      type: 'url',
    }),
    defineField({
      name: 'date',
      title: 'Date',
      type: 'datetime',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slidesFormat',
      title: 'Slides Format',
      type: 'string',
      options: {
        list: [
          { title: 'PDF File', value: 'pdf' },
          { title: 'Google Slides', value: 'google_slides' },
          { title: 'Speaker Deck', value: 'speakerdeck' },
          { title: 'SlideShare', value: 'slideshare' },
          { title: 'Canva', value: 'canva' },
          { title: 'Other URL', value: 'other_url' },
          { title: 'None', value: 'none' },
        ],
        layout: 'radio',
      },
      initialValue: 'none',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slidesPdf',
      title: 'Slides PDF',
      type: 'file',
      options: {
        accept: '.pdf',
      },
      description: 'Upload a PDF of your slides',
      hidden: ({ parent }) => parent?.slidesFormat !== 'pdf',
    }),
    defineField({
      name: 'slidesUrl',
      title: 'Slides URL',
      type: 'url',
      description: 'Link to external slides (Google Slides, Speaker Deck, etc.)',
      hidden: ({ parent }) =>
        !parent?.slidesFormat || parent?.slidesFormat === 'pdf' || parent?.slidesFormat === 'none',
    }),
    defineField({
      name: 'videoUrl',
      title: 'Video Recording URL',
      type: 'url',
      description: 'Link to video recording (YouTube, Vimeo, etc.)',
    }),
    defineField({
      name: 'thumbnailImage',
      title: 'Thumbnail Image',
      type: 'image',
      options: {
        hotspot: true,
      },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alternative Text',
        },
      ],
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'string',
    }),
    defineField({
      name: 'order',
      title: 'Display Order',
      type: 'number',
      description: 'Used to order presentations in lists (lower numbers appear first)',
      validation: (Rule) => Rule.required(),
      initialValue: 0,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'eventName',
      media: 'thumbnailImage',
    },
  },
});
