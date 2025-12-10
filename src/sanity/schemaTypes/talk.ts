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
 * Talk schema with support for multiple media formats.
 * Talks can have:
 * - Video recording link (YouTube, Vimeo, etc.)
 * - Slides in PDF or external URL format
 */
export const talkType = defineType({
  name: 'talk',
  title: 'Talk',
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
      name: 'venue',
      title: 'Venue',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'date',
      title: 'Date',
      type: 'datetime',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'videoFormat',
      title: 'Video Format',
      type: 'string',
      options: {
        list: [
          { title: 'YouTube', value: 'youtube' },
          { title: 'Vimeo', value: 'vimeo' },
          { title: 'Other Video URL', value: 'other' },
          { title: 'None', value: 'none' },
        ],
        layout: 'radio',
      },
      initialValue: 'none',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'videoUrl',
      title: 'Video URL',
      type: 'url',
      description: 'Link to video recording',
      hidden: ({ parent }) => parent?.videoFormat === 'none',
    }),
    defineField({
      name: 'slidesFormat',
      title: 'Slides Format',
      type: 'string',
      options: {
        list: [
          { title: 'PDF File', value: 'pdf' },
          { title: 'External URL', value: 'url' },
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
      description: 'Link to external slides',
      hidden: ({ parent }) => parent?.slidesFormat !== 'url',
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
      name: 'duration',
      title: 'Duration',
      type: 'string',
      description: 'Duration of the talk (e.g., "30 min", "1 hour")',
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'order',
      title: 'Display Order',
      type: 'number',
      description: 'Used to order talks in lists (lower numbers appear first)',
      validation: (Rule) => Rule.required(),
      initialValue: 0,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'venue',
      media: 'thumbnailImage',
    },
  },
});
