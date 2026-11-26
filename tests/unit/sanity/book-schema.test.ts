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
 * exactly those, with a routable slug (never a reserved one such as `free`, the Free Library's
 * /bookshelf/free) and a required cover image asset and shelf. A book names its one shelf; the
 * retired `track` and `books[]` fields and the dead palette/cover-URL fields are gone. The
 * loaders decode each book on its own, so a book Studio could not have published, or whose cover
 * the image URL builder cannot draw, is dropped and reported rather than patched up.
 *
 * A shelf's slug identifies its /bookshelf filter and its title labels the filter's chip, so
 * Studio refuses "All" (the chip that shows every shelf) and a title another shelf has; the
 * uniqueness check's query runs on groq-js against a fake dataset.
 */

import { makeBook, makeBookshelf } from '@tests/fixtures/sanity-docs';
import { Schema } from 'effect';
import { evaluate, parse } from 'groq-js';
import type { ValidationContext } from 'sanity';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BookSchema, BookshelfSchema } from '@/hooks/sanity/schemas';
import { resetApiReportCooldowns } from '@/lib/observability/report';
import { decodeEach, resetDecodeMemo } from '@/lib/sanity/decode';
import {
  ALL_SHELVES_TAB,
  BOOK_DEFAULT_STATUS,
  BOOK_SLUG_MESSAGE,
  BOOK_STATUS_LABELS,
  BOOK_STATUSES,
  isBookCoverRef,
  isBookSlug,
  isBookStatus,
  isIsbn,
  isReservedBookSlug,
  isReservedShelfTitle,
  normalizeIsbn,
  RESERVED_BOOK_SLUGS,
  reservedBookSlugMessage,
  SHELF_TITLE_DUPLICATE_MESSAGE,
  SHELF_TITLE_RESERVED_MESSAGE,
  shelfTitleKey,
} from '@/sanity/bookshelf-rules';
import { bookType } from '@/sanity/schemaTypes/book';
import {
  bookshelfType,
  publishedShelfId,
  validateShelfTitle,
} from '@/sanity/schemaTypes/bookshelf';

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

/** One call a field's validation makes on its rule. */
interface RuleCall {
  readonly method: string;
  readonly args: readonly unknown[];
}

/** The calls a field's validation makes, in order, on a rule that records them. */
function ruleCallsOf(type: { readonly fields: readonly unknown[] }, name: string): RuleCall[] {
  const calls: RuleCall[] = [];
  const rule: Record<string, unknown> = new Proxy(
    {},
    {
      get:
        (_target, method) =>
        (...args: unknown[]) => {
          calls.push({ method: String(method), args });
          return rule;
        },
    },
  );
  const validation = fieldOf(type, name).validation as (rule: unknown) => unknown;
  validation(rule);
  return calls;
}

