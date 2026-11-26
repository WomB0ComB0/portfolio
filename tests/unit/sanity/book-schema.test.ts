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
 * @file The bookshelf contract has one source (src/sanity/bookshelf-rules.ts): the Studio book
 * schema lists exactly its statuses, labelled by its labels, and the Effect BookSchema accepts
 * exactly those, with a routable slug and a required cover and shelf. A book names its one shelf;
 * `track` and `books[]` are hidden legacy fields, and the dead palette/cover-URL fields are gone.
 * The loaders decode each book on its own, so a book Studio could not have published is dropped
 * and reported rather than patched up.
 */

import { makeBook, makeBookshelf } from '@tests/fixtures/sanity-docs';
import { Schema } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BookSchema, BookshelfSchema } from '@/hooks/sanity/schemas';
import { resetApiReportCooldowns } from '@/lib/observability/report';
import { decodeEach, resetDecodeMemo } from '@/lib/sanity/decode';
import {
  BOOK_DEFAULT_STATUS,
  BOOK_STATUS_LABELS,
  BOOK_STATUSES,
  isBookSlug,
  isBookStatus,
  isIsbn,
  normalizeIsbn,
} from '@/sanity/bookshelf-rules';
import { bookType } from '@/sanity/schemaTypes/book';
import { bookshelfType } from '@/sanity/schemaTypes/bookshelf';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock('@sentry/nextjs', () => sentry);

beforeEach(() => {
  sentry.captureException.mockReset();
  resetApiReportCooldowns();
  resetDecodeMemo();
});

/** The parts of a Studio field definition these tests read, as found on the definition. */
interface StudioField {
  readonly name: string;
  readonly type?: string;
  readonly hidden?: unknown;
  readonly readOnly?: unknown;
  readonly initialValue?: unknown;
  readonly to?: readonly { readonly type: string }[];
  readonly fields?: readonly { readonly name: string }[];
  readonly validation?: unknown;
  readonly options?: {
    readonly hotspot?: unknown;
    readonly list?: readonly { readonly title?: string; readonly value: unknown }[];
  };
}

const fieldsOf = (type: { readonly fields: readonly unknown[] }): readonly StudioField[] =>
  type.fields as readonly StudioField[];

const fieldOf = (type: { readonly fields: readonly unknown[] }, name: string): StudioField => {
  const field = fieldsOf(type).find((candidate) => candidate.name === name);
  if (!field) throw new Error(`No Studio field named ${name}`);
  return field;
};

/** A synthetic book, shaped like the documents the books query returns. */
const BASE_BOOK = {
  _id: 'book-synthetic',
  _type: 'book',
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-01-02T00:00:00Z',
  _rev: 'rev',
  title: 'A Synthetic Book',
  slug: { _type: 'slug', current: 'a-synthetic-book' },
  authors: 'Test Author',
  status: 'queued',
  summary: 'A book used only by this test.',
  coverImage: {
    _type: 'image',
    asset: { _type: 'reference', _ref: 'image-abc123-520x680-webp' },
  },
  shelfId: 'bookshelf-synthetic',
  order: 10,
};

/** A synthetic shelf, shaped like the documents the bookshelves query returns. */
const BASE_SHELF = {
  _id: 'bookshelf-synthetic',
  _type: 'bookshelf',
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-01-02T00:00:00Z',
  _rev: 'rev',
  title: 'Synthetic Shelf',
  slug: { _type: 'slug', current: 'synthetic-shelf' },
  order: 10,
};

const decodeBook = Schema.decodeUnknownResult(BookSchema);
const decodeShelf = Schema.decodeUnknownResult(BookshelfSchema);

describe('book statuses', () => {
  it('are the Studio list, in its order, labelled by the shared labels', () => {
    expect(BOOK_STATUSES).toEqual(['completed', 'reading', 'queued']);
    const list = fieldOf(bookType, 'status').options?.list ?? [];
    expect(list.map(({ value }) => value)).toEqual([...BOOK_STATUSES]);
    expect(list.map(({ title }) => title)).toEqual(
      BOOK_STATUSES.map((status) => BOOK_STATUS_LABELS[status]),
    );
  });

  it('start a new Studio book as the shared default, queued', () => {
    expect(BOOK_DEFAULT_STATUS).toBe('queued');
    expect(fieldOf(bookType, 'status').initialValue).toBe(BOOK_DEFAULT_STATUS);
  });

  it.each(BOOK_STATUSES)('BookSchema accepts %s', (status) => {
    expect(decodeBook({ ...BASE_BOOK, status })._tag).toBe('Success');
    expect(isBookStatus(status)).toBe(true);
  });

  it.each([
    ['a label', 'Read'],
    ['an old alias', 'in-progress'],
    ['null', null],
  ])('BookSchema rejects %s as a status', (_label, status) => {
    expect(decodeBook({ ...BASE_BOOK, status })._tag).toBe('Failure');
    expect(isBookStatus(status)).toBe(false);
  });
});

