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

export const placeType = defineType({
  name: 'place',
  title: 'Place',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Place Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          { title: 'Hackathon', value: 'Hackathon' },
          { title: 'Conference', value: 'Conference' },
          { title: 'Research', value: 'Research' },
          { title: 'Tech Office', value: 'Tech Office' },
          { title: 'Mentorship', value: 'Mentorship' },
          { title: 'Event', value: 'Event' },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'latitude',
      title: 'Latitude',
      type: 'number',
      validation: (Rule) => Rule.required().min(-90).max(90),
    }),
    defineField({
      name: 'longitude',
      title: 'Longitude',
      type: 'number',
      validation: (Rule) => Rule.required().min(-180).max(180),
    }),
    defineField({
      name: 'startDate',
      title: 'Start Date',
      type: 'date',
      description: 'Day of the visit (or first day). Places are listed newest first by this date.',
    }),
    defineField({
      name: 'endDate',
      title: 'End Date',
      type: 'date',
      description: 'Optional last day for multi-day events. Leave empty for single-day visits.',
      validation: (Rule) =>
        Rule.custom<string>((endDate, context) => {
          if (!endDate) return true;
          const startDate = context.document?.startDate as string | undefined;
          if (!startDate) return 'Set a start date before adding an end date';
          return endDate >= startDate || 'End date must be on or after the start date';
        }),
    }),
    defineField({
      name: 'photos',
      title: 'Photos',
      type: 'array',
      of: [
        {
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
            {
              name: 'caption',
              type: 'string',
              title: 'Caption',
            },
          ],
        },
      ],
    }),
    defineField({
      name: 'order',
      title: 'Display Order',
      type: 'number',
      description:
        'Tiebreaker: orders places that share a start date or have none (lower numbers first). Dated places are listed newest first.',
      validation: (Rule) => Rule.required(),
      initialValue: 0,
    }),
    defineField({
      name: 'featured',
      title: 'Featured Place',
      type: 'boolean',
      description: 'Highlight this place on the map',
      initialValue: false,
    }),
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'category',
      media: 'photos.0',
    },
  },
});
