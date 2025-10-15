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
  location: Schema.String,
  startDate: Schema.String,
  endDate: Schema.optional(Schema.String),
  current: Schema.Boolean,
  description: Schema.String,
  responsibilities: Schema.Array(Schema.String),
  technologies: Schema.Array(Schema.String),
  logo: Schema.optional(Schema.Unknown), // SanityImage
  companyUrl: Schema.optional(Schema.String),
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
  slug: Schema.Unknown, // SanitySlug
  description: Schema.String,
  longDescription: Schema.optional(Schema.String),
  image: Schema.Unknown, // SanityImage
  images: Schema.optional(Schema.Array(Schema.Unknown)),
  technologies: Schema.Array(Schema.String),
  githubUrl: Schema.optional(Schema.String),
  liveUrl: Schema.optional(Schema.String),
  featured: Schema.Boolean,
  category: Schema.Union(
    Schema.Literal('web'),
    Schema.Literal('mobile'),
    Schema.Literal('design'),
    Schema.Literal('other'),
  ),
  startDate: Schema.String,
  endDate: Schema.optional(Schema.String),
  order: Schema.Number,
  status: Schema.Union(
    Schema.Literal('completed'),
    Schema.Literal('in-progress'),
    Schema.Literal('archived'),
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
  name: Schema.String,
  issuer: Schema.String,
  issueDate: Schema.String,
  expiryDate: Schema.optional(Schema.String),
  credentialId: Schema.optional(Schema.String),
  credentialUrl: Schema.optional(Schema.String),
  logo: Schema.optional(Schema.Unknown), // SanityImage
  description: Schema.optional(Schema.String),
  skills: Schema.Array(Schema.String),
  order: Schema.Number,
});

/**
 * Array schemas for list endpoints
 */
export const ExperiencesSchema = Schema.Array(ExperienceSchema);
export const ProjectsSchema = Schema.Array(ProjectSchema);
export const CertificationsSchema = Schema.Array(CertificationSchema);
