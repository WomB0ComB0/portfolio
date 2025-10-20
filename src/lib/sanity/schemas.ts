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
 * Copy these schemas to your Sanity Studio project
 * Location: schemas/ directory in your Sanity Studio
 */

/**
 * Experience Schema
 * File: schemas/experience.ts
 */
export const experienceSchema = {
  name: 'experience',
  title: 'Experience',
  type: 'document',
  fields: [
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

/**
 * Project Schema
 * File: schemas/project.ts
 */
export const projectSchema = {
  name: 'project',
  title: 'Project',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'description',
      title: 'Short Description',
      type: 'text',
      rows: 3,
      validation: (Rule: any) => Rule.required().max(200),
    },
    {
      name: 'longDescription',
      title: 'Long Description',
      type: 'text',
      rows: 10,
      description: 'Detailed project description',
    },
    {
      name: 'image',
      title: 'Main Image',
      type: 'image',
      options: {
        hotspot: true,
      },
      fields: [
        {
          name: 'alt',
          title: 'Alt Text',
          type: 'string',
          validation: (Rule: any) => Rule.required(),
        },
      ],
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'images',
      title: 'Gallery Images',
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
              title: 'Alt Text',
              type: 'string',
            },
          ],
        },
      ],
    },
    {
      name: 'technologies',
      title: 'Technologies',
      type: 'array',
      of: [{ type: 'string' }],
      validation: (Rule: any) => Rule.required().min(1),
    },
    {
      name: 'githubUrl',
      title: 'GitHub URL',
      type: 'url',
    },
    {
      name: 'liveUrl',
      title: 'Live URL',
      type: 'url',
    },
    {
      name: 'featured',
      title: 'Featured',
      type: 'boolean',
      description: 'Show this project in featured section',
      initialValue: false,
    },
    {
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          { title: 'Web', value: 'web' },
          { title: 'Mobile', value: 'mobile' },
          { title: 'Design', value: 'design' },
          { title: 'Other', value: 'other' },
        ],
      },
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          { title: 'Completed', value: 'completed' },
          { title: 'In Progress', value: 'in-progress' },
          { title: 'Archived', value: 'archived' },
        ],
      },
      initialValue: 'completed',
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
      description: 'Leave empty for ongoing projects',
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
      title: 'title',
      subtitle: 'category',
      media: 'image',
    },
  },
};

/**
 * Certification Schema
 * File: schemas/certification.ts
 */
export const certificationSchema = {
  name: 'certification',
  title: 'Certification',
  type: 'document',
  fields: [
    {
      name: 'name',
      title: 'Certification Name',
      type: 'string',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'issuer',
      title: 'Issuer',
      type: 'string',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'issueDate',
      title: 'Issue Date',
      type: 'date',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'expiryDate',
      title: 'Expiry Date',
      type: 'date',
      description: 'Leave empty if certification does not expire',
    },
    {
      name: 'credentialId',
      title: 'Credential ID',
      type: 'string',
    },
    {
      name: 'credentialUrl',
      title: 'Credential URL',
      type: 'url',
      description: 'URL to verify the certification',
    },
    {
      name: 'logo',
      title: 'Issuer Logo',
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
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
    },
    {
      name: 'skills',
      title: 'Skills',
      type: 'array',
      of: [{ type: 'string' }],
      validation: (Rule: any) => Rule.required().min(1),
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
      title: 'name',
      subtitle: 'issuer',
      media: 'logo',
    },
  },
};

/**
 * Skill Category Schema (Optional)
 * File: schemas/skillCategory.ts
 */
export const skillCategorySchema = {
  name: 'skillCategory',
  title: 'Skill Category',
  type: 'document',
  fields: [
    {
      name: 'name',
      title: 'Category Name',
      type: 'string',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'skills',
      title: 'Skills',
      type: 'array',
      of: [{ type: 'string' }],
      validation: (Rule: any) => Rule.required().min(1),
    },
    {
      name: 'icon',
      title: 'Icon',
      type: 'string',
      description: 'Icon name or emoji',
    },
    {
      name: 'order',
      title: 'Order',
      type: 'number',
      description: 'Used for sorting categories',
      initialValue: 0,
    },
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'icon',
    },
  },
};
