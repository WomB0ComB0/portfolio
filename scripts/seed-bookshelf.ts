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
 * Idempotent seed script that uploads the 14 curated engineering books and 4 shelf collections
 * into Sanity Studio (`book` and `bookshelf` document types).
 *
 * Usage:
 *   SANITY_API_WRITE_TOKEN=... bun run scripts/seed-bookshelf.ts
 */

import { createClient } from '@sanity/client';
import { BOOKS, DEFAULT_SHELVES } from '../src/app/(routes)/(main)/(personal)/bookshelf/_lib/books';

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_READ_TOKEN;

if (!projectId || !token) {
  console.error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_API_WRITE_TOKEN in environment.');
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: '2025-01-01',
  token,
  useCdn: false,
});

async function seed(): Promise<void> {
  const tx = client.transaction();

  for (const book of BOOKS) {
    tx.createOrReplace({
      _id: `book-${book.slug}`,
      _type: 'book',
      title: book.title,
      slug: { _type: 'slug', current: book.slug },
      spineTitle: book.spineTitle,
      authors: book.authors,
      spineAuthor: book.spineAuthor,
      publisher: book.publisher,
      edition: book.edition,
      year: book.year,
      isbn: book.isbn,
      track: book.track,
      status: book.status,
      summary: book.summary,
      coverUrl: book.coverSrc,
      url: book.url,
      spine: {
        capBg: book.spine.capBg,
        capText: book.spine.capText,
        bodyBg: book.spine.bodyBg,
        titleColor: book.spine.titleColor,
        authorColor: book.spine.authorColor,
      },
      topics: book.topics.map((topic) => topic.title),
      order: book.stage,
    });
  }

  for (const [index, shelf] of DEFAULT_SHELVES.entries()) {
    tx.createOrReplace({
      _id: `bookshelf-${shelf.slug}`,
      _type: 'bookshelf',
      title: shelf.title,
      slug: { _type: 'slug', current: shelf.slug },
      description: shelf.description,
      accentColor: shelf.accentColor,
      order: index + 1,
      featured: true,
      books: shelf.bookSlugs.map((slug) => ({
        _key: slug,
        _type: 'reference',
        _ref: `book-${slug}`,
      })),
    });
  }

  await tx.commit();
  console.log(`Seeded ${BOOKS.length} books and ${DEFAULT_SHELVES.length} shelves to ${dataset}.`);
}

await seed();
