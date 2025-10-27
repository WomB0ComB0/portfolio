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
 * @fileoverview Effect Schema definitions for Sanity CMS data types
 *
 * Centralized schema definitions for all Sanity document types with
 * Effect Schema validation. These schemas are shared across both
 * standard React Query hooks and Suspense-based useDataLoader hooks.
 */

import { Schema } from 'effect';

/**
 * Sanity Image Schema
 */
export const SanityImageAssetSchema = Schema.Struct({
  _ref: Schema.String,
  _type: Schema.Literal('reference'),
});

export const SanityImageCropSchema = Schema.Struct({
  top: Schema.Number,
  bottom: Schema.Number,
  left: Schema.Number,
  right: Schema.Number,
});

export const SanityImageHotspotSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  height: Schema.Number,
  width: Schema.Number,
});

export const SanityImageSchema = Schema.Struct({
  _type: Schema.Literal('image'),
  asset: SanityImageAssetSchema,
  alt: Schema.optional(Schema.String),
  caption: Schema.optional(Schema.String),
  crop: Schema.optional(SanityImageCropSchema),
  hotspot: Schema.optional(SanityImageHotspotSchema),
});

/**
 * Sanity Slug Schema
 */
export const SanitySlugSchema = Schema.Struct({
  _type: Schema.Literal('slug'),
  current: Schema.String,
});

/**
 * Sanity File Asset Schema
 */
export const SanityFileAssetSchema = Schema.Struct({
  _ref: Schema.String,
  _type: Schema.Literal('reference'),
});

export const SanityFileSchema = Schema.Struct({
  _type: Schema.Literal('file'),
  asset: SanityFileAssetSchema,
});

/**
 * Resolved Sanity File Schema (after fetching asset details)
 */
export const ResolvedSanityFileSchema = Schema.Struct({
  _id: Schema.optional(Schema.String),
  url: Schema.String,
  originalFilename: Schema.optional(Schema.String),
  size: Schema.optional(Schema.Number),
  mimeType: Schema.optional(Schema.String),
});

/**
 * Sanity Experience Schema with Effect Schema validation
 */
export const ExperienceSchema = Schema.Struct({
  _id: Schema.String,
  _type: Schema.Literal('experience'),
  _createdAt: Schema.String,
  _updatedAt: Schema.String,
  _rev: Schema.String,
  position: Schema.String,
  company: Schema.String,
  companyUrl: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  logo: Schema.optional(Schema.Union(SanityImageSchema, Schema.Null)),
  location: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  description: Schema.String,
  responsibilities: Schema.optional(Schema.Array(Schema.String)),
  technologies: Schema.optional(Schema.Array(Schema.String)),
  startDate: Schema.String,
  endDate: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  current: Schema.Boolean,
  order: Schema.Number,
});

/**
 * Sanity Project Schema with Effect Schema validation
 */
export const ProjectSchema = Schema.Struct({
  _id: Schema.String,
  _type: Schema.Literal('project'),
  _createdAt: Schema.String,
  _updatedAt: Schema.String,
  _rev: Schema.String,
  title: Schema.String,
  slug: SanitySlugSchema,
  description: Schema.String,
  longDescription: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  image: Schema.optional(Schema.Union(SanityImageSchema, Schema.Null)),
  images: Schema.optional(Schema.Union(Schema.Array(SanityImageSchema), Schema.Null)),
  category: Schema.Literal(
    'Web Development',
    'Mobile App',
    'Machine Learning',
    'Data Science',
    'DevOps',
    'Other',
  ),
  technologies: Schema.Array(Schema.String),
  status: Schema.Literal('In Progress', 'Completed', 'Archived'),
  featured: Schema.Boolean,
  liveUrl: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  githubUrl: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  startDate: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  endDate: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  order: Schema.Number,
});

/**
 * Sanity Certification Schema with Effect Schema validation
 */
