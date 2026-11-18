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

/**
 * Sanity Studio Schema Definitions
 *
 * Copy these schemas and src/sanity/schemaTypes/portfolio-media.ts (with its rules) to your Studio.
 * Register the exported portfolioPhotoType and portfolioVideoType alongside experienceSchema.
 * Location: schemas/ directory in your Sanity Studio
 */

import type { Rule } from 'sanity';
import { portfolioMediaField } from '../../sanity/schemaTypes/portfolio-media';

export { portfolioPhotoType, portfolioVideoType } from '../../sanity/schemaTypes/portfolio-media';

/**
 * Experience Schema
 * File: schemas/experience.ts
 */
export const experienceSchema = {
  name: 'experience',
  title: 'Experience',
  type: 'document',
  fields: [
    portfolioMediaField(),
    {
      name: 'company',
      title: 'Company',
      type: 'string',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'position',
      title: 'Position',
      type: 'string',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'employmentType',
      title: 'Employment Type',
      type: 'string',
      description:
        'Optional, e.g. Full-time, Freelance, Seasonal, Contract, Apprenticeship, Internship or Part-time.',
    },
    {
      name: 'location',
      title: 'Location',
      type: 'string',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'startDate',
      title: 'Start Date',
      type: 'date',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'endDate',
      title: 'End Date',
      type: 'date',
      description: 'Leave empty if this is your current position',
    },
    {
      name: 'dateNote',
      title: 'Date Context',
      type: 'string',
      description:
        'Optional context explaining what the dates cover, without changing the work history.',
    },
    {
      name: 'current',
      title: 'Current Position',
      type: 'boolean',
      initialValue: false,
    },
    {
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'responsibilities',
      title: 'Responsibilities',
      type: 'array',
      of: [{ type: 'string' }],
      validation: (Rule: any) => Rule.required().min(1),
    },
    {
      name: 'technologies',
      title: 'Technologies',
      type: 'array',
      of: [{ type: 'string' }],
      validation: (Rule: any) => Rule.required().min(1),
    },
    {
      name: 'logo',
      title: 'Company Logo',
      type: 'image',
      options: {
        hotspot: true,
      },
      fields: [
        {
          name: 'alt',
          title: 'Alt Text',
          type: 'string',
        },
      ],
    },
    {
      name: 'companyUrl',
      title: 'Company Website',
      type: 'url',
    },
    {
      name: 'subRoles',
      title: 'Roles Within This Organization',
      type: 'array',
      description:
        'Dated positions within one engagement. Parent dates cover the whole tenure; child roles may overlap.',
      of: [
        {
          type: 'object',
          name: 'experienceSubRole',
          title: 'Dated Role',
          fields: [
            portfolioMediaField(),
            {
              name: 'position',
              title: 'Position',
              type: 'string',
              validation: (rule: Rule) => rule.required(),
            },
            {
              name: 'employmentType',
              title: 'Employment Type',
              type: 'string',
              description:
                'Optional. Applies only to this role; it may differ from the parent engagement.',
            },
            {
              name: 'startDate',
              title: 'Start Date',
              type: 'date',
              validation: (rule: Rule) => rule.required(),
            },
            { name: 'endDate', title: 'End Date', type: 'date' },
            { name: 'current', title: 'Current Role', type: 'boolean', initialValue: false },
            { name: 'description', title: 'Description', type: 'text', rows: 3 },
            {
              name: 'responsibilities',
              title: 'Responsibilities',
              type: 'array',
              of: [{ type: 'string' }],
            },
            {
              name: 'technologies',
              title: 'Technologies',
              type: 'array',
              of: [{ type: 'string' }],
            },
          ],
          preview: { select: { title: 'position', subtitle: 'startDate' } },
        },
      ],
    },
    {
      name: 'order',
      title: 'Order',
      type: 'number',
      description: 'Used for manual sorting (lower numbers appear first)',
      initialValue: 0,
    },
  ],
  preview: {
    select: {
      title: 'position',
      subtitle: 'company',
      media: 'logo',
    },
  },
};
