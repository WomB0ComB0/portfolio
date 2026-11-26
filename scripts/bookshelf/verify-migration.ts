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
 * @file The bookshelf migration's invariants, checked against a raw-perspective read of every
 * `book` and `bookshelf` document (migrate-to-sanity.ts runs it for --verify, after --apply and
 * around --finalize). Pure, like plan-migration.ts, so each check is unit-tested.
 *
 * - No drafts or release versions; exactly the catalog's books and shelves, every slug present.
 * - Every book has a cover asset and a `shelf` reference to its catalog shelf.
 * - Status counts match the catalog's.
 * - Book and shelf `order` values are distinct numbers that sort the catalog into its own order,
 *   so stages run shelf by shelf for the old code (book order only) and the new code alike.
 * - No dead field is left: `spine` or a relative `coverUrl` on a book, `accentColor` or
 *   `featured` on a shelf. An external `coverUrl` is only a warning.
 * - Legacy fields, before --finalize: each book's `track` is its shelf's title, and each shelf's
 *   `books[]` lists exactly the books whose `shelf` names it, in order. After: none remain.
 *
 * Relative imports only: `sanity exec` loads this, and nothing here imports src/.
 */

import type { BookshelfCatalogInput } from './catalog/types';
import {
  coverAssetOf,
  type ExistingDoc,
  isPublishedId,
  isRecord,
  isRelativeCoverUrl,
  refOf,
  slugOf,
} from './plan-migration';

/** `migrated`: legacy fields present and consistent. `finalized`: legacy fields gone. */
export type DatasetStage = 'migrated' | 'finalized';

export interface VerificationResult {
  readonly stage: DatasetStage;
  readonly failures: readonly string[];
  readonly warnings: readonly string[];
  readonly books: number;
  readonly shelves: number;
  readonly statuses: Readonly<Record<string, number>>;
}

/** How many ids a failure line names before it summarises the rest. */
const LISTED = 5;

/** "a, b, c" or "a, b, c, d, e and 3 more". */
function listSome(items: readonly string[]): string {
  const shown = items.slice(0, LISTED).join(', ');
  return items.length > LISTED ? `${shown} and ${items.length - LISTED} more` : shown;
}

/** A failure naming every offending id, or nothing when there is none. */
const failWhen = (ids: readonly string[], what: string): string[] =>
  ids.length > 0 ? [`${ids.length} ${what}: ${listSome(ids)}`] : [];

function countBy(values: readonly string[]): Record<string, number> {
  return Object.fromEntries(
    [...Map.groupBy(values, (value) => value)].map(([value, group]) => [value, group.length]),
  );
}

/**
 * `order` is a finite number on every document, no two share one, and sorting by it puts the
 * catalog's documents in catalog order.
 */
function orderFailures(
  docs: readonly ExistingDoc[],
  catalogSlugs: readonly string[],
  type: string,
): string[] {
  const unordered = docs.filter(
    (doc) => typeof doc.order !== 'number' || !Number.isFinite(doc.order),
  );
  const orders = docs.map((doc) => doc.order).filter((order) => typeof order === 'number');
  const duplicated = [...new Set(orders.filter((order, index) => orders.indexOf(order) !== index))];
  const known = new Set(catalogSlugs);
  const sorted = docs
    .filter((doc) => typeof doc.order === 'number' && known.has(slugOf(doc) ?? ''))
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map((doc) => slugOf(doc) ?? '');
  const expected = catalogSlugs.filter((slug) => sorted.includes(slug));
  const firstOff = expected.findIndex((slug, index) => sorted[index] !== slug);
  return [
    ...failWhen(
      unordered.map((doc) => doc._id),
      `${type} documents have no numeric order`,
    ),
    ...failWhen(duplicated.map(String), `${type} order values are shared`),
    ...(firstOff >= 0
      ? [
          `${type} order does not follow the catalog: position ${firstOff + 1} is "${sorted[firstOff] ?? ''}", expected "${expected[firstOff] ?? ''}"`,
        ]
      : []),
  ];
}

/** Each book's `track` repeats its shelf's title; each shelf's `books[]` lists its books. */
function legacyFailures(
  books: readonly ExistingDoc[],
  shelves: readonly ExistingDoc[],
  shelfById: ReadonlyMap<string, ExistingDoc>,
): string[] {
  const wrongTrack = books.filter((book) => {
    const shelf = shelfById.get(refOf(book.shelf) ?? '');
    return shelf !== undefined && book.track !== shelf.title;
  });
  const wrongList = shelves.filter((shelf) => {
    const listed = Array.isArray(shelf.books) ? shelf.books.map(refOf) : undefined;
    const expected = books
      .filter((book) => refOf(book.shelf) === shelf._id)
      .sort((a, b) => Number(a.order) - Number(b.order))
      .map((book) => book._id);
    return (
      listed === undefined ||
      listed.length !== expected.length ||
      listed.some((id, index) => id !== expected[index])
    );
  });
  return [
    ...failWhen(
      wrongTrack.map((book) => book._id),
      "books' legacy track is not their shelf's title",
    ),
    ...failWhen(
      wrongList.map((shelf) => shelf._id),
      "shelves' legacy books[] differ from the books that name them",
    ),
  ];
}

