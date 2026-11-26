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
 * @file The pure half of the one-shot bookshelf migration (migrate-to-sanity.ts does the I/O). It
 * compares the documents Sanity holds with the static catalog and decides every write, with no
 * I/O, so each decision is unit-tested (tests/unit/scripts/bookshelf-migration.test.ts).
 *
 * - Documents are matched by `slug.current`, never by an assumed id. New documents get the ids
 *   `book-<slug>` and `bookshelf-<slug>`.
 * - The catalog always sets a book's `status`, its `order` (stage x 10: one global, monotonic
 *   sequence) and its `shelf`, and a shelf's `order` ((i + 1) x 10). It also writes the legacy
 *   fields that the site code deployed before this change reads (a book's `track`, a shelf's
 *   `books[]`), consistently, so that code keeps grouping books until the new code is live.
 * - Content fields are only filled where Studio has no value. A Studio value that differs from the
 *   catalog is kept and reported as a diff.
 * - A cover is uploaded only for a book without a `coverImage` asset.
 * - Drafts, release versions, two documents sharing a slug, a document without a revision, or an
 *   id the plan needs that another document holds are errors, and the runner writes nothing.
 * - `finalize` only unsets the legacy `track` and `books` fields.
 *
 * Relative imports only: `sanity exec` loads this, and nothing here imports src/.
 */

import type { CatalogShelf } from './catalog/shelves';
import type { BookshelfCatalogInput, CatalogBook } from './catalog/types';

/** A document as a raw-perspective fetch returns it: every field, as stored. */
export interface ExistingDoc {
  readonly _id: string;
  readonly _type: string;
  readonly _rev?: string;
  readonly [field: string]: unknown;
}

/** `migrate` writes the catalog; `finalize` removes the legacy fields afterwards. */
export type PlanMode = 'migrate' | 'finalize';
export type DocType = 'book' | 'bookshelf';
/** `set` always writes; `fill` writes only where Studio has no value; `unset` removes a field. */
export type FieldAction = 'set' | 'fill' | 'unset';

/** A cover to upload from public/assets/bookshelf/<slug>.webp, and the alt text it gets. */
export interface CoverUpload {
  readonly slug: string;
  readonly docId: string;
  readonly alt: string;
}

/** A new document. A new book also needs its cover, which buildMutations attaches. */
export interface DocCreate {
  readonly type: DocType;
  readonly id: string;
  readonly slug: string;
  readonly doc: Readonly<Record<string, unknown>>;
  readonly cover?: CoverUpload;
}

/** A change to an existing document, guarded by the revision the plan read. */
export interface DocPatch {
  readonly type: DocType;
  readonly id: string;
  readonly slug: string;
  readonly rev: string;
  readonly set: Readonly<Record<string, unknown>>;
  readonly setIfMissing: Readonly<Record<string, unknown>>;
  readonly unset: readonly string[];
  readonly cover?: CoverUpload;
}

/** One field a patch writes or removes, with the value it replaces. */
export interface FieldChange {
  readonly type: DocType;
  readonly id: string;
  readonly slug: string;
  readonly field: string;
  readonly action: FieldAction;
  readonly from: unknown;
  readonly to: unknown;
}

/** A content field where Studio's value differs from the catalog's: Studio's is kept. */
export interface FieldDiff {
  readonly type: DocType;
  readonly id: string;
  readonly slug: string;
  readonly field: string;
  readonly studio: unknown;
  readonly catalog: unknown;
}

export interface BookshelfMigrationPlan {
  readonly mode: PlanMode;
  /** Any error means nothing may be written. */
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly creates: readonly DocCreate[];
  readonly patches: readonly DocPatch[];
  readonly coverUploads: readonly CoverUpload[];
  readonly changes: readonly FieldChange[];
  readonly diffs: readonly FieldDiff[];
  /** Matched documents that already hold what the plan would write. */
  readonly unchanged: number;
}

/** The body of a Sanity patch mutation (the HTTP mutation shape @sanity/client accepts). */
export interface PatchBody {
  id: string;
  ifRevisionID?: string;
  set?: Record<string, unknown>;
  setIfMissing?: Record<string, unknown>;
  unset?: string[];
}

