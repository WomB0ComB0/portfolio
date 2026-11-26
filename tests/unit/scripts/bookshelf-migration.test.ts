// @vitest-environment node

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
 * @file The one-shot bookshelf migration (scripts/bookshelf/), against a fixture of what the old
 * seed wrote to production (44 books and 8 shelves from the previous catalog: ids book-<slug>,
 * relative coverUrl, spine, accentColor, featured, old stages as order, the 14 engineering books
 * still "completed"). Mutations are applied in order by a small Sanity stand-in that fails like
 * Sanity does: a patch on a missing document, a stale ifRevisionID, or a strong reference to a
 * document that does not exist yet. No network, no files.
 */

import { describe, expect, it, vi } from 'vitest';
import { buildCatalog } from '../../../scripts/bookshelf/catalog/build-catalog';
import { ENGINEERING_BOOKS } from '../../../scripts/bookshelf/catalog/engineering-books';
import { RAW_PERSONAL_BOOKS } from '../../../scripts/bookshelf/catalog/reading-list-books';
import type { BookshelfCatalogInput } from '../../../scripts/bookshelf/catalog/types';
import {
  describePlan,
  type MigrationConnection,
  parseArgs,
  runCli,
} from '../../../scripts/bookshelf/migrate-to-sanity';
import {
  asExistingDocs,
  type BookshelfMigrationPlan,
  buildMutations,
  candidateIds,
  type ExistingDoc,
  isDeepEqual,
  isRecord,
  planBookshelfMigration,
  refOf,
  type SanityMutation,
  SEED_SHELF_DESCRIPTIONS,
  slugOf,
} from '../../../scripts/bookshelf/plan-migration';
import { verifyBookshelfState } from '../../../scripts/bookshelf/verify-migration';

const catalog = buildCatalog();
const PERSONAL = new Set(RAW_PERSONAL_BOOKS.map((book) => book.slug));
const ENGINEERING = new Set(ENGINEERING_BOOKS.map((book) => book.slug));
const NEW_SHELVES = new Set(['web-and-languages', 'security']);
const SAVED_AT = '2026-01-01T00:00:00Z';

const assetId = (slug: string): string => `image-${slug}-520x680-webp`;
const assetsFor = (plan: BookshelfMigrationPlan): Map<string, string> =>
  new Map(plan.coverUploads.map((cover) => [cover.slug, assetId(cover.slug)]));

/** The 44 books the old seed wrote from the previous catalog: all but the reading list. */
function headBooks(): ExistingDoc[] {
  return catalog.books
    .filter((book) => !PERSONAL.has(book.slug))
    .map((book, index) => ({
      _id: `book-${book.slug}`,
      _type: 'book',
      _rev: `rev-${book.slug}`,
      _createdAt: SAVED_AT,
      _updatedAt: SAVED_AT,
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
      status: ENGINEERING.has(book.slug) ? 'completed' : 'queued',
      summary: book.summary,
      coverUrl: `/assets/bookshelf/${book.slug}.webp`,
      url: book.url,
      spine: { capBg: 'var(--surface-3)', capText: 'var(--ink)', bodyBg: 'var(--surface-2)' },
      topics: [...book.topics],
      order: index + 1,
    }));
}

/** The 8 shelves the old seed wrote: all but Web & Languages and Security. */
function headShelves(books: readonly ExistingDoc[]): ExistingDoc[] {
  return catalog.shelves
    .filter((shelf) => !NEW_SHELVES.has(shelf.slug))
    .map((shelf, index) => ({
      _id: `bookshelf-${shelf.slug}`,
      _type: 'bookshelf',
      _rev: `rev-${shelf.slug}`,
      _createdAt: SAVED_AT,
      _updatedAt: SAVED_AT,
      title: shelf.title,
      slug: { _type: 'slug', current: shelf.slug },
      // The old seed wrote the previous copy for three shelves the catalog has since rewritten.
      description: SEED_SHELF_DESCRIPTIONS[shelf.slug] ?? shelf.description,
      accentColor: 'var(--brand)',
      order: index + 1,
      featured: true,
      books: books
        .filter((book) => book.track === shelf.title)
        .map((book) => ({ _key: slugOf(book), _type: 'reference', _ref: book._id })),
    }));
}

function headState(): ExistingDoc[] {
  const books = headBooks();
  return [...books, ...headShelves(books)];
}

/** One document of `docs` by id, or a failed test. */
function docById(docs: readonly ExistingDoc[], id: string): ExistingDoc {
  const doc = docs.find((candidate) => candidate._id === id);
  if (!doc) throw new Error(`No document ${id}`);
  return doc;
}

/** `docs` with one document replaced by `change(doc)`. */
const withDoc = (
  docs: readonly ExistingDoc[],
  id: string,
  change: (doc: ExistingDoc) => ExistingDoc,
): ExistingDoc[] => docs.map((doc) => (doc._id === id ? change(doc) : doc));