/**
 * Checks `docs` (a raw read of every book and bookshelf document) against the migration's
 * invariants for `catalog`. `expected` names the stage to check; by default it is `migrated` when
 * any legacy field is present and `finalized` otherwise.
 */
export function verifyBookshelfState(
  docs: readonly ExistingDoc[],
  catalog: BookshelfCatalogInput,
  expected?: DatasetStage,
): VerificationResult {
  const ours = docs.filter((doc) => doc._type === 'book' || doc._type === 'bookshelf');
  const unpublished = ours.filter((doc) => !isPublishedId(doc._id));
  const books = ours.filter((doc) => doc._type === 'book' && isPublishedId(doc._id));
  const shelves = ours.filter((doc) => doc._type === 'bookshelf' && isPublishedId(doc._id));
  const shelfById = new Map(shelves.map((shelf) => [shelf._id, shelf]));
  const legacyPresent =
    books.some((book) => book.track !== undefined) ||
    shelves.some((shelf) => shelf.books !== undefined);
  const stage = expected ?? (legacyPresent ? 'migrated' : 'finalized');

  const bookSlugs = new Set(books.map((book) => slugOf(book)));
  const shelfSlugs = new Set(shelves.map((shelf) => slugOf(shelf)));
  const catalogShelfSlug = new Map(catalog.shelves.map((shelf) => [shelf.title, shelf.slug]));
  const statuses = countBy(books.map((book) => String(book.status)));
  const expectedStatuses = countBy(catalog.books.map((book) => book.status));
  const statusNames = [...new Set([...Object.keys(statuses), ...Object.keys(expectedStatuses)])];

  const failures = [
    ...failWhen(
      unpublished.map((doc) => doc._id),
      'drafts or release versions exist',
    ),
    ...(books.length === catalog.books.length
      ? []
      : [`${books.length} books, expected ${catalog.books.length}`]),
    ...(shelves.length === catalog.shelves.length
      ? []
      : [`${shelves.length} shelves, expected ${catalog.shelves.length}`]),
    ...failWhen(
      catalog.books.map((book) => book.slug).filter((slug) => !bookSlugs.has(slug)),
      'catalog books are missing',
    ),
    ...failWhen(
      catalog.shelves.map((shelf) => shelf.slug).filter((slug) => !shelfSlugs.has(slug)),
      'catalog shelves are missing',
    ),
    ...failWhen(
      books.filter((book) => !coverAssetOf(book)).map((book) => book._id),
      'books have no cover image asset',
    ),
    ...failWhen(
      books.filter((book) => !shelfById.has(refOf(book.shelf) ?? '')).map((book) => book._id),
      'books do not reference an existing shelf',
    ),
    ...failWhen(
      catalog.books
        .filter((entry) => {
          const book = books.find((doc) => slugOf(doc) === entry.slug);
          const shelf = book ? shelfById.get(refOf(book.shelf) ?? '') : undefined;
          return shelf !== undefined && slugOf(shelf) !== catalogShelfSlug.get(entry.track);
        })
        .map((entry) => entry.slug),
      'books sit on a different shelf than their catalog track',
    ),
    ...statusNames
      .filter((status) => (statuses[status] ?? 0) !== (expectedStatuses[status] ?? 0))
      .map(
        (status) =>
          `${statuses[status] ?? 0} books are "${status}", expected ${expectedStatuses[status] ?? 0}`,
      ),
    ...orderFailures(
      books,
      catalog.books.map((book) => book.slug),
      'book',
    ),
    ...orderFailures(
      shelves,
      catalog.shelves.map((shelf) => shelf.slug),
      'shelf',
    ),
    ...failWhen(
      books.filter((book) => book.spine !== undefined).map((book) => book._id),
      'books still have a spine palette',
    ),
    ...failWhen(
      books.filter((book) => isRelativeCoverUrl(book.coverUrl)).map((book) => book._id),
      'books still have a relative coverUrl',
    ),
    ...failWhen(
      shelves
        .filter((shelf) => shelf.accentColor !== undefined || shelf.featured !== undefined)
        .map((shelf) => shelf._id),
      'shelves still have accentColor or featured',
    ),
    ...(stage === 'migrated'
      ? legacyFailures(books, shelves, shelfById)
      : [
          ...failWhen(
            books.filter((book) => book.track !== undefined).map((book) => book._id),
            'books still have the legacy track',
          ),
          ...failWhen(
            shelves.filter((shelf) => shelf.books !== undefined).map((shelf) => shelf._id),
            'shelves still have the legacy books[]',
          ),
        ]),
  ];
  const warnings = failWhen(
    books
      .filter((book) => typeof book.coverUrl === 'string' && !isRelativeCoverUrl(book.coverUrl))
      .map((book) => book._id),
    'books keep an external coverUrl the site no longer reads',
  );
  const altless = books.filter(
    (book) => isRecord(book.coverImage) && typeof book.coverImage.alt !== 'string',
  );
  return {
    stage,
    failures,
    warnings: [
      ...warnings,
      ...failWhen(
        altless.map((book) => book._id),
        'covers have no alt text (the site falls back to "<title> by <authors>")',
      ),
    ],
    books: books.length,
    shelves: shelves.length,
    statuses,
  };
}