/** The Sanity mutations the migration sends, in transaction order. */
export type SanityMutation =
  | { createIfNotExists: { _id: string; _type: string; [field: string]: unknown } }
  | { patch: PatchBody };

/** Ids that are not published documents: Studio drafts and release versions. */
export const DRAFT_OR_VERSION_ID = /^(drafts|versions)\./;
/** The prefix of the relative cover paths the old seed wrote to `coverUrl`. */
const RELATIVE_COVER_PREFIX = '/assets/';
/** BOOK_SLUG_PATTERN in src/sanity/bookshelf-rules.ts, repeated: this folder never imports src/. */
export const CATALOG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const BOOK_CONTENT_FIELDS = [
  'title',
  'slug',
  'spineTitle',
  'authors',
  'spineAuthor',
  'publisher',
  'edition',
  'year',
  'isbn',
  'summary',
  'url',
  'topics',
] as const;
const SHELF_CONTENT_FIELDS = ['title', 'slug', 'description'] as const;
/** Shelf fields the site never read and the schema dropped. */
const SHELF_DEAD_FIELDS = ['accentColor', 'featured'] as const;

export const newBookId = (slug: string): string => `book-${slug}`;
export const newShelfId = (slug: string): string => `bookshelf-${slug}`;

/** Every id the plan could create: the runner also reads these, whatever their type. */
export function candidateIds(catalog: BookshelfCatalogInput): string[] {
  return [
    ...catalog.shelves.map((shelf) => newShelfId(shelf.slug)),
    ...catalog.books.map((book) => newBookId(book.slug)),
  ];
}

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** What a fetch returned, as documents: throws unless it is an array of objects with ids and types. */
export function asExistingDocs(value: unknown): ExistingDoc[] {
  if (!Array.isArray(value)) throw new TypeError('Expected an array of documents');
  return value.map((item: unknown): ExistingDoc => {
    if (!isRecord(item) || typeof item._id !== 'string' || typeof item._type !== 'string') {
      throw new TypeError('Expected every document to have a string _id and _type');
    }
    return { ...item, _id: item._id, _type: item._type };
  });
}

export const isPublishedId = (id: string): boolean => !DRAFT_OR_VERSION_ID.test(id);

export function slugOf(doc: ExistingDoc): string | undefined {
  const { slug } = doc;
  return isRecord(slug) && typeof slug.current === 'string' ? slug.current : undefined;
}

export function refOf(value: unknown): string | undefined {
  return isRecord(value) && typeof value._ref === 'string' && value._ref ? value._ref : undefined;
}

export function coverAssetOf(doc: ExistingDoc): string | undefined {
  return isRecord(doc.coverImage) ? refOf(doc.coverImage.asset) : undefined;
}

/** True for a `coverUrl` the old seed wrote: a relative public path, not an external URL. */
export const isRelativeCoverUrl = (value: unknown): boolean =>
  typeof value === 'string' && value.startsWith(RELATIVE_COVER_PREFIX);

const hasValue = (value: unknown): boolean => value !== undefined && value !== null;

const textOr = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() ? value : fallback;

/** Structural equality for JSON values (key order does not matter). */
export function isDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => isDeepEqual(item, b[index]))
    );
  }
  if (!isRecord(a) || !isRecord(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && isDeepEqual(a[key], b[key]))
  );
}

/** Two reference arrays with the same keys and targets, in the same order. */
function sameRefs(current: unknown, next: unknown): boolean {
  if (!Array.isArray(current) || !Array.isArray(next) || current.length !== next.length) {
    return false;
  }
  return current.every((item, index) => {
    const other: unknown = next[index];
    return (
      isRecord(item) && isRecord(other) && item._key === other._key && refOf(item) === refOf(other)
    );
  });
}

/** Whether a field already holds the value: references compare by target, slugs by `current`. */
function holds(field: string, current: unknown, next: unknown): boolean {
  if (field === 'shelf') return refOf(current) !== undefined && refOf(current) === refOf(next);
  if (field === 'books') return sameRefs(current, next);
  if (field === 'slug') {
    return isRecord(current) && isRecord(next) && current.current === next.current;
  }
  return isDeepEqual(current, next);
}