/** `docs` without the named fields on one document. */
const without = (docs: readonly ExistingDoc[], id: string, fields: readonly string[]) =>
  withDoc(docs, id, (doc) => {
    const entries = Object.entries(doc).filter(([field]) => !fields.includes(field));
    return { ...Object.fromEntries(entries), _id: doc._id, _type: doc._type };
  });

/** A Sanity error with a status code, as @sanity/client throws. */
const sanityError = (statusCode: number): Error =>
  Object.assign(new Error(`HTTP ${statusCode}`), { statusCode });

/** The strong references a document holds (asset references are always resolvable here). */
const strongRefs = (doc: ExistingDoc): string[] => [
  ...(refOf(doc.shelf) ? [refOf(doc.shelf) ?? ''] : []),
  ...(Array.isArray(doc.books) ? doc.books.map((item) => refOf(item) ?? '') : []),
];

/** One mutation applied to `state`, as Sanity applies it; `rev` is the revision it leaves. */
function applyMutation(
  state: readonly ExistingDoc[],
  mutation: SanityMutation,
  rev: string,
): ExistingDoc[] {
  const ids = new Set(state.map((doc) => doc._id));
  const checked = (doc: ExistingDoc): ExistingDoc => {
    const missing = strongRefs(doc).filter((ref) => !ids.has(ref) && ref !== doc._id);
    if (missing.length > 0) throw new Error(`${doc._id} references missing ${missing.join()}`);
    return doc;
  };
  if ('createIfNotExists' in mutation) {
    const doc = mutation.createIfNotExists;
    return ids.has(doc._id) ? [...state] : state.concat(checked({ ...doc, _rev: rev }));
  }
  const { id, ifRevisionID, set = {}, setIfMissing = {}, unset = [] } = mutation.patch;
  const current = state.find((doc) => doc._id === id);
  if (!current) throw new Error(`Patch on missing document ${id}`);
  if (ifRevisionID && current._rev !== ifRevisionID) throw sanityError(409);
  const afterSet: Record<string, unknown> = { ...current, ...set };
  const fills = Object.entries(setIfMissing).filter(([field]) => !(field in afterSet));
  const next = Object.entries({ ...Object.fromEntries(fills), ...afterSet }).filter(
    ([field]) => !unset.includes(field),
  );
  const updated = checked({
    ...Object.fromEntries(next),
    _id: id,
    _type: current._type,
    _rev: rev,
  });
  return state.map((doc) => (doc._id === id ? updated : doc));
}

/**
 * Applies mutations one by one, as a Sanity transaction does, and fails as Sanity would: a patch
 * on a missing document, a stale ifRevisionID (409), a reference to a missing document.
 */
function applyMutations(
  docs: readonly ExistingDoc[],
  mutations: readonly SanityMutation[],
): ExistingDoc[] {
  return mutations.reduce<ExistingDoc[]>(
    (state, mutation, index) => applyMutation(state, mutation, `tx-${index}`),
    [...docs],
  );
}

/** Plans `mode`, then applies the plan with uploaded covers for whatever it needs. */
function migrate(docs: readonly ExistingDoc[], mode: 'migrate' | 'finalize' = 'migrate') {
  const plan = planBookshelfMigration(docs, catalog, mode);
  return { plan, after: applyMutations(docs, buildMutations(plan, assetsFor(plan))) };
}

const migratedState = (): ExistingDoc[] => migrate(headState()).after;

describe('the catalog the migration writes', () => {
  it('has 69 books in 10 shelves, staged 1 to 69 shelf by shelf from Web & Languages', () => {
    expect(catalog.books).toHaveLength(69);
    expect(catalog.shelves).toHaveLength(10);
    expect(catalog.books.map((book) => book.stage)).toEqual(
      Array.from({ length: 69 }, (_, index) => index + 1),
    );
    expect(catalog.books[0]?.track).toBe('Web & Languages');
    const shelfOfBook = catalog.books.map((book) =>
      catalog.shelves.findIndex((shelf) => shelf.title === book.track),
    );
    expect(shelfOfBook).toEqual([...shelfOfBook].sort((a, b) => a - b));
    expect(catalog.books.filter((book) => book.status === 'completed')).toHaveLength(3);
  });

  it('asks Sanity for every id it could create, of any type', () => {
    const ids = candidateIds(catalog);
    expect(ids).toHaveLength(79);
    expect(ids).toContain('bookshelf-security');
    expect(ids).toContain('book-job-ready-python');
  });
});

