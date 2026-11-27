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

import { Option, Predicate, Result, Schema, SchemaGetter, SchemaTransformation } from 'effect';
import { PLACE_CATEGORIES } from '@/lib/places/categories';
import {
  BOOK_STATUSES,
  isBookCoverRef,
  isBookSlug,
  RESERVED_BOOK_SLUGS,
} from '@/sanity/bookshelf-rules';
import {
  hasMediaText,
  isCaptionsLanguage,
  isMediaFileUrl,
  isMediaImageRef,
  isMediaLink,
} from '@/sanity/portfolio-media-rules';
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

/** GROQ null means absent, while an explicitly undefined optional value stays undefined. */
const optionalNullable = <S extends Schema.Constraint>(schema: S) =>
  Schema.optional(Schema.NullOr(schema)).pipe(
    Schema.decodeTo(Schema.optional(Schema.toType(schema)), {
      decode: SchemaGetter.transformOptional(Option.filter(Predicate.isNotNull)),
      encode: SchemaGetter.passthrough(),
    }),
  );

/** The media contract is optional and tolerant at its array boundary, strict per item. */
const MediaText = Schema.String.check(Schema.makeFilter(hasMediaText));
const MediaImage = SanityImageSchema.check(
  Schema.makeFilter((image) => isMediaImageRef(image.asset._ref)),
);
const VideoFile = ResolvedSanityFileSchema.check(
  Schema.makeFilter(
    (file) =>
      isMediaFileUrl(file.url, ['mp4', 'webm']) &&
      (file.mimeType == null ||
        file.mimeType ===
          (new URL(file.url).pathname.endsWith('.mp4') ? 'video/mp4' : 'video/webm')),
  ),
);
const CaptionsFile = ResolvedSanityFileSchema.check(
  Schema.makeFilter(
    (file) =>
      isMediaFileUrl(file.url, ['vtt']) &&
      (file.mimeType == null ||
        ['text/vtt', 'text/plain', 'application/octet-stream'].includes(file.mimeType)),
  ),
);
const PortfolioPhotoSchema = Schema.Struct({
  _key: MediaText,
  _type: Schema.Literal('portfolioPhoto'),
  image: MediaImage,
  alt: MediaText,
  caption: optionalNullable(Schema.String),
});
const PortfolioVideoSchema = Schema.Struct({
  _key: MediaText,
  _type: Schema.Literal('portfolioVideo'),
  title: MediaText,
  file: optionalNullable(VideoFile),
  externalUrl: optionalNullable(Schema.String.check(Schema.makeFilter(isMediaLink))),
  poster: optionalNullable(MediaImage),
  caption: optionalNullable(Schema.String),
  captionsFile: optionalNullable(CaptionsFile),
  captionsLanguage: optionalNullable(Schema.String),
  captionsLabel: optionalNullable(Schema.String),
}).check(
  Schema.makeFilter(
    (video) =>
      Boolean(video.file) !== Boolean(video.externalUrl) &&
      (!video.captionsFile ||
        Boolean(
          video.file &&
            video.captionsLanguage &&
            isCaptionsLanguage(video.captionsLanguage) &&
            hasMediaText(video.captionsLabel),
        )),
  ),
);
const PortfolioMediaItemSchema = Schema.Union([PortfolioPhotoSchema, PortfolioVideoSchema]);
export type PortfolioMediaItem = Schema.Schema.Type<typeof PortfolioMediaItemSchema>;

/** One broken upload must never remove its readable project, experience or sibling media. */
export function portfolioMediaOf(value: unknown): readonly PortfolioMediaItem[] {
  if (!Array.isArray(value)) return [];
  const decode = Schema.decodeUnknownResult(PortfolioMediaItemSchema);
  const keys = new Set<string>();
  return value.flatMap((item) => {
    const result = decode(item);
    if (Result.isFailure(result) || keys.has(result.success._key)) return [];
    keys.add(result.success._key);
    return [result.success];
  });
}
const portfolioMediaValue = Schema.Unknown.pipe(
  Schema.decodeTo(Schema.Array(Schema.toType(PortfolioMediaItemSchema)), {
    decode: SchemaGetter.transform(portfolioMediaOf),
    encode: SchemaGetter.passthrough(),
  }),
);