const slugValue = (slug: string) => ({ _type: 'slug', current: slug });
const referenceTo = (id: string) => ({ _type: 'reference', _ref: id });

function bookContent(book: CatalogBook): Readonly<Record<string, unknown>> {
  const values: Record<(typeof BOOK_CONTENT_FIELDS)[number], unknown> = {
    title: book.title,
    slug: slugValue(book.slug),
    spineTitle: book.spineTitle,
    authors: book.authors,
    spineAuthor: book.spineAuthor,
    publisher: book.publisher,
    edition: book.edition,
    year: book.year,
    isbn: book.isbn,
    summary: book.summary,
    url: book.url,
    topics: [...book.topics],
  };
  return values;
}

function shelfContent(shelf: CatalogShelf): Readonly<Record<string, unknown>> {
  const values: Record<(typeof SHELF_CONTENT_FIELDS)[number], unknown> = {
    title: shelf.title,
    slug: slugValue(shelf.slug),
    description: shelf.description,
  };
  return values;
}

/** Who a change or diff is about. */
interface Subject {
  readonly type: DocType;
  readonly id: string;
  readonly slug: string;
  readonly doc: ExistingDoc;
}

/** The always-set fields whose stored value differs from the catalog's. */
function setChanges(subject: Subject, values: Readonly<Record<string, unknown>>): FieldChange[] {
  const { type, id, slug, doc } = subject;
  return Object.entries(values)
    .filter(([field, value]) => !holds(field, doc[field], value))
    .map(([field, value]) => ({
      type,
      id,
      slug,
      field,
      action: 'set',
      from: doc[field],
      to: value,
    }));
}

/** Content fields Studio has no value for, filled from the catalog. */
function fillChanges(subject: Subject, values: Readonly<Record<string, unknown>>): FieldChange[] {
  const { type, id, slug, doc } = subject;
  return Object.entries(values)
    .filter(([field]) => !hasValue(doc[field]))
    .map(([field, value]) => ({
      type,
      id,
      slug,
      field,
      action: 'fill',
      from: doc[field],
      to: value,
    }));
}

/** Content fields where Studio holds a different value than the catalog: Studio wins. */
function contentDiffs(subject: Subject, values: Readonly<Record<string, unknown>>): FieldDiff[] {
  const { type, id, slug, doc } = subject;
  return Object.entries(values)
    .filter(([field, value]) => hasValue(doc[field]) && !holds(field, doc[field], value))
    .map(([field, value]) => ({ type, id, slug, field, studio: doc[field], catalog: value }));
}

function unsetChanges(subject: Subject, fields: readonly string[]): FieldChange[] {
  const { type, id, slug, doc } = subject;
  return fields
    .filter((field) => doc[field] !== undefined)
    .map((field) => ({ type, id, slug, field, action: 'unset', from: doc[field], to: undefined }));
}

/**
 * The patch for a matched document, or undefined when it already holds everything. A filled field
 * Studio stored as null needs `set`, since `setIfMissing` skips a key that exists.
 */
function toPatch(
  subject: Subject,
  changes: readonly FieldChange[],
  cover?: CoverUpload,
): DocPatch | undefined {
  if (changes.length === 0 && !cover) return undefined;
  const entries = (keep: (change: FieldChange) => boolean) =>
    Object.fromEntries(changes.filter(keep).map((change) => [change.field, change.to]));
  return {
    type: subject.type,
    id: subject.id,
    slug: subject.slug,
    rev: subject.doc._rev ?? '',
    set: entries(
      (change) => change.action === 'set' || (change.action === 'fill' && change.from === null),
    ),
    setIfMissing: entries((change) => change.action === 'fill' && change.from === undefined),
    unset: changes.filter((change) => change.action === 'unset').map((change) => change.field),
    ...(cover ? { cover } : {}),
  };
}

/** The first value that occurs more than once, or undefined. */
function firstDuplicate(values: readonly string[]): string | undefined {
  return values.find((value, index) => values.indexOf(value) !== index);
}

