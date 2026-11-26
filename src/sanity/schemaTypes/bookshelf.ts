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
 * The slug identifies the shelf: its page (/bookshelf/shelf/<slug>) and its /bookshelf filter
 * (`?shelf=<slug>`). The title is the track label its books show and the label of its filter
 * chip, so it must be unique among shelves (old shared `?track=<title>` links find a shelf by its
 * title) and must not read as "All", the chip that shows every shelf (rules shared in
 * ../bookshelf-rules.ts).
 *
 * Relative imports only: the Studio's own build does not resolve the app's '@/' alias.
 */

import {
  type CustomValidatorResult,
  defineField,
  defineType,
  type ValidationContext,
} from 'sanity';
import {
  isReservedShelfTitle,
  SHELF_TITLE_DUPLICATE_MESSAGE,
  SHELF_TITLE_RESERVED_MESSAGE,
  shelfTitleKey,
} from '../bookshelf-rules';

/**
 * The API version the title check reads with. Before 2025-02-19 a query's default perspective is
 * raw, so the check sees every shelf, published or draft.
 */
const SHELF_TITLES_API_VERSION = '2024-10-14';

/**
 * Every shelf's title except the edited shelf's own (its published `$published` and draft ids).
 * Release versions (`versions.<release>.<id>`) are left out: they are pending copies of shelves
 * already counted, and comparing against them would flag a shelf as a duplicate of itself.
 */
const OTHER_SHELF_TITLES_QUERY =
  '*[_type == "bookshelf" && !(_id in path("versions.**")) && !(_id in [$published, $draft])].title';

const DRAFT_PREFIX = 'drafts.';
const VERSION_PREFIX = 'versions.';

/** The published id behind a published, draft (`drafts.<id>`) or release version id. */
export function publishedShelfId(id: string): string {
  if (id.startsWith(DRAFT_PREFIX)) return id.slice(DRAFT_PREFIX.length);
  if (id.startsWith(VERSION_PREFIX)) return id.split('.').slice(2).join('.');
  return id;
}

/**
 * A title the /bookshelf filter chips could not tell apart, as an error: "All" in any case, or a
 * title another shelf has, compared trimmed and in any case. An empty title is left to
 * `required()`, and the check skips a value with no document to compare against.
 */
export async function validateShelfTitle(
  value: string | undefined,
  context: ValidationContext,
): Promise<CustomValidatorResult> {
  if (!value?.trim()) return true;
  if (isReservedShelfTitle(value)) {
    return { message: SHELF_TITLE_RESERVED_MESSAGE, code: 'custom.shelf-title-reserved' };
  }
  const id = context.document?._id;
  if (!id) return true;
  const published = publishedShelfId(id);
  const titles = await context
    .getClient({ apiVersion: SHELF_TITLES_API_VERSION })
    .fetch<unknown>(
      OTHER_SHELF_TITLES_QUERY,
      { published, draft: `${DRAFT_PREFIX}${published}` },
      { signal: context.signal, tag: 'validation.shelf-title-is-unique' },
    );
  const key = shelfTitleKey(value);
  const taken =
    Array.isArray(titles) &&
    titles.some((title) => typeof title === 'string' && shelfTitleKey(title) === key);
  return taken
    ? { message: SHELF_TITLE_DUPLICATE_MESSAGE, code: 'custom.shelf-title-duplicate' }
    : true;
}

export const bookshelfType = defineType({
  name: 'bookshelf',
  title: 'Bookshelf Collection',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Shelf Title',
      type: 'string',
      description:
        'The track label its books show and the label of its /bookshelf filter chip: unique, and not "All".',
      validation: (Rule) => Rule.required().custom(validateShelfTitle),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      description:
        'Identifies the shelf: its page (/bookshelf/shelf/<slug>) and its /bookshelf filter (?shelf=<slug>). Changing it breaks links to both.',
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
  ],
  orderings: [{ title: 'Position', name: 'orderAsc', by: [{ field: 'order', direction: 'asc' }] }],
  preview: {
    select: {
      title: 'title',
      subtitle: 'description',
    },
  },
});