/** The function a field's validation passes to `Rule.custom`. */
function customRuleOf(
  type: { readonly fields: readonly unknown[] },
  name: string,
): (value: unknown) => unknown {
  const custom = ruleCallsOf(type, name).find((call) => call.method === 'custom')?.args[0];
  if (typeof custom !== 'function') throw new Error(`No custom rule on the ${name} field`);
  return custom as (value: unknown) => unknown;
}

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

  it('drop the retired track and the dead palette and cover-URL fields', () => {
    const names = fieldsOf(bookType).map(({ name }) => name);
    expect(names).not.toContain('track');
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

describe('book covers', () => {
  const withRef = (_ref: string) => ({
    ...BASE_BOOK,
    coverImage: { ...BASE_BOOK.coverImage, asset: { _type: 'reference', _ref } },
  });

  it.each([
    'image-Tb9Ew8CXIwaY6R1kjMvI0uRR-2000x3000-jpg',
    'image-abc123-520x680-webp',
    'image-0f9e8d7c6b5a-1040x1360-avif',
  ])('decode with an image asset reference the URL builder can draw: %s', (ref) => {
    expect(isBookCoverRef(ref)).toBe(true);
    expect(decodeBook(withRef(ref))._tag).toBe('Success');
  });

  it.each([
    ['a file asset', 'file-abc123-pdf'],
    ['no dimensions', 'image-abc123-webp'],
    ['no format', 'image-abc123-520x680'],
    ['a zero width', 'image-abc123-0x680-webp'],
    ['no asset id', 'image--520x680-webp'],
    ['nothing', ''],
  ])('refuse a cover asset reference with %s', (_label, ref) => {
    expect(isBookCoverRef(ref)).toBe(false);
    expect(decodeBook(withRef(ref))._tag).toBe('Failure');
  });
});

describe('reserved book slugs', () => {
  it('reserve free, the fixed Free Library page at /bookshelf/free', () => {
    expect(RESERVED_BOOK_SLUGS).toEqual(['free']);
    expect(isReservedBookSlug('free')).toBe(true);
    expect(isBookSlug('free')).toBe(false);
  });

  it('reserve only the whole slug, not a slug that contains it', () => {
    for (const slug of ['free-will', 'freedom', 'set-free']) {
      expect(isReservedBookSlug(slug)).toBe(false);
      expect(isBookSlug(slug)).toBe(true);
      expect(decodeBook({ ...BASE_BOOK, slug: { _type: 'slug', current: slug } })._tag).toBe(
        'Success',
      );
    }
  });

  it('decode no book with a reserved slug', () => {
    expect(decodeBook({ ...BASE_BOOK, slug: { _type: 'slug', current: 'free' } })._tag).toBe(
      'Failure',
    );
  });

  it('are refused in Studio with a message naming the fixed page', () => {
    const bookSlug = customRuleOf(bookType, 'slug');

    expect(bookSlug({ _type: 'slug', current: 'free' })).toEqual({
      message: reservedBookSlugMessage('free'),
      code: 'custom.book-slug-reserved',
    });
    expect(reservedBookSlugMessage('free')).toBe(
      '"free" is reserved: /bookshelf/free is a fixed page of the site. Choose another slug',
    );
    expect(bookSlug({ _type: 'slug', current: 'Free Book' })).toEqual({
      message: BOOK_SLUG_MESSAGE,
      code: 'custom.book-slug',
    });
    expect(bookSlug({ _type: 'slug', current: 'free-will' })).toBe(true);
    expect(bookSlug(undefined)).toBe(true);
  });
});

describe('shelf titles', () => {
  /** Shelves (and one book) as the dataset holds them: Systems has a draft beside its document. */
  const DATASET = [
    { _id: 'bookshelf-systems', _type: 'bookshelf', title: 'Systems' },
    { _id: 'drafts.bookshelf-systems', _type: 'bookshelf', title: 'Systems' },
    { _id: 'versions.rRelease1.bookshelf-systems', _type: 'bookshelf', title: 'Systems' },
    { _id: 'bookshelf-humanities', _type: 'bookshelf', title: ' Humanities ' },
    { _id: 'bookshelf-untitled', _type: 'bookshelf' },
    { _id: 'book-philosophy', _type: 'book', title: 'Philosophy' },
  ];

  /**
   * A Studio validation context for the shelf `_id`, whose client answers each query from
   * {@link DATASET} with groq-js, as Sanity would.
   */
  function shelfContext(_id: string) {
    const fetch = vi.fn(async (query: string, params: Record<string, unknown>) => {
      const result = await evaluate(parse(query), { dataset: DATASET, params });
      return result.get();
    });
    const getClient = vi.fn((_options: { readonly apiVersion: string }) => ({ fetch }));
    const context = {
      getClient,
      document: { _id, _type: 'bookshelf' },
    } as unknown as ValidationContext;
    return { context, getClient, fetch };
  }

  const duplicate = {
    message: SHELF_TITLE_DUPLICATE_MESSAGE,
    code: 'custom.shelf-title-duplicate',
  };

  it('reserve the All tab, trimmed and in any case', () => {
    expect(ALL_SHELVES_TAB).toBe('All');
    for (const title of ['All', ' all ', 'ALL']) expect(isReservedShelfTitle(title)).toBe(true);
    for (const title of ['All Books', 'Ball', 'Al l'])
      expect(isReservedShelfTitle(title)).toBe(false);
  });

  it('compare trimmed and lower-cased', () => {
    expect(shelfTitleKey('  Systems Design ')).toBe('systems design');
  });

  it('are required, then checked by the shelf title rule, in Studio', () => {
    const calls = ruleCallsOf(bookshelfType, 'title');

    expect(calls.map(({ method }) => method)).toEqual(['required', 'custom']);
    expect(calls[1]?.args[0]).toBe(validateShelfTitle);
  });

  it('refuse "All" in any case without asking Sanity', async () => {
    const { context, getClient } = shelfContext('drafts.bookshelf-new');

    for (const title of ['All', ' all ']) {
      expect(await validateShelfTitle(title, context)).toEqual({
        message: SHELF_TITLE_RESERVED_MESSAGE,
        code: 'custom.shelf-title-reserved',
      });
    }
    expect(getClient).not.toHaveBeenCalled();
  });

  it('leave an empty title to required(), without asking Sanity', async () => {
    const { context, getClient } = shelfContext('drafts.bookshelf-new');

    for (const title of [undefined, '', '   ']) {
      expect(await validateShelfTitle(title, context)).toBe(true);
    }
    expect(getClient).not.toHaveBeenCalled();
  });

  it('refuse a title another shelf has, published or draft, trimmed and in any case', async () => {
    const { context } = shelfContext('drafts.bookshelf-new');

    expect(await validateShelfTitle('Systems', context)).toEqual(duplicate);
    expect(await validateShelfTitle('humanities', context)).toEqual(duplicate);
    expect(await validateShelfTitle(' SYSTEMS ', context)).toEqual(duplicate);
  });

  it.each([
    ['published document', 'bookshelf-systems'],
    ['draft', 'drafts.bookshelf-systems'],
    ['release version', 'versions.rRelease1.bookshelf-systems'],
  ])("accept the shelf's own title, editing its %s", async (_label, id) => {
    const { context, getClient, fetch } = shelfContext(id);

    expect(await validateShelfTitle('Systems', context)).toBe(true);
    expect(getClient).toHaveBeenCalledWith({ apiVersion: '2024-10-14' });
    expect(fetch.mock.calls[0]?.[1]).toEqual({
      published: 'bookshelf-systems',
      draft: 'drafts.bookshelf-systems',
    });
  });

  it('accept a title no other shelf has, even one a book has', async () => {
    const { context } = shelfContext('drafts.bookshelf-new');

    expect(await validateShelfTitle('Philosophy', context)).toBe(true);
  });

  it('resolve the published id behind draft and release version ids', () => {
    expect(publishedShelfId('bookshelf-ai')).toBe('bookshelf-ai');
    expect(publishedShelfId('drafts.bookshelf-ai')).toBe('bookshelf-ai');
    expect(publishedShelfId('versions.rRelease1.bookshelf-ai')).toBe('bookshelf-ai');
  });
});

describe('bookshelf documents', () => {
  it('drop the retired books list and the dead accent and featured fields', () => {
    const names = fieldsOf(bookshelfType).map(({ name }) => name);
    expect(names).not.toContain('books');
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
  /** The `_id`s and problems the one Sentry warning lists, and its capture context. */
  const reported = () => {
    const [error, context] = sentry.captureException.mock.calls[0] ?? [];
    const invalid = (error as { metadata: { invalid: { id: string; problem: string }[] } }).metadata
      .invalid;
    return {
      ids: invalid.map((doc) => doc.id),
      problems: invalid.map((doc) => doc.problem),
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

  it('drops a book whose cover is a file asset or whose slug is reserved, in one warning', () => {
    const good = [makeBook(), makeBook()];
    const fileCover = makeBook({
      coverImage: { _type: 'image', asset: { _type: 'reference', _ref: 'file-abc123-pdf' } },
    });
    const reserved = makeBook({ slug: { _type: 'slug', current: 'free' } });

    const decoded = decodeEach(BookSchema, [good[0], fileCover, reserved, good[1]], 'books');

    expect(decoded.map((book) => book._id)).toEqual(good.map((book) => book._id));
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    const { ids, problems, context } = reported();
    expect(ids).toEqual([fileCover._id, reserved._id]);
    expect(problems[0]).toMatch(/^coverImage\.asset\._ref: Expected an image asset reference/);
    expect(problems[1]).toMatch(/^slug\.current: .*other than free/);
    expect(context).toMatchObject({ level: 'warning', tags: { 'api.context': 'decode books' } });
  });
});