/** Published documents by id, and books and shelves by slug, with what blocks the plan. */
interface DocIndex {
  readonly byId: ReadonlyMap<string, ExistingDoc>;
  readonly books: ReadonlyMap<string, ExistingDoc>;
  readonly shelves: ReadonlyMap<string, ExistingDoc>;
  readonly unslugged: readonly ExistingDoc[];
  readonly errors: readonly string[];
}

function bySlug(docs: readonly ExistingDoc[], type: DocType): [Map<string, ExistingDoc>, string[]] {
  const index = new Map<string, ExistingDoc>();
  const errors: string[] = [];
  for (const doc of docs.filter((candidate) => candidate._type === type)) {
    const slug = slugOf(doc);
    if (slug === undefined) continue;
    const other = index.get(slug);
    if (other)
      errors.push(`Two ${type} documents share the slug "${slug}": ${other._id}, ${doc._id}`);
    else index.set(slug, doc);
  }
  return [index, errors];
}

function indexDocuments(existingDocs: readonly ExistingDoc[]): DocIndex {
  const unpublished = existingDocs.filter((doc) => !isPublishedId(doc._id));
  const published = existingDocs.filter((doc) => isPublishedId(doc._id));
  const ours = published.filter((doc) => doc._type === 'book' || doc._type === 'bookshelf');
  const [books, bookErrors] = bySlug(ours, 'book');
  const [shelves, shelfErrors] = bySlug(ours, 'bookshelf');
  return {
    byId: new Map(published.map((doc) => [doc._id, doc])),
    books,
    shelves,
    unslugged: ours.filter((doc) => slugOf(doc) === undefined),
    errors: [
      ...unpublished.map(
        (doc) =>
          `${doc._id} is a draft or release version: publish or discard it in Studio first, or it would undo the migration when published`,
      ),
      ...bookErrors,
      ...shelfErrors,
      ...ours
        .filter((doc) => !doc._rev)
        .map((doc) => `${doc._id} has no revision, so its patch cannot be guarded`),
    ],
  };
}

/**
 * What makes the catalog unusable: a slug the site cannot route (a slug also names its cover
 * file), duplicate slugs, bad stages, a track with no shelf.
 */
function catalogErrors(catalog: BookshelfCatalogInput): string[] {
  const shelfTitles = new Set<string>(catalog.shelves.map((shelf) => shelf.title));
  const slugs = [...catalog.shelves, ...catalog.books].map((entry) => entry.slug);
  const duplicateShelf = firstDuplicate(catalog.shelves.map((shelf) => shelf.slug));
  const duplicateBook = firstDuplicate(catalog.books.map((book) => book.slug));
  const stages = catalog.books.map((book) => book.stage);
  const badStages =
    stages.some((stage) => !Number.isInteger(stage) || stage < 1) ||
    new Set(stages).size !== stages.length;
  return [
    ...slugs
      .filter((slug) => !CATALOG_SLUG_PATTERN.test(slug))
      .map((slug) => `Catalog slug "${slug}" is not lowercase words joined by hyphens`),
    ...(duplicateShelf ? [`Duplicate catalog shelf slug: ${duplicateShelf}`] : []),
    ...(duplicateBook ? [`Duplicate catalog book slug: ${duplicateBook}`] : []),
    ...(badStages ? ['Catalog stages must be distinct positive integers'] : []),
    ...catalog.books
      .filter((book) => !shelfTitles.has(book.track))
      .map((book) => `Catalog track "${book.track}" has no catalog shelf (book "${book.slug}")`),
  ];
}

/** A catalog shelf, the document it maps to, and the title the site shows for it. */
interface ShelfTarget {
  readonly shelf: CatalogShelf;
  readonly position: number;
  readonly id: string;
  readonly existing?: ExistingDoc;
  /** Studio's title when it has one: the track label the legacy `track` must repeat. */
  readonly title: string;
}

interface BookTarget {
  readonly book: CatalogBook;
  readonly id: string;
  readonly existing?: ExistingDoc;
  readonly shelf?: ShelfTarget;
}

