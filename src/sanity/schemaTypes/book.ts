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

/**
 * @file A book on the /bookshelf: its bibliographic facts, reading status, cover asset and the one
 * shelf (a `bookshelf` document) it sits on. The site numbers stages shelf by shelf, in shelf
 * order and then in this document's `order`, and takes the track label from the shelf's title.
 * The 3D spine colours are a UI palette in code, not content.
 *
 * Studio and the site's decoder share the status list, slug pattern and ISBN check
 * (../bookshelf-rules.ts).
 *
 * Relative imports only: the Studio's own build does not resolve the app's '@/' alias.
 */

import { type CustomValidatorResult, defineField, defineType } from 'sanity';
import {
  BOOK_DEFAULT_STATUS,
  BOOK_ISBN_MESSAGE,
  BOOK_SLUG_MESSAGE,
  BOOK_STATUS_LABELS,
  BOOK_STATUSES,
  isBookSlug,
  isBookStatus,
  isIsbn,
  isReservedBookSlug,
  RESERVED_BOOK_SLUGS,
  reservedBookSlugMessage,
} from '../bookshelf-rules';

/**
 * A slug the site cannot route, as an error: one a fixed /bookshelf page takes, or one of the
 * wrong shape. An empty slug is left to `required()`.
 */
function bookSlug(value: { readonly current?: string } | undefined): CustomValidatorResult {
  const slug = value?.current;
  if (!slug || isBookSlug(slug)) return true;
  return isReservedBookSlug(slug)
    ? { message: reservedBookSlugMessage(slug), code: 'custom.book-slug-reserved' }
    : { message: BOOK_SLUG_MESSAGE, code: 'custom.book-slug' };
}

/** An ISBN with a bad shape or check digit, as an error; the field is optional. */
const bookIsbn = (value: string | undefined): CustomValidatorResult =>
  !value || isIsbn(value) ? true : { message: BOOK_ISBN_MESSAGE, code: 'custom.book-isbn' };

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
      description: `The /bookshelf/<slug> URL: lowercase letters and digits joined by hyphens, other than ${RESERVED_BOOK_SLUGS.map((slug) => `"${slug}"`).join(', ')}.`,
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required().custom(bookSlug),
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
      description:
        'ISBN-13 or ISBN-10, hyphens optional (can be looked up via /api/v1/books/lookup?isbn=...)',
      validation: (Rule) => Rule.custom(bookIsbn),
    }),
    defineField({
      name: 'shelf',
      title: 'Shelf',
      type: 'reference',
      to: [{ type: 'bookshelf' }],
      description:
        'The shelf this book sits on. Its title is the track label, and its order places the book on the 3D shelf.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'status',
      title: 'Reading Status',
      type: 'string',
      description: 'Whether you have read this book, are currently reading it, or have it queued.',
      options: {
        list: BOOK_STATUSES.map((status) => ({ title: BOOK_STATUS_LABELS[status], value: status })),
        layout: 'radio',
      },
      initialValue: BOOK_DEFAULT_STATUS,
      validation: (Rule) => Rule.required(),
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
      options: { hotspot: true, accept: 'image/jpeg,image/png,image/webp,image/avif' },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alternative Text',
          description: 'Optional; defaults to "<title> by <authors>"',
        },
      ],
      // assetRequired: an alt-only cover would publish, then fail the site's decode and 404 the book.
      validation: (Rule) => Rule.required().assetRequired(),
    }),
    defineField({
      name: 'url',
      title: 'Book URL',
      type: 'url',
      description: 'Publisher page, official site, or reference link.',
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
      description:
        'Position within its shelf; books sort by shelf order, then this. Existing books use steps of 10.',
      validation: (Rule) => Rule.required(),
    }),
  ],
  orderings: [{ title: 'Position', name: 'orderAsc', by: [{ field: 'order', direction: 'asc' }] }],
  preview: {
    select: {
      title: 'title',
      shelf: 'shelf.title',
      status: 'status',
      order: 'order',
      media: 'coverImage',
    },
    prepare({ title, shelf, status, order, media }) {
      return {
        title,
        subtitle: [
          shelf,
          order != null ? `#${order}` : null,
          isBookStatus(status) ? BOOK_STATUS_LABELS[status] : null,
        ]
          .filter(Boolean)
          .join(' · '),
        media,
      };
    },
  },
});