describe('planning against the dataset the old seed wrote', () => {
  const plan = planBookshelfMigration(headState(), catalog, 'migrate');
  const ofType = <T extends { readonly type: string }>(items: readonly T[], type: string) =>
    items.filter((item) => item.type === type);
  const changesOf = (field: string, action = 'set') =>
    plan.changes.filter((change) => change.field === field && change.action === action);

  it('creates the 25 reading-list books and 2 shelves, and patches the 44 books and 8 shelves', () => {
    expect(plan.errors).toEqual([]);
    expect(plan.warnings).toEqual([]);
    expect(ofType(plan.creates, 'book').map((create) => create.id)).toEqual(
      catalog.books.filter((book) => PERSONAL.has(book.slug)).map((book) => `book-${book.slug}`),
    );
    expect(ofType(plan.creates, 'book')).toHaveLength(25);
    expect(ofType(plan.creates, 'bookshelf').map((create) => create.id)).toEqual([
      'bookshelf-web-and-languages',
      'bookshelf-security',
    ]);
    expect(ofType(plan.patches, 'book')).toHaveLength(44);
    expect(ofType(plan.patches, 'bookshelf')).toHaveLength(8);
    expect(plan.coverUploads).toHaveLength(69);
    expect(plan.unchanged).toBe(0);
  });

  it('turns the 14 engineering books from completed to queued, and no other status', () => {
    const statuses = changesOf('status');
    expect(statuses).toHaveLength(14);
    expect(statuses.every((change) => ENGINEERING.has(change.slug))).toBe(true);
    expect(statuses.every((change) => change.from === 'completed' && change.to === 'queued')).toBe(
      true,
    );
  });

  it('rewrites the order of all 44 existing books and 8 shelves, and points them at shelves', () => {
    expect(changesOf('order').filter((change) => change.type === 'book')).toHaveLength(44);
    expect(changesOf('order').filter((change) => change.type === 'bookshelf')).toHaveLength(8);
    expect(changesOf('shelf')).toHaveLength(44);
  });

  it('removes the relative coverUrl and spine from 44 books, accentColor and featured from 8 shelves', () => {
    expect(changesOf('coverUrl', 'unset')).toHaveLength(44);
    expect(changesOf('spine', 'unset')).toHaveLength(44);
    expect(changesOf('accentColor', 'unset')).toHaveLength(8);
    expect(changesOf('featured', 'unset')).toHaveLength(8);
  });

  it('keeps every Studio value: identical content needs no diff and no fill', () => {
    expect(plan.diffs).toEqual([]);
    expect(plan.changes.filter((change) => change.action === 'fill')).toEqual([]);
  });

  it('replaces only the three shelf descriptions that are still the old seed copy', () => {
    const descriptions = changesOf('description');
    expect(descriptions.map((change) => change.slug).sort()).toEqual([
      'ai',
      'backend',
      'foundations',
    ]);
    for (const change of descriptions) {
      expect(change.from).toBe(SEED_SHELF_DESCRIPTIONS[change.slug]);
      expect(change.to).toBe(
        catalog.shelves.find((shelf) => shelf.slug === change.slug)?.description,
      );
    }
  });

  it('keeps a shelf description edited in Studio and reports it as a diff', () => {
    const edited = headState().map((doc) =>
      doc._id === 'bookshelf-ai' ? { ...doc, description: 'My own words about this shelf.' } : doc,
    );
    const editedPlan = planBookshelfMigration(edited, catalog, 'migrate');
    expect(
      editedPlan.changes.filter((change) => change.field === 'description' && change.slug === 'ai'),
    ).toEqual([]);
    expect(editedPlan.diffs.map((diff) => `${diff.slug}.${diff.field}`)).toEqual([
      'ai.description',
    ]);
  });

  it('guards every patch of an existing document with the revision it read', () => {
    const patches = buildMutations(plan, assetsFor(plan)).flatMap((mutation) =>
      'patch' in mutation ? [mutation.patch] : [],
    );
    const existing = new Map(headState().map((doc) => [doc._id, doc._rev]));
    const guarded = patches.filter((patch) => existing.has(patch.id));
    expect(guarded).toHaveLength(52);
    for (const patch of guarded) expect(patch.ifRevisionID).toBe(existing.get(patch.id));
  });

  it('orders the transaction so each strong reference exists when it is written', () => {
    const mutations = buildMutations(plan, assetsFor(plan));
    for (const mutation of mutations.slice(0, 2)) {
      expect('createIfNotExists' in mutation && mutation.createIfNotExists._type).toBe('bookshelf');
      expect('createIfNotExists' in mutation && 'books' in mutation.createIfNotExists).toBe(false);
    }
    expect(mutations.slice(-2).map((mutation) => 'patch' in mutation && mutation.patch.id)).toEqual(
      ['bookshelf-web-and-languages', 'bookshelf-security'],
    );
    expect(() => applyMutations(headState(), mutations)).not.toThrow();
  });
});