/** New ids that another published document already holds: createIfNotExists would skip them. */
function collisionErrors(
  index: DocIndex,
  targets: readonly {
    readonly id: string;
    readonly existing?: ExistingDoc;
    readonly slug: string;
  }[],
): string[] {
  return targets.flatMap(({ id, existing, slug }) => {
    const holder = existing ? undefined : index.byId.get(id);
    if (!holder) return [];
    return [
      `${id} already exists as a ${holder._type} with slug "${slugOf(holder) ?? ''}", so "${slug}" cannot be created`,
    ];
  });
}

/** Documents the catalog does not know: left untouched, and reported. */
function orphanWarnings(index: DocIndex, catalog: BookshelfCatalogInput): string[] {
  const bookSlugs = new Set(catalog.books.map((book) => book.slug));
  const shelfSlugs = new Set(catalog.shelves.map((shelf) => shelf.slug));
  return [
    ...[...index.books.entries()]
      .filter(([slug]) => !bookSlugs.has(slug))
      .map(([slug, doc]) => `book ${doc._id} ("${slug}") is not in the catalog; left unchanged`),
    ...[...index.shelves.entries()]
      .filter(([slug]) => !shelfSlugs.has(slug))
      .map(
        ([slug, doc]) => `bookshelf ${doc._id} ("${slug}") is not in the catalog; left unchanged`,
      ),
    ...index.unslugged.map((doc) => `${doc._type} ${doc._id} has no slug; left unchanged`),
  ];
}

/** True once --finalize ran: every catalog book migrated, and no legacy field anywhere. */
function isFinalized(index: DocIndex, catalog: BookshelfCatalogInput): boolean {
  if (catalog.books.length === 0) return false;
  const migrated = catalog.books.every((book) => {
    const doc = index.books.get(book.slug);
    return doc !== undefined && refOf(doc.shelf) !== undefined && coverAssetOf(doc) !== undefined;
  });
  const legacy =
    [...index.books.values()].some((doc) => doc.track !== undefined) ||
    [...index.shelves.values()].some((doc) => doc.books !== undefined);
  return migrated && !legacy;
}

interface PlannedDoc {
  readonly create?: DocCreate;
  readonly patch?: DocPatch;
  readonly changes: readonly FieldChange[];
  readonly diffs: readonly FieldDiff[];
  readonly warnings: readonly string[];
}

function planBook(target: BookTarget, shelf: ShelfTarget): PlannedDoc {
  const { book, id, existing } = target;
  const always = {
    status: book.status,
    order: book.stage * 10,
    track: shelf.title,
    shelf: referenceTo(shelf.id),
  };
  if (!existing) {
    const doc = { _id: id, _type: 'book', ...bookContent(book), ...always };
    const cover = { slug: book.slug, docId: id, alt: `${book.title} by ${book.authors}` };
    return {
      create: { type: 'book', id, slug: book.slug, doc, cover },
      changes: [],
      diffs: [],
      warnings: [],
    };
  }
  const subject: Subject = { type: 'book', id, slug: book.slug, doc: existing };
  const content = bookContent(book);
  const keptCoverUrl = hasValue(existing.coverUrl) && !isRelativeCoverUrl(existing.coverUrl);
  const changes = [
    ...setChanges(subject, always),
    ...fillChanges(subject, content),
    ...unsetChanges(subject, [
      'spine',
      ...(isRelativeCoverUrl(existing.coverUrl) ? ['coverUrl'] : []),
    ]),
  ];
  const title = textOr(existing.title, book.title);
  const authors = textOr(existing.authors, book.authors);
  const storedAlt = isRecord(existing.coverImage) ? existing.coverImage.alt : undefined;
  const cover = coverAssetOf(existing)
    ? undefined
    : { slug: book.slug, docId: id, alt: textOr(storedAlt, `${title} by ${authors}`) };
  return {
    patch: toPatch(subject, changes, cover),
    changes,
    diffs: contentDiffs(subject, content),
    warnings: keptCoverUrl
      ? [`book ${id} keeps its external coverUrl (the site no longer reads it)`]
      : [],
  };
}