/** Legacy GROQ booleans may be missing or null; both mean the unchecked default. */
const NullableBooleanDefaultFalse = Schema.optional(Schema.NullOr(Schema.Boolean)).pipe(
  Schema.decodeTo(Schema.Boolean, {
    decode: SchemaGetter.transformOptional((value) =>
      value.pipe(
        Option.filter(Predicate.isNotNullish),
        Option.orElseSome(() => false),
      ),
    ),
    encode: SchemaGetter.required(),
  }),
);

/** Sanity Experience Schema with Effect Schema validation. */
export const ExperienceSubRoleSchema = Schema.Struct({
  _key: Schema.String,
  _type: optionalNullable(Schema.Literal('experienceSubRole')),
  position: Schema.String,
  employmentType: Schema.optional(Schema.NullOr(Schema.String)),
  startDate: Schema.String,
  endDate: Schema.optional(Schema.NullOr(Schema.String)),
  current: NullableBooleanDefaultFalse,
  description: Schema.optional(Schema.NullOr(Schema.String)),
  responsibilities: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
  technologies: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
  media: Schema.optional(portfolioMediaValue),
});

/** A malformed child must not invalidate an otherwise readable parent engagement. */
const experienceSubRolesValue = Schema.Unknown.pipe(
  Schema.decodeTo(Schema.NullOr(Schema.Array(ExperienceSubRoleSchema)), {
    decode: SchemaGetter.transform((value) => {
      if (value === null) return null;
      if (!Array.isArray(value)) return [];
      const decode = Schema.decodeUnknownResult(ExperienceSubRoleSchema);
      return value.flatMap((child) => {
        const result = decode(child);
        return Result.isSuccess(result) ? [result.success] : [];
      });
    }),
    encode: SchemaGetter.passthrough(),
  }),
);

export const ExperienceSchema = Schema.Struct({
  _id: Schema.String,
  _type: Schema.Literal('experience'),
  _createdAt: Schema.String,
  _updatedAt: Schema.String,
  _rev: Schema.String,
  position: Schema.String,
  employmentType: Schema.optional(Schema.NullOr(Schema.String)),
  dateNote: Schema.optional(Schema.NullOr(Schema.String)),
  company: Schema.String,
  companyUrl: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  logo: Schema.optional(Schema.Union([SanityImageSchema, Schema.Null])),
  location: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  description: Schema.String,
  responsibilities: Schema.optional(Schema.Array(Schema.String)),
  technologies: Schema.optional(Schema.Array(Schema.String)),
  subRoles: Schema.optional(experienceSubRolesValue),
  media: Schema.optional(portfolioMediaValue),
  startDate: Schema.String,
  endDate: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  current: Schema.Boolean,
  order: Schema.Number,
});

/**
 * One part of a multi-repository project, as the project queries' parts projection answers it.
 * Only the key is required: Studio requires a name and a role, but an old or half-typed draft
 * must never drop its project, so the /projects view model drops a nameless row instead.
 */
export const ProjectPartSchema = Schema.Struct({
  _key: Schema.String,
  _type: optionalNullable(Schema.Literal('projectPart')),
  name: optionalNullable(Schema.String),
  role: optionalNullable(Schema.String),
  repoUrl: optionalNullable(Schema.String),
  /** The id of another project's page this part links, unresolved (project._ref). */
  projectId: optionalNullable(Schema.String),
  technologies: optionalNullable(Schema.Array(Schema.String)),
  contribution: optionalNullable(Schema.String),
});
export type ProjectPart = Schema.Schema.Type<typeof ProjectPartSchema>;

/**
 * A malformed part must not invalidate its readable project: the loaders drop a whole document
 * that fails to decode, which would take the project off /projects, its page, the sitemap and
 * the home page. Copied from experienceSubRolesValue rather than shared, so experience decoding
 * stays exactly as it is.
 */