describe('the migrated dataset', () => {
  const after = migratedState();
  const books = after.filter((doc) => doc._type === 'book');
  const shelves = after.filter((doc) => doc._type === 'bookshelf');
  const bySlug = new Map(books.map((doc) => [slugOf(doc), doc]));

  it('numbers every book stage x 10, one sequence across shelves', () => {
    for (const book of catalog.books) expect(bySlug.get(book.slug)?.order).toBe(book.stage * 10);
    const sorted = [...books].sort((a, b) => Number(a.order) - Number(b.order));
    expect(sorted.map((doc) => slugOf(doc))).toEqual(catalog.books.map((book) => book.slug));
    expect(sorted[0]?.track).toBe('Web & Languages');
  });

  it('puts each book on its shelf, with the legacy track and books[] consistent', () => {
    const shelfById = new Map(shelves.map((shelf) => [shelf._id, shelf]));
    for (const book of catalog.books) {
      const doc = bySlug.get(book.slug);
      const shelf = shelfById.get(refOf(doc?.shelf) ?? '');
      expect(shelf?.title).toBe(book.track);
      expect(doc?.track).toBe(book.track);
    }
    expect(docById(after, 'bookshelf-security').books).toEqual(
      catalog.books
        .filter((book) => book.track === 'Security')
        .map((book) => ({ _key: book.slug, _type: 'reference', _ref: `book-${book.slug}` })),
    );
    expect(shelves.map((shelf) => shelf.order).sort((a, b) => Number(a) - Number(b))).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ]);
  });

  it('gives every book an uploaded cover with "<title> by <authors>" alt text', () => {
    expect(docById(after, 'book-job-ready-python').coverImage).toEqual({
      _type: 'image',
      asset: { _type: 'reference', _ref: assetId('job-ready-python') },
      alt: 'Job Ready Python by Haythem Balti & Kimberly A. Weiss',
    });
    expect(books.every((doc) => isRecord(doc.coverImage))).toBe(true);
  });

  it('passes --verify', () => {
    const result = verifyBookshelfState(after, catalog);
    expect(result.stage).toBe('migrated');
    expect(result.failures).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.statuses).toEqual({ completed: 3, queued: 66 });
  });

  it('plans nothing when the migration runs again', () => {
    const again = planBookshelfMigration(after, catalog, 'migrate');
    expect(again.errors).toEqual([]);
    expect(again.creates).toEqual([]);
    expect(again.patches).toEqual([]);
    expect(again.coverUploads).toEqual([]);
    expect(again.changes).toEqual([]);
    expect(again.unchanged).toBe(79);
  });
});

describe('--finalize', () => {
  const { plan, after } = migrate(migratedState(), 'finalize');

  it('only unsets track on the 69 books and books on the 10 shelves', () => {
    expect(plan.errors).toEqual([]);
    expect(plan.creates).toEqual([]);
    expect(plan.coverUploads).toEqual([]);
    expect(plan.patches).toHaveLength(79);
    for (const patch of plan.patches) {
      expect(patch.set).toEqual({});
      expect(patch.setIfMissing).toEqual({});
      expect(patch.unset).toEqual([patch.type === 'book' ? 'track' : 'books']);
    }
  });

  it('leaves a dataset that verifies as finalized, and has nothing left to finalize', () => {
    expect(verifyBookshelfState(after, catalog).stage).toBe('finalized');
    expect(verifyBookshelfState(after, catalog, 'finalized').failures).toEqual([]);
    expect(planBookshelfMigration(after, catalog, 'finalize').patches).toEqual([]);
  });

  it('refuses a later --apply, which would write the legacy fields back', () => {
    expect(planBookshelfMigration(after, catalog, 'migrate').errors).toEqual([
      'The dataset is already finalized: --apply would write the legacy fields back',
    ]);
  });
});

describe('Studio wins on content', () => {
  const edited = withDoc(headState(), 'book-computer-systems', (doc) => ({
    ...doc,
    summary: 'Edited in Studio.',
    edition: null,
  }));
  const plan = planBookshelfMigration(
    without(edited, 'book-computer-systems', ['publisher']),
    catalog,
    'migrate',
  );
  const patch = plan.patches.find((candidate) => candidate.id === 'book-computer-systems');

  it('keeps a different Studio value and reports it', () => {
    expect(plan.diffs).toEqual([
      expect.objectContaining({
        id: 'book-computer-systems',
        field: 'summary',
        studio: 'Edited in Studio.',
      }),
    ]);
    expect(patch?.set).not.toHaveProperty('summary');
    expect(patch?.setIfMissing).not.toHaveProperty('summary');
  });

  it('fills a missing field with setIfMissing, and a null one with set', () => {
    expect(patch?.setIfMissing).toEqual({ publisher: 'Pearson' });
    expect(patch?.set).toHaveProperty('edition', '3rd Edition');
    const fills = plan.changes.filter((change) => change.action === 'fill');
    expect(fills.map((change) => change.field).sort()).toEqual(['edition', 'publisher']);
  });

  it("repeats a shelf's Studio title as its books' legacy track", () => {
    const renamed = withDoc(headState(), 'bookshelf-infra-and-ops', (doc) => ({
      ...doc,
      title: 'Infra and Ops',
    }));
    const { plan: renamedPlan, after } = migrate(renamed);
    expect(renamedPlan.diffs).toEqual([
      expect.objectContaining({ id: 'bookshelf-infra-and-ops', field: 'title' }),
    ]);
    const infra = after.filter((doc) => refOf(doc.shelf) === 'bookshelf-infra-and-ops');
    expect(infra.length).toBeGreaterThan(0);
    expect(infra.every((doc) => doc.track === 'Infra and Ops')).toBe(true);
    expect(verifyBookshelfState(after, catalog).failures).toEqual([]);
  });
});

