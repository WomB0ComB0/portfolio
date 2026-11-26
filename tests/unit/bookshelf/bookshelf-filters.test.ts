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
 * @file The /bookshelf filter maths (bookshelf-filters.ts). A shelf filter's identity is the
 * shelf's slug, never its title.
 * - buildShelfTabs: one chip per shelf slug on the stage, in stage order, with its book count, so
 *   two shelves with one title are two chips.
 * - resolveShelfFilter: `?shelf=<slug>` when it names a shelf on the stage; else a legacy
 *   `?track=<title>` link mapped to the one shelf with that title; else a slug typed into
 *   `?track=`; else no filter. "All" is never a shelf value, so a shelf whose slug is "all" is
 *   a shelf like any other.
 * - matchesFilter: a book matches when it is on the filtered shelf (any, with none) and has the
 *   filtered status (any, with 'all').
 * - countStatuses: the status chips' counts, 'all' being every book.
 * The shelves are the production titles and slugs; the books are fixture documents joined by the
 * real buildBookshelfCatalog.
 */

import { makeBook, makeBookshelf } from '@tests/fixtures/sanity-docs';
import { describe, expect, it, vi } from 'vitest';

// The catalog builder draws each cover with the real image URL builder; the client module itself
// reads server configuration on import.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return {
    sanityFetchWithToken: vi.fn(),
    urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source),
  };
});
// Only buildBookshelfCatalog is used here; the cached Sanity loaders are never asked.
vi.mock('@/lib/sanity/loaders', () => ({ loadBookshelf: vi.fn() }));