const projectPartsValue = Schema.Unknown.pipe(
  Schema.decodeTo(Schema.NullOr(Schema.Array(ProjectPartSchema)), {
    decode: SchemaGetter.transform((value) => {
      if (value === null) return null;
      if (!Array.isArray(value)) return [];
      const decode = Schema.decodeUnknownResult(ProjectPartSchema);
      return value.flatMap((part) => {
        const result = decode(part);
        return Result.isSuccess(result) ? [result.success] : [];
      });
    }),
    encode: SchemaGetter.passthrough(),
  }),
);

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
  longDescription: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  image: Schema.optional(Schema.Union([SanityImageSchema, Schema.Null])),
  images: Schema.optional(Schema.Union([Schema.Array(SanityImageSchema), Schema.Null])),
  media: Schema.optional(portfolioMediaValue),
  category: Schema.String, // Allow any string for flexible categorization
  technologies: Schema.Array(Schema.String),
  status: Schema.String, // Allow any string for flexible status combinations
  featured: Schema.Boolean,
  /**
   * The Studio "Featured rank": puts the project in the Featured group at the top of /projects,
   * lowest first. Documents written before the field existed have no value, and GROQ answers
   * null for them: both decode as absent, so no project is dropped for lacking one.
   */
  featuredRank: optionalNullable(Schema.Number),
  liveUrl: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  githubUrl: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  /**
   * "How it fits together": the repositories a multi-repository project is made of, in Studio
   * order. GROQ answers null for a document without them; a malformed part is dropped alone.
   */
  systemParts: Schema.optional(projectPartsValue),
  /** The parts' optional lead sentence; null (every document written before it) reads as absent. */
  systemSummary: optionalNullable(Schema.String),
  startDate: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  endDate: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
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
  description: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  image: Schema.optional(Schema.Union([SanityImageSchema, Schema.Null])),
  credentialId: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  credentialUrl: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  issueDate: Schema.String,
  expiryDate: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  skills: Schema.optional(Schema.Union([Schema.Array(Schema.String), Schema.Null])),
  /**
   * The Studio switch for the /certifications Featured row. Documents written before the field
   * existed have no value, and GROQ answers null for them: both decode as false.
   */
  featured: NullableBooleanDefaultFalse,
  order: Schema.Number,
});

const SANITY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar day in Sanity `date` format (YYYY-MM-DD); rejects e.g. 2026-02-30. */
const isSanityDate = (value: string): boolean =>
  SANITY_DATE_PATTERN.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

const SanityDateSchema = Schema.String.pipe(
  Schema.check(Schema.makeFilter(isSanityDate, { message: 'Expected a YYYY-MM-DD calendar date' })),
);

/**
 * Optional Sanity `date` value. Malformed strings decode to null (treated as undated) rather
 * than failing: the places list is decoded as one array, so a hard failure on a single
 * document's date would blank the whole page. Non-ISO strings must not reach date formatting,
 * where `new Date()` would read them in local time and shift the day.
 */
const LenientSanityDateSchema = Schema.NullOr(Schema.String).pipe(
  Schema.decodeTo(
    Schema.NullOr(SanityDateSchema),
    SchemaTransformation.transform({
      decode: (value) => (value !== null && isSanityDate(value) ? value : null),
      encode: (value) => value,
    }),
  ),
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
  category: Schema.Literals(PLACE_CATEGORIES),
  latitude: Schema.Number,
  longitude: Schema.Number,
  startDate: Schema.optional(LenientSanityDateSchema),
  endDate: Schema.optional(LenientSanityDateSchema),
  photos: Schema.optional(Schema.Union([Schema.Array(SanityImageSchema), Schema.Null])),
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
export const SlidesFormatSchema = Schema.Union([
  Schema.Literal('pdf'),
  Schema.Literal('google_slides'),
  Schema.Literal('speakerdeck'),
  Schema.Literal('slideshare'),
  Schema.Literal('canva'),
  Schema.Literal('other_url'),
  Schema.Literal('none'),
]);

/**
 * Video format type for type-safe format handling
 */
export const VideoFormatSchema = Schema.Union([
  Schema.Literal('youtube'),
  Schema.Literal('vimeo'),
  Schema.Literal('other'),
  Schema.Literal('none'),
]);

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
  eventUrl: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  date: Schema.String,
  slidesFormat: Schema.optional(Schema.Union([SlidesFormatSchema, Schema.Null])),
  slidesPdfUrl: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  slidesPdf: Schema.optional(Schema.Union([SanityFileSchema, Schema.Null])),
  slidesUrl: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  videoUrl: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  thumbnailImage: Schema.optional(Schema.Union([SanityImageSchema, Schema.Null])),
  tags: Schema.optional(Schema.Union([Schema.Array(Schema.String), Schema.Null])),
  location: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  order: Schema.Number,
});