export const CertificationSchema = Schema.Struct({
  _id: Schema.String,
  _type: Schema.Literal('certification'),
  _createdAt: Schema.String,
  _updatedAt: Schema.String,
  _rev: Schema.String,
  title: Schema.String,
  issuer: Schema.String,
  description: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  image: Schema.optional(Schema.Union(SanityImageSchema, Schema.Null)),
  credentialId: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  credentialUrl: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  issueDate: Schema.String,
  expiryDate: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  skills: Schema.optional(Schema.Union(Schema.Array(Schema.String), Schema.Null)),
  order: Schema.Number,
});

/**
 * Sanity Place Schema with Effect Schema validation
 */
export const PlaceSchema = Schema.Struct({
  _id: Schema.String,
  _type: Schema.Literal('place'),
  _createdAt: Schema.String,
  _updatedAt: Schema.String,
  _rev: Schema.String,
  name: Schema.String,
  description: Schema.String,
  category: Schema.Literal(
    'Hackathon',
    'Conference',
    'Research',
    'Tech Office',
    'Mentorship',
    'Event',
  ),
  latitude: Schema.Number,
  longitude: Schema.Number,
  photos: Schema.optional(Schema.Union(Schema.Array(SanityImageSchema), Schema.Null)),
  order: Schema.Number,
  featured: Schema.Boolean,
});

/**
 * Sanity Resume Schema with Effect Schema validation
 */
export const ResumeSchema = Schema.Struct({
  _id: Schema.String,
  _type: Schema.Literal('resume'),
  _createdAt: Schema.String,
  _updatedAt: Schema.String,
  _rev: Schema.String,
  title: Schema.String,
  pdfFile: SanityFileSchema,
  lastUpdated: Schema.String,
  isActive: Schema.Boolean,
});

/**
 * Resolved Resume Schema (with populated file asset)
 */
export const ResolvedResumeSchema = Schema.Struct({
  _id: Schema.String,
  _type: Schema.Literal('resume'),
  _createdAt: Schema.String,
  _updatedAt: Schema.String,
  _rev: Schema.String,
  title: Schema.String,
  pdfFile: ResolvedSanityFileSchema,
  lastUpdated: Schema.String,
  isActive: Schema.Boolean,
});

/**
 * Array schemas for list endpoints
 */
export const ExperiencesSchema = Schema.Array(ExperienceSchema);
export const ProjectsSchema = Schema.Array(ProjectSchema);
export const CertificationsSchema = Schema.Array(CertificationSchema);
export const PlacesSchema = Schema.Array(PlaceSchema);
export const ResumesSchema = Schema.Array(ResumeSchema);

/**
 * TypeScript types derived from schemas
 */
export type SanityImage = Schema.Schema.Type<typeof SanityImageSchema>;
export type SanitySlug = Schema.Schema.Type<typeof SanitySlugSchema>;
export type SanityFile = Schema.Schema.Type<typeof SanityFileSchema>;
export type ResolvedSanityFile = Schema.Schema.Type<typeof ResolvedSanityFileSchema>;

export type Experience = Schema.Schema.Type<typeof ExperienceSchema>;
export type Project = Schema.Schema.Type<typeof ProjectSchema>;
export type Certification = Schema.Schema.Type<typeof CertificationSchema>;
export type Place = Schema.Schema.Type<typeof PlaceSchema>;
export type Resume = Schema.Schema.Type<typeof ResumeSchema>;
export type ResolvedResume = Schema.Schema.Type<typeof ResolvedResumeSchema>;

export type Experiences = Schema.Schema.Type<typeof ExperiencesSchema>;
export type Projects = Schema.Schema.Type<typeof ProjectsSchema>;
export type Certifications = Schema.Schema.Type<typeof CertificationsSchema>;
export type Places = Schema.Schema.Type<typeof PlacesSchema>;
export type Resumes = Schema.Schema.Type<typeof ResumesSchema>;
