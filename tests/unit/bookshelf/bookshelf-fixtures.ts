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
 * @file What the bookshelf component tests share: a three-shelf fixture catalog built the way the
 * pages build theirs (Sanity-shaped documents from tests/fixtures/sanity-docs.ts joined by the
 * real buildBookshelfCatalog), the book the detail tests open, the stage's live readout and its
 * 'Shelves' chips, a render inside the nuqs testing adapter, and the island a server page
 * returns. Not a test file.
 *
 * It calls no vi.mock. Each test file mocks '@/lib/sanity/client' (the catalog draws its covers
 * with the real image URL builder) before this module builds the catalog on import.
 */

import { render, screen, within } from '@testing-library/react';
import { makeBook, makeBookshelf } from '@tests/fixtures/sanity-docs';
import { type OnUrlUpdateFunction, withNuqsTestingAdapter } from 'nuqs/adapters/testing';
import { isValidElement, type ReactElement, type ReactNode } from 'react';

import {
  neighborsOf,
  toBookNeighbor,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/book-neighbors';
import type { BookItem } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/books';
import {
  buildBookshelfCatalog,
  hasBooks,
  type NonEmptyBooks,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/load-bookshelf';
import { toReadingMapEntry } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/reading-map';
import type { SanityBookshelf } from '@/hooks/sanity/schemas';

/** Renders `ui` in the nuqs testing adapter on `searchParams`, reporting each URL write. */
export const renderWithNuqs = (
  ui: ReactElement,
  searchParams?: string,
  onUrlUpdate?: OnUrlUpdateFunction,
) =>
  render(ui, {
    wrapper: withNuqsTestingAdapter({ searchParams, onUrlUpdate, hasMemory: true }),
  });

/**
 * Books per fixture shelf. Three shelves of six make 18 books: more than the stage's window of
 * book slots, so the unfiltered stage is the circular one and no book is drawn twice.
 */
export const BOOKS_PER_SHELF = 6;

const shelfDoc = (title: string, slug: string): SanityBookshelf =>
  makeBookshelf({ title, slug: { _type: 'slug', current: slug } });

export const BACKEND_SHELF = shelfDoc('Backend', 'backend');
export const AI_SHELF = shelfDoc('AI', 'ai');
export const HUMANITIES_SHELF = shelfDoc('Humanities', 'humanities');

/** The book the detail tests open: second on the AI shelf, with an ISBN and four topics. */
export const FEATURED_TITLE = 'Agents in Practice';
export const FEATURED_TOPIC = 'Agents: tools & planning';
export const FEATURED_ISBN = '9780306406157';
export const FEATURED_DOC = makeBook({
  shelfId: AI_SHELF._id,
  title: FEATURED_TITLE,
  isbn: FEATURED_ISBN,
  topics: ['Prompting', FEATURED_TOPIC, 'Evaluation', 'Serving'],
});

/** `count` books on `shelf`, titled by shelf and position ("AI Book 3"). */
const shelfBooks = (shelf: SanityBookshelf, count = BOOKS_PER_SHELF) =>
  Array.from({ length: count }, (_, index) =>
    makeBook({ shelfId: shelf._id, title: `${shelf.title} Book ${index + 1}` }),
  );

const [FIRST_AI_DOC, ...OTHER_AI_DOCS] = shelfBooks(AI_SHELF, BOOKS_PER_SHELF - 1);

export const BOOK_DOCS = [
  ...shelfBooks(BACKEND_SHELF),
  ...(FIRST_AI_DOC ? [FIRST_AI_DOC] : []),
  FEATURED_DOC,
  ...OTHER_AI_DOCS,
  ...shelfBooks(HUMANITIES_SHELF),
];
export const SHELF_DOCS = [BACKEND_SHELF, AI_SHELF, HUMANITIES_SHELF];

export const CATALOG = buildBookshelfCatalog(BOOK_DOCS, SHELF_DOCS);

/** `books` as the islands take them: a list with at least one book. */
export const nonEmpty = (books: readonly BookItem[]): NonEmptyBooks => {
  if (!hasBooks(books)) throw new Error('expected at least one fixture book');
  return books;
};

export const BOOKS = nonEmpty(CATALOG.books);
export const SHELVES = CATALOG.shelves;
export const BOOK_COUNT = BOOKS.length;

/** The book at `index`, wrapping around the circular shelf as the stage does. */
export const bookAt = (index: number): BookItem =>
  BOOKS[((index % BOOK_COUNT) + BOOK_COUNT) % BOOK_COUNT] ?? BOOKS[0];

/** The stage's live readout for `book` among `count` books, e.g. "07 of 18: Agents in Practice". */
export const liveTextOf = (book: BookItem, count: number = BOOK_COUNT): string =>
  `${book.stageLabel} of ${count}: ${book.title}`;

/** The stage's live readout now, e.g. "07 of 18: Agents in Practice". */
export const liveText = (): string =>
  document.querySelector('[aria-live="polite"]')?.textContent ?? '';

/** A topic number as the detail view prints it, three digits wide. */
export const topicLabel = (number: number | undefined): string => String(number).padStart(3, '0');

const bookWithSlug = (slug: string): BookItem => {
  const book = BOOKS.find((item) => item.slug === slug);
  if (!book) throw new Error(`no fixture book ${slug}`);
  return book;
};

export const FEATURED = bookWithSlug(FEATURED_DOC.slug.current);

/** `book`'s props on its own page, built as /bookshelf/[slug] builds them. */
export const standaloneProps = (book: BookItem) => {
  const { prev, next } = neighborsOf(BOOKS, BOOKS.indexOf(book));
  return {
    book,
    prev: toBookNeighbor(prev),
    next: toBookNeighbor(next),
    mapBooks: BOOKS.map(toReadingMapEntry),
    shelves: SHELVES,
  };
};

/** A shelf's books on the stage, in stage order. */
export const booksOn = (slug: string): NonEmptyBooks =>
  nonEmpty(BOOKS.filter((book) => book.shelfSlug === slug));

/** A catalog of `[title, slug, books]` shelves, in order; each book is titled "<slug> book <n>". */
export function catalogOf(
  specs: readonly (readonly [title: string, slug: string, books: number])[],
) {
  const shelves = specs.map(([title, slug, count]) => ({
    doc: shelfDoc(title, slug),
    slug,
    count,
  }));
  const catalog = buildBookshelfCatalog(
    shelves.flatMap(({ doc, slug, count }) =>
      Array.from({ length: count }, (_, index) =>
        makeBook({ shelfId: doc._id, title: `${slug} book ${index + 1}` }),
      ),
    ),
    shelves.map(({ doc }) => doc),
  );
  return { books: nonEmpty(catalog.books), shelves: catalog.shelves };
}

/** The width a Sanity image URL asks the CDN for (its `w`). */
export const widthOf = (src: string | null | undefined): number =>
  Number(new URL(src ?? '').searchParams.get('w'));

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The 'Shelves' chip group. */
export const shelvesGroup = () => screen.getByRole('group', { name: 'Shelves' });

/** Every chip titled `title` (whatever count it shows), in order: "All" is the reset chip. */
export const shelfChips = (title: string) =>
  within(shelvesGroup()).getAllByRole('button', {
    name: new RegExp(`^${escapeRegExp(title)}\\s*\\d`),
  });

/** The one chip titled `title`, whatever count it shows. */
export const shelfChip = (title: string) => {
  const [chip, ...others] = shelfChips(title);
  if (!chip || others.length > 0) throw new Error(`expected one shelf chip titled ${title}`);
  return chip;
};

/** The chips that are pressed now: always exactly one. */
export const pressedChips = () => within(shelvesGroup()).getAllByRole('button', { pressed: true });

/** The first element of component `type` in a server page's returned tree, depth first. */
function findElement<P>(node: ReactNode, type: (props: P) => ReactNode): ReactElement<P> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findElement(child as ReactNode, type);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  if (node.type === type) return node as ReactElement<P>;
  return findElement((node.props as { readonly children?: ReactNode }).children, type);
}

/** The element of component `type` in a server page's tree; throws, naming `name`, when none. */
export function elementOf<P>(node: ReactNode, type: (props: P) => ReactNode, name: string) {
  const element = findElement(node, type);
  if (!element) throw new Error(`the page renders no ${name}`);
  return element;
}