/**
 * Talk slides format - simplified version with only PDF and URL options
 */
export const TalkSlidesFormatSchema = Schema.Union([
  Schema.Literal('pdf'),
  Schema.Literal('url'),
  Schema.Literal('none'),
]);

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
  videoFormat: Schema.optional(Schema.Union([VideoFormatSchema, Schema.Null])),
  videoUrl: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  slidesFormat: Schema.optional(Schema.Union([TalkSlidesFormatSchema, Schema.Null])),
  slidesPdfUrl: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  slidesPdf: Schema.optional(Schema.Union([SanityFileSchema, Schema.Null])),
  slidesUrl: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  thumbnailImage: Schema.optional(Schema.Union([SanityImageSchema, Schema.Null])),
  duration: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  tags: Schema.optional(Schema.Union([Schema.Array(Schema.String), Schema.Null])),
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
  coverImage: Schema.optional(Schema.Union([SanityImageSchema, Schema.Null])),
  coAuthors: Schema.optional(Schema.Union([Schema.Array(Schema.String), Schema.Null])),
  tags: Schema.optional(Schema.Union([Schema.Array(Schema.String), Schema.Null])),
  order: Schema.Number,
});

/**
 * The longest video title and description decoded. YouTube allows 100 characters and 5,000 bytes,
 * so every real upload fits; a longer one (a mistaken or tampered CMS entry) is dropped with the
 * decode warning, because /media's title and description matching takes time that grows with
 * the square of the text and would slow every page that builds the feed.
 */
const YOUTUBE_TITLE_MAX = 300;
const YOUTUBE_DESCRIPTION_MAX = 5_000;

/**
 * Sanity YouTube Video Schema with Effect Schema validation
 */