/**
 * Shelf descriptions the old seed script wrote that the catalog has since rewritten. A stored value
 * equal to one of these is seed output, not a Studio edit, so the catalog replaces it; any other
 * stored description is kept and reported as a diff.
 */
export const SEED_SHELF_DESCRIPTIONS: Readonly<Record<string, string>> = {
  foundations: 'Hardware, kernels, virtual memory, concurrency, and how packets cross the wire.',
  backend:
    'Storage engines, replication, distributed consensus, system design, and service boundaries.',
  ai: 'Deep learning math, production ML pipelines, building LLMs from scratch, and AI systems.',
};

function planShelf(target: ShelfTarget, books: readonly BookTarget[]): PlannedDoc {
  const { shelf, position, id, existing } = target;
  const seedText = SEED_SHELF_DESCRIPTIONS[shelf.slug];
  const seedOwned = seedText !== undefined && existing?.description === seedText;
  const { description, ...contentWithoutDescription } = shelfContent(shelf);
  const always = {
    ...(seedOwned ? { description } : {}),
    order: (position + 1) * 10,
    books: books
      .filter((book) => book.shelf?.id === id)
      .sort((a, b) => a.book.stage - b.book.stage)
      .map((book) => ({ _key: book.book.slug, ...referenceTo(book.id) })),
  };
  if (!existing) {
    const doc = { _id: id, _type: 'bookshelf', ...shelfContent(shelf), ...always };
    return {
      create: { type: 'bookshelf', id, slug: shelf.slug, doc },
      changes: [],
      diffs: [],
      warnings: [],
    };
  }
  const subject: Subject = { type: 'bookshelf', id, slug: shelf.slug, doc: existing };
  const content = seedOwned ? contentWithoutDescription : shelfContent(shelf);
  const changes = [
    ...setChanges(subject, always),
    ...fillChanges(subject, content),
    ...unsetChanges(subject, SHELF_DEAD_FIELDS),
  ];
  return {
    patch: toPatch(subject, changes),
    changes,
    diffs: contentDiffs(subject, content),
    warnings: [],
  };
}

function collect(
  mode: PlanMode,
  planned: readonly PlannedDoc[],
  errors: readonly string[],
  warnings: readonly string[],
): BookshelfMigrationPlan {
  const creates = planned.flatMap((item) => (item.create ? [item.create] : []));
  const patches = planned.flatMap((item) => (item.patch ? [item.patch] : []));
  const covers = [...creates, ...patches].flatMap((item) => (item.cover ? [item.cover] : []));
  return {
    mode,
    errors,
    warnings: [...warnings, ...planned.flatMap((item) => item.warnings)],
    creates,
    patches,
    coverUploads: covers,
    changes: planned.flatMap((item) => item.changes),
    diffs: planned.flatMap((item) => item.diffs),
    unchanged: planned.filter((item) => !item.create && !item.patch).length,
  };
}

/** --finalize: unset `track` on every book and `books` on every shelf that still has them. */
function planFinalize(index: DocIndex): BookshelfMigrationPlan {
  const legacy = (type: DocType, field: string): PlannedDoc[] =>
    [...index.byId.values()]
      .filter((doc) => doc._type === type)
      .map((doc) => {
        const subject: Subject = { type, id: doc._id, slug: slugOf(doc) ?? '', doc };
        const changes = unsetChanges(subject, [field]);
        return { patch: toPatch(subject, changes), changes, diffs: [], warnings: [] };
      });
  return collect(
    'finalize',
    [...legacy('book', 'track'), ...legacy('bookshelf', 'books')],
    index.errors,
    [],
  );
}

/**
 * Plans the migration of `catalog` into the documents Sanity holds (read with the raw perspective,
 * so drafts are included), or, in `finalize` mode, the removal of the legacy fields.
 */
