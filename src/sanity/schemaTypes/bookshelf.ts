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
 * @file A shelf on the /bookshelf: a titled, ordered section. Each book names its one shelf (the
 * book's required `shelf` reference), so a shelf lists no books itself: the site gathers them by
 * that reference and numbers stages shelf by shelf, in this document's `order`.
 *
 * `books` is a hidden legacy field: the site code deployed before the shelf reference still reads
 * a shelf's books from it, so it stays until the data migration's finalize step unsets it.
 */

import { defineField, defineType } from 'sanity';

export const bookshelfType = defineType({
  name: 'bookshelf',
  title: 'Bookshelf Collection',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Shelf Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'order',
      title: 'Display Order',
      type: 'number',
      description: 'Shelf position; stages are numbered shelf by shelf in this order',
      initialValue: 0,
      validation: (Rule) => Rule.required(),
    }),
    // Legacy: the site code deployed before the shelf reference reads a shelf's books from here.
    // Hidden and read-only, never removed from the schema, until the migration's finalize step
    // unsets it.
    defineField({
      name: 'books',
      title: 'Books on this Shelf (legacy)',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'book' }] }],
      hidden: true,
      readOnly: true,
      description: "Legacy: replaced by each book's Shelf; removed after the migration",
    }),
  ],
  orderings: [{ title: 'Position', name: 'orderAsc', by: [{ field: 'order', direction: 'asc' }] }],
  preview: {
    select: {
      title: 'title',
      subtitle: 'description',
    },
  },
});
