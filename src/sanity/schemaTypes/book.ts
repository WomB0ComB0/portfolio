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

export const bookType = defineType({
  name: 'book',
  title: 'Book',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'spineTitle',
      title: 'Spine Title',
      type: 'string',
      description: 'Short title printed vertically on the 3D book spine. Defaults to Title.',
    }),
    defineField({
      name: 'authors',
      title: 'Authors',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'spineAuthor',
      title: 'Spine Author Label',
      type: 'string',
      description: 'Short uppercase author label near the base of the spine (e.g. KLEPPMANN).',
    }),
    defineField({
      name: 'publisher',
      title: 'Publisher',
      type: 'string',
    }),
    defineField({
      name: 'edition',
      title: 'Edition',
      type: 'string',
    }),
    defineField({
      name: 'year',
      title: 'Publication Year',
      type: 'number',
      validation: (Rule) => Rule.integer().min(1400).max(2100),
    }),
    defineField({
      name: 'isbn',
      title: 'ISBN',
      type: 'string',
      description: 'ISBN-13 or ISBN-10 (can be looked up via /api/v1/books/lookup?isbn=...)',
    }),
    defineField({
      name: 'track',
      title: 'Section / Track',
      type: 'string',
      description:
        'Section label used to group books on the shelf (e.g. Foundations, Backend, Infra & Ops, AI, Startups).',
      options: {
        list: [
          { title: 'Foundations', value: 'Foundations' },
          { title: 'Backend', value: 'Backend' },
          { title: 'Infra & Ops', value: 'Infra & Ops' },
          { title: 'AI', value: 'AI' },
          { title: 'Startups', value: 'Startups' },
          { title: 'Design', value: 'Design' },
          { title: 'General', value: 'General' },
        ],
      },
      initialValue: 'Foundations',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'status',
      title: 'Reading Status',
      type: 'string',
      options: {
        list: [
          { title: 'Completed', value: 'completed' },
          { title: 'Reading', value: 'reading' },
          { title: 'Queued', value: 'queued' },
        ],
      },
      initialValue: 'completed',
    }),
    defineField({
      name: 'summary',
      title: 'Summary / Thesis',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'coverImage',
      title: 'Cover Image',
      type: 'image',
      options: { hotspot: true },
    }),
    defineField({
      name: 'coverUrl',
      title: 'External or Local Cover URL',
      type: 'string',
      description:
        'Optional fallback cover URL (e.g. Open Library or /assets/bookshelf/*.webp) when Cover Image is empty.',
    }),
    defineField({
      name: 'url',
      title: 'Book URL',
      type: 'url',
      description: 'Publisher page, official site, or reference link.',
    }),
    defineField({
      name: 'spine',
      title: '3D Spine Palette',
      type: 'object',
      fields: [
        defineField({ name: 'capBg', title: 'Top Band Color', type: 'string' }),
        defineField({ name: 'capText', title: 'Top Band Text', type: 'string' }),
        defineField({ name: 'bodyBg', title: 'Spine Body Color', type: 'string' }),
        defineField({ name: 'titleColor', title: 'Spine Title Color', type: 'string' }),
        defineField({ name: 'authorColor', title: 'Spine Author Color', type: 'string' }),
      ],
    }),
    defineField({
      name: 'topics',
      title: 'Key Topics / Takeaways',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Ordered topics or takeaways shown in the 2-column detail outline.',
    }),
    defineField({
      name: 'order',
      title: 'Stage Order',
      type: 'number',
      description: 'Lower numbers appear earlier on the shelf.',
      initialValue: 0,
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'track',
      media: 'coverImage',
    },
  },
});