describe('book documents', () => {
  it('name their one shelf by a reference to a bookshelf', () => {
    const shelf = fieldOf(bookType, 'shelf');
    expect(shelf.type).toBe('reference');
    expect(shelf.to).toEqual([{ type: 'bookshelf' }]);
  });

  it('carry a cover image with a hotspot and alternative text', () => {
    const cover = fieldOf(bookType, 'coverImage');
    expect(cover.type).toBe('image');
    expect(cover.options?.hotspot).toBe(true);
    expect(cover.fields?.map(({ name }) => name)).toEqual(['alt']);
  });

  it('refuse to publish a cover that has alt text but no image asset', () => {
    const calls: string[] = [];
    const rule: Record<string, unknown> = new Proxy(
      {},
      {
        get: (_target, name) => () => {
          calls.push(String(name));
          return rule;
        },
      },
    );
    const validation = fieldOf(bookType, 'coverImage').validation as (rule: unknown) => unknown;
    validation(rule);
    expect(calls).toEqual(expect.arrayContaining(['required', 'assetRequired']));
  });

  it('give a new book no stage order by default', () => {
    expect(fieldOf(bookType, 'order').initialValue).toBeUndefined();
  });

  it('keep the legacy track hidden and read-only, and drop the dead fields', () => {
    const track = fieldOf(bookType, 'track');
    expect(track.hidden).toBe(true);
    expect(track.readOnly).toBe(true);
    const names = fieldsOf(bookType).map(({ name }) => name);
    expect(names).not.toContain('spine');
    expect(names).not.toContain('coverUrl');
  });

  it('decode with the cover and shelf required', () => {
    const { coverImage: _cover, ...noCover } = BASE_BOOK;
    const { shelfId: _shelf, ...noShelf } = BASE_BOOK;
    expect(decodeBook(noCover)._tag).toBe('Failure');
    expect(decodeBook({ ...BASE_BOOK, coverImage: null })._tag).toBe('Failure');
    expect(decodeBook(noShelf)._tag).toBe('Failure');
  });

  it.each([
    ['upper case', 'A-Synthetic-Book'],
    ['spaces', 'a synthetic book'],
    ['a double hyphen', 'a--book'],
    ['a trailing hyphen', 'a-book-'],
    ['empty', ''],
  ])('decode only with a routable slug, not one with %s', (_label, current) => {
    expect(isBookSlug(current)).toBe(false);
    expect(decodeBook({ ...BASE_BOOK, slug: { _type: 'slug', current } })._tag).toBe('Failure');
  });
});

describe('bookshelf documents', () => {
  it('keep the legacy books list hidden and read-only, and drop the dead fields', () => {
    const books = fieldOf(bookshelfType, 'books');
    expect(books.hidden).toBe(true);
    expect(books.readOnly).toBe(true);
    const names = fieldsOf(bookshelfType).map(({ name }) => name);
    expect(names).not.toContain('accentColor');
    expect(names).not.toContain('featured');
  });

  it('decode flat, with no books', () => {
    expect(decodeShelf(BASE_SHELF)._tag).toBe('Success');
    expect(decodeShelf({ ...BASE_SHELF, description: null })._tag).toBe('Success');
  });
});

describe('Studio lists', () => {
  it.each([
    ['book', bookType],
    ['bookshelf', bookshelfType],
  ])('order %s documents by position', (_label, type) => {
    expect(type.orderings).toEqual([
      { title: 'Position', name: 'orderAsc', by: [{ field: 'order', direction: 'asc' }] },
    ]);
  });
});

describe('ISBNs', () => {
  it.each([
    '978-3-16-148410-0',
    '9780306406157',
    '979-10-90636-07-1',
    '0-306-40615-2',
    '0-8044-2957-X',
    '080442957x',
    ' 1 84356 028 3 ',
  ])('accepts a valid ISBN-10 or ISBN-13: %s', (isbn) => {
    expect(isIsbn(isbn)).toBe(true);
  });

  it.each([
    ['a wrong ISBN-13 check digit', '978-3-16-148410-1'],
    ['a wrong ISBN-10 check digit', '0-306-40615-3'],
    ['an X inside an ISBN-13', '978-3-16-14841X-0'],
    ['twelve digits', '978316148410'],
    ['a prefix', 'ISBN 978-3-16-148410-0'],
    ['a placeholder', 'N/A'],
    ['nothing', ''],
  ])('refuses %s', (_label, isbn) => {
    expect(isIsbn(isbn)).toBe(false);
  });

  it('normalizes leniently for registry links', () => {
    expect(normalizeIsbn('978-3-16-148410-0')).toBe('9783161484100');
    expect(normalizeIsbn('0-8044-2957-x')).toBe('080442957X');
    expect(normalizeIsbn('N/A')).toBeNull();
    expect(normalizeIsbn(null)).toBeNull();
  });
});

describe('decoding a list of books', () => {
  /** The `_id`s the one Sentry warning lists, and its capture context. */
  const reported = () => {
    const [error, context] = sentry.captureException.mock.calls[0] ?? [];
    return {
      ids: (error as { metadata: { invalid: { id: string }[] } }).metadata.invalid.map(
        (doc) => doc.id,
      ),
      context,
    };
  };

  it('keeps the fixture books and shelves, which decode as the queries answer them', () => {
    const shelf = makeBookshelf();
    const book = makeBook({ shelfId: shelf._id });

    expect(decodeEach(BookshelfSchema, [shelf], 'bookshelves')).toEqual([shelf]);
    expect(decodeEach(BookSchema, [book], 'books')).toEqual([book]);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('drops a book with an unknown status, no cover or no shelf, in one warning', () => {
    const good = [makeBook(), makeBook()];
    const badStatus = { ...makeBook(), status: 'in-progress' };
    const { coverImage: _cover, ...noCover } = makeBook();
    const { shelfId: _shelf, ...noShelf } = makeBook();
    const nullCover = { ...makeBook(), coverImage: null };

    const decoded = decodeEach(
      BookSchema,
      [good[0], badStatus, noCover, good[1], noShelf, nullCover],
      'books',
    );

    expect(decoded.map((book) => book._id)).toEqual(good.map((book) => book._id));
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    const { ids, context } = reported();
    expect(ids).toEqual([badStatus._id, noCover._id, noShelf._id, nullCover._id]);
    expect(context).toMatchObject({ level: 'warning', tags: { 'api.context': 'decode books' } });
  });
});
