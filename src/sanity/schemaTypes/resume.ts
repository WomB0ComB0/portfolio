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

export const resumeType = defineType({
  name: 'resume',
  title: 'Resume',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Title for the resume (e.g., "Resume", "CV", "Mike Odnis Resume")',
      validation: (Rule) => Rule.required(),
      initialValue: 'Resume',
    }),
    defineField({
      name: 'pdfFile',
      title: 'PDF File',
      type: 'file',
      description: 'Upload the resume PDF file',
      options: {
        accept: '.pdf',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'lastUpdated',
      title: 'Last Updated',
      type: 'date',
      description: 'When was this resume last updated?',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'isActive',
      title: 'Is Active',
      type: 'boolean',
      description:
        'Is this the current active resume to display? Only one should be active at a time.',
      initialValue: true,
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      lastUpdated: 'lastUpdated',
      isActive: 'isActive',
    },
    prepare({ title, lastUpdated, isActive }) {
      return {
        title: title || 'Resume',
        subtitle: `Last updated: ${lastUpdated || 'N/A'} ${isActive ? '✓ Active' : ''}`,
      };
    },
  },
});
