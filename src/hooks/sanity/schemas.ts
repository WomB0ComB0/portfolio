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
 * Sanity Experience Schema with Effect Schema validation
 */
export const ExperienceSchema = Schema.Struct({
  _id: Schema.String,
  _type: Schema.Literal('experience'),
  _createdAt: Schema.String,
  _updatedAt: Schema.String,
  _rev: Schema.String,
  company: Schema.String,
  position: Schema.String,
  location: Schema.NullishOr(Schema.String),
  startDate: Schema.String,
  endDate: Schema.NullishOr(Schema.String),
  current: Schema.Boolean,
  description: Schema.String,
  responsibilities: Schema.NullishOr(Schema.Array(Schema.String)),
  technologies: Schema.NullishOr(Schema.Array(Schema.String)),
  logo: Schema.NullishOr(Schema.Unknown), // SanityImage
  companyUrl: Schema.NullishOr(Schema.String),
  order: Schema.NullishOr(Schema.Number),
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
  slug: Schema.Unknown, // SanitySlug
  description: Schema.String,
  longDescription: Schema.NullishOr(Schema.String),
  image: Schema.Unknown, // SanityImage
  images: Schema.NullishOr(Schema.Array(Schema.Unknown)),
  technologies: Schema.NullishOr(Schema.Array(Schema.String)),
  githubUrl: Schema.NullishOr(Schema.String),
  liveUrl: Schema.NullishOr(Schema.String),
  featured: Schema.Boolean,
  category: Schema.Union(
    Schema.Literal('Web Development'),
    Schema.Literal('Mobile App'),
    Schema.Literal('Machine Learning'),
    Schema.Literal('Data Science'),
    Schema.Literal('DevOps'),
    Schema.Literal('Other'),
  ),
  startDate: Schema.String,
  endDate: Schema.NullishOr(Schema.String),
  order: Schema.NullishOr(Schema.Number),
  status: Schema.Union(
    Schema.Literal('In Progress'),
    Schema.Literal('Completed'),
    Schema.Literal('Archived'),
  ),
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
  issueDate: Schema.String,
  expiryDate: Schema.NullishOr(Schema.String),
  credentialId: Schema.NullishOr(Schema.String),
  credentialUrl: Schema.NullishOr(Schema.String),
  image: Schema.NullishOr(Schema.Unknown), // SanityImage
  description: Schema.NullishOr(Schema.String),
  skills: Schema.NullishOr(Schema.Array(Schema.String)),
  order: Schema.NullishOr(Schema.Number),
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
  category: Schema.Union(
    Schema.Literal('Hackathon'),
    Schema.Literal('Conference'),
    Schema.Literal('Research'),
    Schema.Literal('Tech Office'),
    Schema.Literal('Mentorship'),
    Schema.Literal('Event'),
  ),
  latitude: Schema.Number,
  longitude: Schema.Number,
  photos: Schema.NullishOr(Schema.Array(Schema.Unknown)), // SanityImage array
  order: Schema.NullishOr(Schema.Number),
  featured: Schema.Boolean,
});

/**
 * Sanity File Schema
 */
export const SanityFileSchema = Schema.Struct({
  _id: Schema.optional(Schema.String),
  url: Schema.String,
  originalFilename: Schema.optional(Schema.String),
  size: Schema.optional(Schema.Number),
  mimeType: Schema.optional(Schema.String),
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
 * TypeScript types derived from schemas
 */
export type Resume = Schema.Schema.Type<typeof ResumeSchema>;

/**
 * Array schemas for list endpoints
 */
export const ExperiencesSchema = Schema.Array(ExperienceSchema);
export const ProjectsSchema = Schema.Array(ProjectSchema);
export const CertificationsSchema = Schema.Array(CertificationSchema);
export const PlacesSchema = Schema.Array(PlaceSchema);
