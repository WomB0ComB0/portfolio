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
 * Effect Schema validation. The server loaders in '@/lib/sanity/loaders' decode each
 * document with them, and pages take their types.
 */

import { Schema } from 'effect';
import { PLACE_CATEGORIES } from '@/lib/places/categories';
import {
  hasText,
  isSiteEmail,
  isSiteHttpsUrl,
  SITE_LOCATION_MAX_LENGTH,
  SITE_TAGLINE_MAX_LENGTH,
} from '@/sanity/site-settings-rules';

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
  category: Schema.String, // Allow any string for flexible categorization
  technologies: Schema.Array(Schema.String),
  status: Schema.String, // Allow any string for flexible status combinations
  featured: Schema.Boolean,
  /**
   * The Studio "Featured rank": puts the project in the Featured group at the top of /projects,
   * lowest first. Documents written before the field existed have no value, and GROQ answers
   * null for them: both decode as absent, so no project is dropped for lacking one.
   */
  featuredRank: Schema.optionalWith(Schema.Number, { nullable: true }),
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
  /**
   * The Studio switch for the /certifications Featured row. Documents written before the field
   * existed have no value, and GROQ answers null for them: both decode as false.
   */
  featured: Schema.optionalWith(Schema.Boolean, { nullable: true, default: () => false }),
  order: Schema.Number,
});

const SANITY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar day in Sanity `date` format (YYYY-MM-DD); rejects e.g. 2026-02-30. */
const isSanityDate = (value: string): boolean =>
  SANITY_DATE_PATTERN.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

const SanityDateSchema = Schema.String.pipe(
  Schema.filter(isSanityDate, { message: () => 'Expected a YYYY-MM-DD calendar date' }),
);

/**
 * Optional Sanity `date` value. Malformed strings decode to null (treated as undated) rather
 * than failing: the places list is decoded as one array, so a hard failure on a single
 * document's date would blank the whole page. Non-ISO strings must not reach date formatting,
 * where `new Date()` would read them in local time and shift the day.
 */
const LenientSanityDateSchema = Schema.transform(
  Schema.NullOr(Schema.String),
  Schema.NullOr(SanityDateSchema),
  {
    strict: true,
    decode: (value) => (value !== null && isSanityDate(value) ? value : null),
    encode: (value) => value,
  },
);

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
  // The six categories have one source, which the /places chips read too.
  category: Schema.Literal(...PLACE_CATEGORIES),
  latitude: Schema.Number,
  longitude: Schema.Number,
  startDate: Schema.optional(LenientSanityDateSchema),
  endDate: Schema.optional(LenientSanityDateSchema),
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
 * Slides format type for type-safe format handling
 */
export const SlidesFormatSchema = Schema.Union(
  Schema.Literal('pdf'),
  Schema.Literal('google_slides'),
  Schema.Literal('speakerdeck'),
  Schema.Literal('slideshare'),
  Schema.Literal('canva'),
  Schema.Literal('other_url'),
  Schema.Literal('none'),
);

/**
 * Video format type for type-safe format handling
 */
export const VideoFormatSchema = Schema.Union(
  Schema.Literal('youtube'),
  Schema.Literal('vimeo'),
  Schema.Literal('other'),
  Schema.Literal('none'),
);

/**
 * Sanity Presentation Schema with Effect Schema validation
 * Supports multiple media formats: PDF, external URL, video
 */
export const PresentationSchema = Schema.Struct({
  _id: Schema.String,
  _type: Schema.Literal('presentation'),
  _createdAt: Schema.String,
  _updatedAt: Schema.String,
  _rev: Schema.String,
  title: Schema.String,
  description: Schema.String,
  eventName: Schema.String,
  eventUrl: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  date: Schema.String,
  slidesFormat: Schema.optional(Schema.Union(SlidesFormatSchema, Schema.Null)),
  slidesPdfUrl: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  slidesPdf: Schema.optional(Schema.Union(SanityFileSchema, Schema.Null)),
  slidesUrl: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  videoUrl: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  thumbnailImage: Schema.optional(Schema.Union(SanityImageSchema, Schema.Null)),
  tags: Schema.optional(Schema.Union(Schema.Array(Schema.String), Schema.Null)),
  location: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  order: Schema.Number,
});

/**
 * Talk slides format - simplified version with only PDF and URL options
 */
export const TalkSlidesFormatSchema = Schema.Union(
  Schema.Literal('pdf'),
  Schema.Literal('url'),
  Schema.Literal('none'),
);

/**
 * Sanity Talk Schema with Effect Schema validation
 * Supports multiple media formats: video and slides (PDF or URL)
 */
export const TalkSchema = Schema.Struct({
  _id: Schema.String,
  _type: Schema.Literal('talk'),
  _createdAt: Schema.String,
  _updatedAt: Schema.String,
  _rev: Schema.String,
  title: Schema.String,
  description: Schema.String,
  venue: Schema.String,
  date: Schema.String,
  videoFormat: Schema.optional(Schema.Union(VideoFormatSchema, Schema.Null)),
  videoUrl: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  slidesFormat: Schema.optional(Schema.Union(TalkSlidesFormatSchema, Schema.Null)),
  slidesPdfUrl: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  slidesPdf: Schema.optional(Schema.Union(SanityFileSchema, Schema.Null)),
  slidesUrl: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  thumbnailImage: Schema.optional(Schema.Union(SanityImageSchema, Schema.Null)),
  duration: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  tags: Schema.optional(Schema.Union(Schema.Array(Schema.String), Schema.Null)),
  order: Schema.Number,
});