export const YoutubeVideoSchema = Schema.Struct({
  _id: Schema.String,
  _type: Schema.Literal('youtubeVideo'),
  _createdAt: Schema.String,
  _updatedAt: Schema.String,
  _rev: Schema.String,
  title: Schema.String.check(Schema.isMaxLength(YOUTUBE_TITLE_MAX)),
  description: Schema.String.check(Schema.isMaxLength(YOUTUBE_DESCRIPTION_MAX)),
  videoId: Schema.String,
  publishedDate: Schema.String,
  thumbnail: Schema.optional(Schema.Union([SanityImageSchema, Schema.Null])),
  duration: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  tags: Schema.optional(Schema.Union([Schema.Array(Schema.String), Schema.Null])),
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
const siteStringSchema = (predicate: (value: string) => boolean, message: string) =>
  Schema.String.annotate({ message }).pipe(
    Schema.decodeTo(
      Schema.String.check(Schema.makeFilter(predicate, { message })),
      SchemaTransformation.transform({
        decode: (value) => value.trim(),
        encode: (value) => value,
      }),
    ),
  );

/** Hero text: trimmed, not blank, at most `maxLength` characters. */
const siteTextSchema = (maxLength: number) =>
  siteStringSchema(
    (value) => value.length > 0 && value.length <= maxLength,
    `Expected text of 1 to ${maxLength} characters`,
  );

/** An address a mailto link carries as it is (isSiteEmail): no '?', '&' or '#'. */
const SiteEmailSchema = siteStringSchema(
  isSiteEmail,
  'Expected an email address without ?, & or #',
);

const HttpsUrlSchema = siteStringSchema(
  isSiteHttpsUrl,
  'Expected an https URL without credentials',
);

/** Every invalid field is reported, not just the first, and the loader keeps the valid ones. */
const SiteSettingsFieldsSchema = Schema.Struct({
  _id: Schema.String,
  _type: Schema.Literal('siteSettings'),
  location: Schema.optionalKey(siteTextSchema(SITE_LOCATION_MAX_LENGTH)),
  tagline: Schema.optionalKey(siteTextSchema(SITE_TAGLINE_MAX_LENGTH)),
  email: Schema.optionalKey(SiteEmailSchema),
  githubUrl: Schema.optionalKey(HttpsUrlSchema),
  linkedinUrl: Schema.optionalKey(HttpsUrlSchema),
});

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
export const SiteSettingsDocumentSchema = Schema.Record(Schema.String, Schema.Unknown).pipe(
  Schema.decodeTo(SiteSettingsFieldsSchema, {
    decode: SchemaGetter.transform(
      (doc) =>
        Object.fromEntries(
          Object.entries(doc).filter((entry) => !isUnset(entry)),
        ) as typeof SiteSettingsFieldsSchema.Encoded,
    ),
    encode: SchemaGetter.passthrough(),
  }),
);

/**
 * A book's slug, checked with the rule Studio applies (src/sanity/bookshelf-rules.ts), so a
 * published book is always a routable /bookshelf/<slug> segment that no fixed page (such as
 * /bookshelf/free) takes.
 */
const BookSlugSchema = Schema.Struct({
  _type: Schema.Literal('slug'),
  current: Schema.String.check(
    Schema.makeFilter(isBookSlug, {
      message: `Expected a slug of lowercase letters and digits joined by single hyphens, other than ${RESERVED_BOOK_SLUGS.join(', ')}`,
    }),
  ),
});

/**
 * A book's cover: an image whose asset reference names an image asset (isBookCoverRef in
 * src/sanity/bookshelf-rules.ts), so the image URL builder can always draw it. Studio's image
 * field only takes image assets, but the API can write any reference there.
 */
const BookCoverSchema = Schema.Struct({
  ...SanityImageSchema.fields,
  asset: Schema.Struct({
    ...SanityImageAssetSchema.fields,
    _ref: Schema.String.check(
      Schema.makeFilter(isBookCoverRef, {
        message: 'Expected an image asset reference, image-<id>-<width>x<height>-<format>',
      }),
    ),
  }),
});

/**
 * A book, decoded strictly against the rules Studio applies before Publish: its status is one of
 * the shared statuses, its slug is routable, and its cover image asset and shelf (`shelfId`, the
 * shelf reference's _id) are required. The loaders decode each document on its own (decodeEach),
 * so an invalid book is dropped and reported once rather than patched up by the site.
 */
export const BookSchema = Schema.Struct({
  _id: Schema.String,
  _type: Schema.Literal('book'),
  _createdAt: Schema.String,
  _updatedAt: Schema.String,
  _rev: Schema.String,
  title: Schema.String,
  slug: BookSlugSchema,
  spineTitle: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  authors: Schema.String,
  spineAuthor: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  publisher: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  edition: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  year: Schema.optional(Schema.Union([Schema.Number, Schema.Null])),
  isbn: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  status: Schema.Literals(BOOK_STATUSES),
  summary: Schema.String,
  coverImage: BookCoverSchema,
  shelfId: Schema.String,
  url: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  topics: Schema.optional(Schema.Union([Schema.Array(Schema.String), Schema.Null])),
  order: Schema.Number,
});

/**
 * A bookshelf: a titled, ordered section. It lists no books; each book names its shelf by
 * `shelfId`, and the bookshelf loader joins the two.
 */
export const BookshelfSchema = Schema.Struct({
  _id: Schema.String,
  _type: Schema.Literal('bookshelf'),
  _createdAt: Schema.String,
  _updatedAt: Schema.String,
  _rev: Schema.String,
  title: Schema.String,
  slug: SanitySlugSchema,
  description: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
  order: Schema.Number,
});

/**
 * The places list as one schema. The loaders decode each document on its own (decodeEach), so
 * one bad document is dropped rather than failing the list; this whole-list form is kept only
 * for the schema tests (place-schema.test.ts).
 */
export const PlacesSchema = Schema.Array(PlaceSchema);
export type Experience = Schema.Schema.Type<typeof ExperienceSchema>;
export type Project = Schema.Schema.Type<typeof ProjectSchema>;
export type Certification = Schema.Schema.Type<typeof CertificationSchema>;
export type Place = Schema.Schema.Type<typeof PlaceSchema>;
export type Resume = Schema.Schema.Type<typeof ResumeSchema>;
export type Presentation = Schema.Schema.Type<typeof PresentationSchema>;
export type Talk = Schema.Schema.Type<typeof TalkSchema>;
export type Article = Schema.Schema.Type<typeof ArticleSchema>;
export type YoutubeVideo = Schema.Schema.Type<typeof YoutubeVideoSchema>;
export type SiteSettings = Schema.Schema.Type<typeof SiteSettingsDocumentSchema>;
export type SanityBook = Schema.Schema.Type<typeof BookSchema>;
export type SanityBookshelf = Schema.Schema.Type<typeof BookshelfSchema>;