describe('covers', () => {
  it('uploads nothing for a book that already has a cover asset', () => {
    const state = withDoc(headState(), 'book-computer-systems', (doc) => ({
      ...doc,
      coverImage: { _type: 'image', asset: { _type: 'reference', _ref: 'image-studio' } },
    }));
    const plan = planBookshelfMigration(state, catalog, 'migrate');
    expect(plan.coverUploads.map((cover) => cover.slug)).not.toContain('computer-systems');
    expect(plan.patches.find((candidate) => candidate.id === 'book-computer-systems')?.cover).toBe(
      undefined,
    );
    const mutation = buildMutations(plan, assetsFor(plan)).find(
      (candidate) => 'patch' in candidate && candidate.patch.id === 'book-computer-systems',
    );
    expect(mutation && 'patch' in mutation && mutation.patch.set).not.toHaveProperty('coverImage');
  });

  it('uploads one for a cover without an asset, keeping its alt text', () => {
    const state = withDoc(headState(), 'book-computer-systems', (doc) => ({
      ...doc,
      title: 'CS:APP',
      coverImage: { _type: 'image', alt: 'Studio alt' },
    }));
    const altOf = (docs: readonly ExistingDoc[]) =>
      planBookshelfMigration(docs, catalog, 'migrate').coverUploads.find(
        (cover) => cover.slug === 'computer-systems',
      )?.alt;
    expect(altOf(state)).toBe('Studio alt');
    expect(altOf(without(state, 'book-computer-systems', ['coverImage']))).toBe(
      "CS:APP by Randal E. Bryant & David R. O'Hallaron",
    );
  });

  it('keeps an external coverUrl, with a warning, and unsets only relative ones', () => {
    const state = withDoc(headState(), 'book-computer-systems', (doc) => ({
      ...doc,
      coverUrl: 'https://covers.openlibrary.org/b/isbn/9780134092669-L.jpg',
    }));
    const plan = planBookshelfMigration(state, catalog, 'migrate');
    const unsets = plan.changes.filter((change) => change.field === 'coverUrl');
    expect(unsets).toHaveLength(43);
    expect(unsets.map((change) => change.id)).not.toContain('book-computer-systems');
    expect(plan.warnings).toEqual([
      'book book-computer-systems keeps its external coverUrl (the site no longer reads it)',
    ]);
    const result = verifyBookshelfState(migrate(state).after, catalog);
    expect(result.failures).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it('cannot build the transaction without every planned cover', () => {
    const plan = planBookshelfMigration(headState(), catalog, 'migrate');
    const partial = new Map([...assetsFor(plan)].slice(1));
    expect(() => buildMutations(plan, partial)).toThrow(/No uploaded cover/);
  });
});

describe('matching by slug, not id', () => {
  it('patches a document whatever its id, and points references at that id', () => {
    const state: ExistingDoc[] = [
      ...headState().map((doc) =>
        doc._id === 'bookshelf-backend' ? { ...doc, _id: 'studio-shelf-1' } : doc,
      ),
      {
        _id: 'studio-book-1',
        _type: 'book',
        _rev: 'rev-studio',
        slug: { _type: 'slug', current: 'clean-code' },
        title: 'Clean Code',
        authors: 'Robert C. Martin',
      },
    ];
    const { plan, after } = migrate(state);
    expect(plan.errors).toEqual([]);
    const created = plan.creates.map((create) => create.id);
    expect(created).not.toContain('book-clean-code');
    expect(created).not.toContain('bookshelf-backend');
    expect(plan.patches.map((patch) => patch.id)).toContain('studio-book-1');
    expect(catalog.books.find((book) => book.slug === 'clean-code')?.track).toBe('Backend');
    expect(refOf(docById(after, 'studio-book-1').shelf)).toBe('studio-shelf-1');
    const backend = docById(after, 'studio-shelf-1');
    expect(Array.isArray(backend.books) && backend.books.map((item) => refOf(item))).toContain(
      'studio-book-1',
    );
    expect(verifyBookshelfState(after, catalog).failures).toEqual([]);
  });

  it('leaves a document the catalog does not know untouched, and warns', () => {
    const orphan: ExistingDoc = {
      _id: 'book-extra',
      _type: 'book',
      _rev: 'rev-extra',
      slug: { _type: 'slug', current: 'extra' },
    };
    const plan = planBookshelfMigration([...headState(), orphan], catalog, 'migrate');
    expect(plan.errors).toEqual([]);
    expect(plan.warnings).toEqual([
      'book book-extra ("extra") is not in the catalog; left unchanged',
    ]);
    expect(plan.patches.map((patch) => patch.id)).not.toContain('book-extra');
  });
});

describe('what stops the plan before anything is written', () => {
  const errorsFor = (docs: readonly ExistingDoc[], input: BookshelfCatalogInput = catalog) =>
    planBookshelfMigration(docs, input, 'migrate').errors;

  it.each(['drafts.book-computer-systems', 'versions.r1a2b3.book-computer-systems'])(
    'a draft or release version: %s',
    (id) => {
      const state = [...headState(), { ...docById(headState(), 'book-computer-systems'), _id: id }];
      const errors = errorsFor(state);
      expect(errors).toEqual([expect.stringContaining(`${id} is a draft or release version`)]);
      const plan = planBookshelfMigration(state, catalog, 'migrate');
      expect(() => buildMutations(plan, assetsFor(plan))).toThrow(/errors/);
      expect(planBookshelfMigration(state, catalog, 'finalize').errors).toEqual(errors);
    },
  );

  it('two documents sharing a slug', () => {
    const twin = { ...docById(headState(), 'book-computer-systems'), _id: 'book-twin' };
    expect(errorsFor([...headState(), twin])).toEqual([
      'Two book documents share the slug "computer-systems": book-computer-systems, book-twin',
    ]);
  });

  it('an id the plan would create, held by a document with another slug', () => {
    const squatter: ExistingDoc = {
      _id: 'book-clean-code',
      _type: 'book',
      _rev: 'rev-squatter',
      slug: { _type: 'slug', current: 'renamed-in-studio' },
    };
    expect(errorsFor([...headState(), squatter])).toEqual([
      'book-clean-code already exists as a book with slug "renamed-in-studio", so "clean-code" cannot be created',
    ]);
  });

  it('a document without a revision', () => {
    expect(errorsFor(without(headState(), 'book-computer-systems', ['_rev']))).toEqual([
      'book-computer-systems has no revision, so its patch cannot be guarded',
    ]);
  });

  it('a catalog track with no catalog shelf, or a slug the site cannot route', () => {
    const noSecurity = {
      ...catalog,
      shelves: catalog.shelves.filter((shelf) => shelf.slug !== 'security'),
    };
    const errors = errorsFor(headState(), noSecurity);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((message) => message.startsWith('Catalog track "Security"'))).toBe(true);
    const badSlug = {
      ...catalog,
      books: catalog.books.map((book, index) =>
        index === 0 ? { ...book, slug: '../escape' } : book,
      ),
    };
    expect(errorsFor(headState(), badSlug)).toContain(
      'Catalog slug "../escape" is not lowercase words joined by hyphens',
    );
  });
});

describe('verifyBookshelfState', () => {
  const after = migratedState();
  const failuresOf = (docs: readonly ExistingDoc[]) => verifyBookshelfState(docs, catalog).failures;

  it.each([
    [
      'a missing cover',
      without(after, 'book-clean-code', ['coverImage']),
      'books have no cover image asset',
    ],
    [
      'a missing shelf reference',
      without(after, 'book-clean-code', ['shelf']),
      'books do not reference an existing shelf',
    ],
    [
      'a missing book',
      after.filter((doc) => doc._id !== 'book-clean-code'),
      '68 books, expected 69',
    ],
    [
      'a shared order',
      withDoc(after, 'book-clean-code', (doc) => ({
        ...doc,
        order: docById(after, 'book-job-ready-python').order,
      })),
      'book order values are shared',
    ],
    [
      'an order out of catalog order',
      withDoc(after, 'book-job-ready-python', (doc) => ({ ...doc, order: 100_000 })),
      'book order does not follow the catalog',
    ],
    [
      'a status the catalog does not have',
      withDoc(after, 'book-clean-code', (doc) => ({ ...doc, status: 'reading' })),
      'books are "reading", expected 0',
    ],
    [
      'a leftover spine',
      withDoc(after, 'book-clean-code', (doc) => ({ ...doc, spine: {} })),
      'books still have a spine palette',
    ],
    [
      'a leftover relative coverUrl',
      withDoc(after, 'book-clean-code', (doc) => ({
        ...doc,
        coverUrl: '/assets/bookshelf/x.webp',
      })),
      'books still have a relative coverUrl',
    ],
    [
      'a leftover accentColor',
      withDoc(after, 'bookshelf-ai', (doc) => ({ ...doc, accentColor: '#fff' })),
      'shelves still have accentColor or featured',
    ],
    [
      'a legacy track that is not the shelf title',
      withDoc(after, 'book-clean-code', (doc) => ({ ...doc, track: 'General' })),
      "books' legacy track is not their shelf's title",
    ],
    [
      'a legacy books[] missing a book',
      withDoc(after, 'bookshelf-security', (doc) => ({
        ...doc,
        books: Array.isArray(doc.books) ? doc.books.slice(1) : [],
      })),
      "shelves' legacy books[] differ from the books that name them",
    ],
    [
      'a book on another shelf than its track',
      withDoc(after, 'book-clean-code', (doc) => ({
        ...doc,
        shelf: { _type: 'reference', _ref: 'bookshelf-ai' },
      })),
      'books sit on a different shelf than their catalog track',
    ],
    [
      'a draft',
      [...after, { ...docById(after, 'book-clean-code'), _id: 'drafts.book-clean-code' }],
      'drafts or release versions exist',
    ],
  ])('fails on %s', (_name, docs, message) => {
    expect(failuresOf(docs).join('\n')).toContain(message);
  });

  it('checks the finalized stage when asked, whatever is present', () => {
    const failures = verifyBookshelfState(after, catalog, 'finalized').failures;
    expect(failures).toHaveLength(2);
    expect(failures[0]).toMatch(/^69 books still have the legacy track: /);
    expect(failures[1]).toMatch(/^10 shelves still have the legacy books\[\]: .* and 5 more$/);
  });

  it('fails the dataset the old seed wrote', () => {
    expect(failuresOf(headState()).length).toBeGreaterThan(0);
  });
});

describe('reading what Sanity answered', () => {
  it('accepts documents and refuses anything else', () => {
    expect(asExistingDocs([{ _id: 'a', _type: 'book', x: 1 }])).toEqual([
      { _id: 'a', _type: 'book', x: 1 },
    ]);
    expect(() => asExistingDocs({ result: [] })).toThrow(TypeError);
    expect(() => asExistingDocs([{ _type: 'book' }])).toThrow(TypeError);
    expect(() => asExistingDocs([null])).toThrow(TypeError);
  });

  it('compares JSON values structurally', () => {
    expect(isDeepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(isDeepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(isDeepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(isDeepEqual([1, 2], [2, 1])).toBe(false);
  });
});

/** A connection to an in-memory dataset, recording uploads and commits. */
function fakeConnection(
  initial: readonly ExistingDoc[],
  overrides: Partial<MigrationConnection> = {},
) {
  let state: readonly ExistingDoc[] = initial;
  const uploads: string[] = [];
  const commits: SanityMutation[][] = [];
  const fetchDocuments = vi.fn(async () => state);
  const connection: MigrationConnection = {
    projectId: 'test-project',
    dataset: 'test',
    hasToken: true,
    fetchDocuments,
    uploadCover: async (slug) => {
      uploads.push(slug);
      return assetId(slug);
    },
    commit: async (mutations) => {
      commits.push([...mutations]);
      state = applyMutations(state, mutations);
    },
    ...overrides,
  };
  return { connection, uploads, commits, fetchDocuments, state: () => state };
}

async function run(
  args: readonly string[],
  connection: MigrationConnection,
  fileExists: (file: string) => Promise<boolean> = async () => true,
) {
  const lines: string[] = [];
  const errors: string[] = [];
  const code = await runCli({
    args,
    connect: async () => connection,
    coverFile: (slug) => `/covers/${slug}.webp`,
    fileExists,
    log: (line) => lines.push(line),
    error: (line) => errors.push(line),
  });
  return { code, lines, errors };
}

describe('the runner', () => {
  it.each([
    [[], 'dry-run'],
    [['--'], 'dry-run'],
    [['--', '--dry-run'], 'dry-run'],
    [['--', '--apply'], 'apply'],
    [['--verify'], 'verify'],
    [['--finalize'], 'finalize'],
    [['--finalize', '--dry-run'], 'finalize-dry-run'],
    [['--help'], 'help'],
  ])('reads %j as %s', (args, mode) => {
    expect(parseArgs(args)).toBe(mode);
  });

  it.each([
    [['--apply', '--verify']],
    [['--apply', '--dry-run']],
    [['--finalize', '--apply']],
    [['--apply', '--apply']],
    [['--force']],
  ])('refuses %j before connecting', async (args) => {
    const connect = vi.fn();
    const errors: string[] = [];
    const code = await runCli({ args, connect, error: (line) => errors.push(line) });
    expect(code).toBe(1);
    expect(connect).not.toHaveBeenCalled();
    expect(errors[0]).toContain('Usage:');
  });

  it('dry-runs by default, printing the plan and writing nothing', async () => {
    const fake = fakeConnection(headState());
    const { code, lines } = await run([], fake.connection);
    expect(code).toBe(0);
    expect(fake.uploads).toEqual([]);
    expect(fake.commits).toEqual([]);
    expect(lines).toContain('  books:   25 to create, 44 to patch');
    expect(lines).toContain('  shelves: 2 to create, 8 to patch');
    expect(lines).toContain("  covers:  69 to upload; 0 of the catalog's cover files missing");
    expect(lines).toContain('  book.status (set): 14');
    expect(lines).toContain('    computer-systems: "completed" -> "queued"');
    expect(lines.at(-1)).toBe('Dry run: nothing was written.');
  });

  it('refuses to run without the CLI user token, before reading', async () => {
    const fake = fakeConnection(headState(), { hasToken: false });
    const { code, errors } = await run(['--apply'], fake.connection);
    expect(code).toBe(1);
    expect(fake.fetchDocuments).not.toHaveBeenCalled();
    expect(errors[0]).toContain('--with-user-token');
  });

  it('applies in one transaction after uploading 69 covers, then verifies', async () => {
    const fake = fakeConnection(headState());
    const { code, lines } = await run(['--apply'], fake.connection);
    expect(code).toBe(0);
    expect(fake.uploads).toHaveLength(69);
    expect(new Set(fake.uploads).size).toBe(69);
    expect(fake.commits).toHaveLength(1);
    expect(lines).toContain('  All invariants hold.');
    expect(verifyBookshelfState(fake.state(), catalog).failures).toEqual([]);

    const again = await run(['--apply'], fake.connection);
    expect(again.code).toBe(0);
    expect(fake.uploads).toHaveLength(69);
    expect(fake.commits).toHaveLength(1);
    expect(again.lines).toContain('Nothing to write: the dataset already matches the catalog.');
  });

  it('stops before uploading when a draft exists', async () => {
    const draft = { ...docById(headState(), 'book-computer-systems'), _id: 'drafts.book-x' };
    const fake = fakeConnection([...headState(), draft]);
    const { code, errors } = await run(['--apply'], fake.connection);
    expect(code).toBe(1);
    expect(fake.uploads).toEqual([]);
    expect(fake.commits).toEqual([]);
    expect(errors).toEqual([
      'Stopped before writing: fix the errors or missing cover files above.',
    ]);
  });

  it('stops before uploading when a cover file is missing', async () => {
    const fake = fakeConnection(headState());
    const { code, lines } = await run(
      ['--apply'],
      fake.connection,
      async (file) => file !== '/covers/clean-code.webp',
    );
    expect(code).toBe(1);
    expect(fake.uploads).toEqual([]);
    expect(fake.commits).toEqual([]);
    expect(lines).toContain('Missing cover file: public/assets/bookshelf/clean-code.webp');
  });

  it('says nothing changed when Sanity rejects the transaction for a stale revision', async () => {
    const fake = fakeConnection(headState(), {
      commit: async () => {
        throw sanityError(409);
      },
    });
    const { code, errors } = await run(['--apply'], fake.connection);
    expect(code).toBe(1);
    expect(errors).toEqual([
      'A document changed after it was read, so the transaction was rejected and nothing changed. Run --dry-run again.',
    ]);
  });

  it.each([
    ['a lost response', () => new TypeError('fetch failed')],
    ['a gateway timeout', () => sanityError(504)],
  ])('says the outcome is unknown, and to verify, after %s on commit', async (_case, error) => {
    const fake = fakeConnection(headState(), {
      commit: async () => {
        throw error();
      },
    });
    const { code, errors } = await run(['--apply'], fake.connection);
    expect(code).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(
      /outcome is unknown: the transaction may have been applied\. Run --verify/,
    );
  });

  it('names the step, never the SDK message, when a read fails', async () => {
    const fake = fakeConnection(headState(), {
      fetchDocuments: async () => {
        throw Object.assign(new Error('secret detail'), { statusCode: 401 });
      },
    });
    const { code, errors } = await run(['--verify'], fake.connection);
    expect(code).toBe(1);
    expect(errors).toEqual(['Could not read the dataset (HTTP 401). Nothing was written.']);
  });

  it('verifies read-only: the old dataset fails, the migrated one passes', async () => {
    const before = fakeConnection(headState());
    expect((await run(['--verify'], before.connection)).code).toBe(1);
    const after = fakeConnection(migratedState());
    expect((await run(['--verify'], after.connection)).code).toBe(0);
    expect(before.commits).toEqual([]);
    expect(after.commits).toEqual([]);
  });

  it('finalizes only a migrated dataset, previewing first on request', async () => {
    const unmigrated = fakeConnection(headState());
    expect((await run(['--finalize'], unmigrated.connection)).code).toBe(1);
    expect(unmigrated.commits).toEqual([]);

    const fake = fakeConnection(migratedState());
    const preview = await run(['--finalize', '--dry-run'], fake.connection);
    expect(preview.code).toBe(0);
    expect(fake.commits).toEqual([]);
    expect(preview.lines).toContain('  patches: 79');

    const done = await run(['--finalize'], fake.connection);
    expect(done.code).toBe(0);
    expect(fake.commits).toHaveLength(1);
    expect(done.lines).toContain(
      'Verify (finalized): 69 books, 10 shelves; completed 3, queued 66',
    );
    expect((await run(['--finalize'], fake.connection)).lines).toContain(
      'Nothing to finalize: no legacy field is left.',
    );
  });

  it('prints every Studio value it keeps', () => {
    const state = withDoc(headState(), 'book-computer-systems', (doc) => ({
      ...doc,
      summary: 'Edited in Studio.',
    }));
    const lines = describePlan(planBookshelfMigration(state, catalog, 'migrate'), []);
    expect(lines).toContain('Studio values kept (they differ from the catalog): 1');
    expect(
      lines.find((line) => line.startsWith('  book computer-systems summary: Studio "Edited')),
    ).toBeDefined();
  });
});