import {
  type BookStatusFilter,
  buildShelfTabs,
  countStatuses,
  matchesFilter,
  resolveShelfFilter,
  type ShelfTab,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/bookshelf-filters';
import { buildBookshelfCatalog } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/load-bookshelf';
import { catalogOf } from './bookshelf-fixtures';

/** Production's shelves (2026-11-26) as chips: title, slug and book count. */
const PRODUCTION_TABS: readonly ShelfTab[] = [
  { slug: 'web-and-languages', title: 'Web & Languages', count: 7 },
  { slug: 'backend', title: 'Backend', count: 7 },
  { slug: 'ai', title: 'AI', count: 12 },
  { slug: 'infra-and-ops', title: 'Infra & Ops', count: 6 },
  { slug: 'reasoning-and-systems', title: 'Reasoning & Systems', count: 7 },
];

/** Two shelves of mixed reading statuses: Backend (read, unread), then AI (reading, read). */
function mixedBooks() {
  const backend = makeBookshelf({ title: 'Backend', slug: { _type: 'slug', current: 'backend' } });
  const ai = makeBookshelf({ title: 'AI', slug: { _type: 'slug', current: 'ai' } });
  return buildBookshelfCatalog(
    [
      makeBook({ shelfId: backend._id, status: 'completed' }),
      makeBook({ shelfId: backend._id, status: 'queued' }),
      makeBook({ shelfId: ai._id, status: 'reading' }),
      makeBook({ shelfId: ai._id, status: 'completed' }),
    ],
    [backend, ai],
  ).books;
}

describe('buildShelfTabs', () => {
  it('makes one chip per shelf slug, in stage order, with its book count', () => {
    const { books } = catalogOf([
      ['Backend', 'backend', 3],
      ['AI', 'ai', 2],
      ['Web & Languages', 'web-and-languages', 1],
    ]);

    expect(buildShelfTabs(books)).toEqual([
      { slug: 'backend', title: 'Backend', count: 3 },
      { slug: 'ai', title: 'AI', count: 2 },
      { slug: 'web-and-languages', title: 'Web & Languages', count: 1 },
    ]);
  });

  it('keeps two shelves with one title apart, by slug', () => {
    const { books } = catalogOf([
      ['Systems', 'systems-intro', 2],
      ['Systems', 'systems-advanced', 3],
    ]);

    expect(buildShelfTabs(books)).toEqual([
      { slug: 'systems-intro', title: 'Systems', count: 2 },
      { slug: 'systems-advanced', title: 'Systems', count: 3 },
    ]);
  });

  it('makes no chip for no books', () => {
    expect(buildShelfTabs([])).toEqual([]);
  });
});

describe('resolveShelfFilter', () => {
  it.each([
    ['?shelf= naming a shelf', 'ai', null, 'ai'],
    ['?shelf= winning over ?track=', 'backend', 'AI', 'backend'],
    ['a legacy ?track=<title>', null, 'AI', 'ai'],
    ['a legacy title with an ampersand', null, 'Web & Languages', 'web-and-languages'],
    ['a legacy title when ?shelf= names no shelf', 'bogus', 'Infra & Ops', 'infra-and-ops'],
    ['a slug typed into ?track=', null, 'reasoning-and-systems', 'reasoning-and-systems'],
  ] as const)('resolves %s', (_case, shelf, track, slug) => {
    expect(resolveShelfFilter(shelf, track, PRODUCTION_TABS)).toBe(slug);
  });

  it.each([
    ['no parameter', null, null],
    ['an unknown ?shelf=', 'nope', null],
    ['an unknown ?track=', null, 'Nope'],
    ['a title with a trailing space', null, 'Backend '],
    ['a title in another case', null, 'Ai'],
    ['"All", which is the reset and no shelf', null, 'All'],
    ['a ?shelf= of "all" with no such shelf', 'all', null],
  ] as const)('resolves %s to no filter', (_case, shelf, track) => {
    expect(resolveShelfFilter(shelf, track, PRODUCTION_TABS)).toBeNull();
  });

  it('resolves a title two shelves share to no filter rather than guess', () => {
    const tabs: readonly ShelfTab[] = [
      { slug: 'systems-intro', title: 'Systems', count: 2 },
      { slug: 'systems-advanced', title: 'Systems', count: 3 },
    ];

    expect(resolveShelfFilter(null, 'Systems', tabs)).toBeNull();
    expect(resolveShelfFilter('systems-advanced', 'Systems', tabs)).toBe('systems-advanced');
  });

  it('keeps a shared title ambiguous even when one of those shelves has it as its slug', () => {
    const tabs: readonly ShelfTab[] = [
      { slug: 'systems', title: 'systems', count: 2 },
      { slug: 'systems-advanced', title: 'systems', count: 3 },
    ];

    expect(resolveShelfFilter(null, 'systems', tabs)).toBeNull();
    // A slug typed into ?track= with no title match still resolves.
    expect(resolveShelfFilter(null, 'systems-advanced', tabs)).toBe('systems-advanced');
  });

  it('treats a shelf whose slug is "all" as a shelf, apart from the All reset (null)', () => {
    const tabs: readonly ShelfTab[] = [
      { slug: 'all', title: 'All', count: 4 },
      { slug: 'ai', title: 'AI', count: 2 },
    ];

    expect(resolveShelfFilter('all', null, tabs)).toBe('all');
    expect(resolveShelfFilter(null, 'All', tabs)).toBe('all');
    expect(resolveShelfFilter(null, null, tabs)).toBeNull();
  });
});

describe('matchesFilter', () => {
  const books = mixedBooks();
  const matching = (shelf: string | null, status: BookStatusFilter): readonly string[] =>
    books
      .filter((book) => matchesFilter(book, shelf, status))
      .map((book) => `${book.shelfSlug}:${book.status}`);

  it('matches every book with no shelf and every status', () => {
    expect(matching(null, 'all')).toHaveLength(books.length);
  });

  it.each([
    ['a shelf', 'ai', 'all', ['ai:reading', 'ai:completed']],
    ['a status', null, 'completed', ['backend:completed', 'ai:completed']],
    ['a shelf and a status together', 'backend', 'completed', ['backend:completed']],
    ['nothing for a pair no book has', 'ai', 'queued', []],
  ] as const)('narrows to %s', (_case, shelf, status, expected) => {
    expect(matching(shelf, status)).toEqual(expected);
  });
});

describe('countStatuses', () => {
  it('counts each status, with all as every book', () => {
    expect(countStatuses(mixedBooks())).toEqual({ all: 4, completed: 2, reading: 1, queued: 1 });
  });

  it('counts zero for every status with no books', () => {
    expect(countStatuses([])).toEqual({ all: 0, completed: 0, reading: 0, queued: 0 });
  });
});