export function planBookshelfMigration(
  existingDocs: readonly ExistingDoc[],
  catalog: BookshelfCatalogInput,
  mode: PlanMode,
): BookshelfMigrationPlan {
  const index = indexDocuments(existingDocs);
  if (mode === 'finalize') return planFinalize(index);

  const shelves: ShelfTarget[] = catalog.shelves.map((shelf, position) => {
    const existing = index.shelves.get(shelf.slug);
    const id = existing?._id ?? newShelfId(shelf.slug);
    return { shelf, position, id, existing, title: textOr(existing?.title, shelf.title) };
  });
  const shelfByTrack = new Map<string, ShelfTarget>(
    shelves.map((target) => [target.shelf.title, target]),
  );
  const books: BookTarget[] = catalog.books.map((book) => {
    const existing = index.books.get(book.slug);
    const id = existing?._id ?? newBookId(book.slug);
    return { book, id, existing, shelf: shelfByTrack.get(book.track) };
  });

  const errors = [
    ...index.errors,
    ...catalogErrors(catalog),
    ...collisionErrors(index, [
      ...shelves.map((target) => ({ ...target, slug: target.shelf.slug })),
      ...books.map((target) => ({ ...target, slug: target.book.slug })),
    ]),
    ...(isFinalized(index, catalog)
      ? ['The dataset is already finalized: --apply would write the legacy fields back']
      : []),
  ];
  const planned = [
    ...books.flatMap((target) => (target.shelf ? [planBook(target, target.shelf)] : [])),
    ...shelves.map((target) => planShelf(target, books)),
  ];
  return collect('migrate', planned, errors, orphanWarnings(index, catalog));
}

function patchMutation(
  patch: DocPatch,
  extraSet: Readonly<Record<string, unknown>>,
): SanityMutation {
  const set = { ...patch.set, ...extraSet };
  return {
    patch: {
      id: patch.id,
      ...(patch.rev ? { ifRevisionID: patch.rev } : {}),
      ...(Object.keys(set).length > 0 ? { set } : {}),
      ...(Object.keys(patch.setIfMissing).length > 0
        ? { setIfMissing: { ...patch.setIfMissing } }
        : {}),
      ...(patch.unset.length > 0 ? { unset: [...patch.unset] } : {}),
    },
  };
}

/**
 * The plan as one transaction's mutations, with each uploaded cover attached (`coverAssets` maps
 * a book slug to its image asset id). Ordered so that every strong reference points at a document
 * that already exists when its mutation runs: new shelves (without their legacy `books`), new
 * books, existing books, existing shelves, then the new shelves' `books`.
 */
export function buildMutations(
  plan: BookshelfMigrationPlan,
  coverAssets: ReadonlyMap<string, string>,
): SanityMutation[] {
  if (plan.errors.length > 0) throw new Error('The plan has errors; nothing may be written');
  const coverImage = (cover: CoverUpload) => {
    const assetId = coverAssets.get(cover.slug);
    if (!assetId) throw new Error(`No uploaded cover for "${cover.slug}"`);
    return { _type: 'image', asset: referenceTo(assetId), alt: cover.alt };
  };
  const ofType = <T extends { readonly type: DocType }>(items: readonly T[], type: DocType): T[] =>
    items.filter((item) => item.type === type);
  const newShelves = ofType(plan.creates, 'bookshelf');

  return [
    ...newShelves.map(({ doc, id }): SanityMutation => {
      const { books: _books, ...rest } = doc;
      return { createIfNotExists: { ...rest, _id: id, _type: 'bookshelf' } };
    }),
    ...ofType(plan.creates, 'book').map(
      ({ doc, id, cover }): SanityMutation => ({
        createIfNotExists: {
          ...doc,
          _id: id,
          _type: 'book',
          ...(cover ? { coverImage: coverImage(cover) } : {}),
        },
      }),
    ),
    ...ofType(plan.patches, 'book').map((patch) =>
      patchMutation(patch, patch.cover ? { coverImage: coverImage(patch.cover) } : {}),
    ),
    ...ofType(plan.patches, 'bookshelf').map((patch) => patchMutation(patch, {})),
    ...newShelves
      .filter(({ doc }) => doc.books !== undefined)
      .map(({ doc, id }): SanityMutation => ({ patch: { id, set: { books: doc.books } } })),
  ];
}