/**
 * Sanity Article Schema with Effect Schema validation
 */
export const ArticleSchema = Schema.Struct({
  _id: Schema.String,
  _type: Schema.Literal('article'),
  _createdAt: Schema.String,
  _updatedAt: Schema.String,
  _rev: Schema.String,
  title: Schema.String,
  excerpt: Schema.String,
  publication: Schema.String,
  publicationUrl: Schema.String,
  publishedDate: Schema.String,
  coverImage: Schema.optional(Schema.Union(SanityImageSchema, Schema.Null)),
  coAuthors: Schema.optional(Schema.Union(Schema.Array(Schema.String), Schema.Null)),
  tags: Schema.optional(Schema.Union(Schema.Array(Schema.String), Schema.Null)),
  order: Schema.Number,
});

/**
 * Sanity YouTube Video Schema with Effect Schema validation
 */
export const YoutubeVideoSchema = Schema.Struct({
  _id: Schema.String,
  _type: Schema.Literal('youtubeVideo'),
  _createdAt: Schema.String,
  _updatedAt: Schema.String,
  _rev: Schema.String,
  title: Schema.String,
  description: Schema.String,
  videoId: Schema.String,
  publishedDate: Schema.String,
  thumbnail: Schema.optional(Schema.Union(SanityImageSchema, Schema.Null)),
  duration: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
  tags: Schema.optional(Schema.Union(Schema.Array(Schema.String), Schema.Null)),
  order: Schema.Number,
});

/**
 * The site settings' fields follow the rules in src/sanity/site-settings-rules.ts, which the
 * Studio schema checks too, so Studio refuses what this decoder would drop.
 */

/**
 * A field's one message, whichever of its checks fails (and even for a non-string), so a report
 * names each bad field once and never repeats the value, which may be an address.
 */
const fieldMessage = (message: string) => ({
  message: () => ({ message, override: true }),
});

/** Hero text: trimmed, not blank, at most `maxLength` characters. */
const siteTextSchema = (maxLength: number) =>
  Schema.Trim.pipe(Schema.nonEmptyString(), Schema.maxLength(maxLength)).annotations(
    fieldMessage(`Expected text of 1 to ${maxLength} characters`),
  );

/** An address a mailto link carries as it is (isSiteEmail): no '?', '&' or '#'. */
const SiteEmailSchema = Schema.Trim.pipe(Schema.filter(isSiteEmail)).annotations(
  fieldMessage('Expected an email address without ?, & or #'),
);

const HttpsUrlSchema = Schema.Trim.pipe(Schema.filter(isSiteHttpsUrl)).annotations(
  fieldMessage('Expected an https URL without credentials'),
);

/** A field Studio may leave empty: then it has no key at all. */
const SETTING = { exact: true } as const;

/** Every invalid field is reported, not just the first, and the loader keeps the valid ones. */
const SiteSettingsFieldsSchema = Schema.Struct({
  _id: Schema.String,
  _type: Schema.Literal('siteSettings'),
  location: Schema.optionalWith(siteTextSchema(SITE_LOCATION_MAX_LENGTH), SETTING),
  tagline: Schema.optionalWith(siteTextSchema(SITE_TAGLINE_MAX_LENGTH), SETTING),
  email: Schema.optionalWith(SiteEmailSchema, SETTING),
  githubUrl: Schema.optionalWith(HttpsUrlSchema, SETTING),
  linkedinUrl: Schema.optionalWith(HttpsUrlSchema, SETTING),
}).annotations({ parseOptions: { errors: 'all' } });

/**
 * The fields whose blank text means cleared: the location, the one with no built-in value (owner
 * decision: 'Clear the field in Studio to hide it'). Studio refuses spaces only, but the API does
 * not; such a location is the owner clearing it, not an invalid field to report.
 */
const CLEARED_WHEN_BLANK: ReadonlySet<string> = new Set(['location']);

/** True for a field the document leaves empty: GROQ's null for any, or a blank location. */
const isUnset = ([key, value]: readonly [string, unknown]): boolean =>
  value === null || (CLEARED_WHEN_BLANK.has(key) && typeof value === 'string' && !hasText(value));

/**
 * The site settings singleton (its fields feed the home hero). Every field is optional. GROQ
 * answers null for one left empty, and a null field (or a blank location) decodes as no key at
 * all, before the fields are checked: so empty is never invalid, and each invalid field is one
 * issue at its own path. A blank tagline is still invalid: it falls back to the built-in one.
 */
export const SiteSettingsDocumentSchema = Schema.transform(
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  SiteSettingsFieldsSchema,
  {
    strict: false,
    decode: (doc) => Object.fromEntries(Object.entries(doc).filter((entry) => !isUnset(entry))),
    encode: (settings) => settings,
  },
);

/**
 * The places list as one schema. The loaders decode each document on its own (decodeEach), so
 * one bad document is dropped rather than failing the list; this whole-list form is kept only
 * for the schema tests (place-schema.test.ts).
 */
export const PlacesSchema = Schema.Array(PlaceSchema);

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
export type Presentation = Schema.Schema.Type<typeof PresentationSchema>;
export type Talk = Schema.Schema.Type<typeof TalkSchema>;
export type Article = Schema.Schema.Type<typeof ArticleSchema>;
export type YoutubeVideo = Schema.Schema.Type<typeof YoutubeVideoSchema>;
export type SiteSettings = Schema.Schema.Type<typeof SiteSettingsDocumentSchema>;
