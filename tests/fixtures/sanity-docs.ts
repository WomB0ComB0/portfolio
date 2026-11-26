/**
 * Copyright 2025 Mike Odnis
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
 * @file Sanity document factories for tests. Each returns a document that decodes with its schema
 * in '@/hooks/sanity/schemas', so it works both as what Sanity answers (mock the client with it)
 * and as what a loader returns (mock '@/lib/sanity/loaders' with it). Every document gets a unique
 * `_id` and its own ISO timestamps; pass overrides for the fields a test is about.
 */

import type {
  Article,
  Certification,
  Experience,
  Place,
  Presentation,
  Project,
  Resume,
  SanityBook,
  SanityBookshelf,
  Talk,
} from '@/hooks/sanity/schemas';
import type { ListedVideo } from '@/lib/sanity/loaders';

/** The first document's timestamp; each later document is one minute newer. */
const FIXTURE_EPOCH_MS = Date.UTC(2026, 0, 1);
const MINUTE_MS = 60_000;

/** Counts documents across the test run, so ids never repeat. */
let documentCount = 0;

interface DocumentMeta {
  readonly _id: string;
  readonly _createdAt: string;
  readonly _updatedAt: string;
  readonly _rev: string;
}

/** The next document's number and system fields, e.g. `{ _id: 'project-3', ... }`. */
function nextDocument(prefix: string): { readonly n: number; readonly meta: DocumentMeta } {
  documentCount += 1;
  const n = documentCount;
  const at = new Date(FIXTURE_EPOCH_MS + n * MINUTE_MS).toISOString();
  return { n, meta: { _id: `${prefix}-${n}`, _createdAt: at, _updatedAt: at, _rev: `rev-${n}` } };
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  const { n, meta } = nextDocument('project');
  return {
    ...meta,
    _type: 'project',
    title: `Project ${n}`,
    slug: { _type: 'slug', current: `project-${n}` },
    description: `What project ${n} does.`,
    category: 'Web Development',
    technologies: ['TypeScript', 'React'],
    status: 'Completed',
    featured: false,
    order: n,
    ...overrides,
  };
}

export function makeExperience(overrides: Partial<Experience> = {}): Experience {
  const { n, meta } = nextDocument('experience');
  return {
    ...meta,
    _type: 'experience',
    position: `Software Engineer ${n}`,
    company: `Company ${n}`,
    description: `What the role at company ${n} involved.`,
    technologies: ['TypeScript'],
    startDate: '2024-01-01',
    endDate: '2025-01-01',
    current: false,
    order: n,
    ...overrides,
  };
}

export function makeCertification(overrides: Partial<Certification> = {}): Certification {
  const { n, meta } = nextDocument('certification');
  return {
    ...meta,
    _type: 'certification',
    title: `Certification ${n}`,
    issuer: `Issuer ${n}`,
    issueDate: '2025-01-15',
    order: n,
    featured: false,
    ...overrides,
  };
}

export function makePlace(overrides: Partial<Place> = {}): Place {
  const { n, meta } = nextDocument('place');
  return {
    ...meta,
    _type: 'place',
    name: `Place ${n}`,
    description: `What happened at place ${n}.`,
    category: 'Conference',
    latitude: 40.7128,
    longitude: -74.006,
    startDate: '2026-05-19',
    order: n,
    featured: false,
    ...overrides,
  };
}

export function makeResume(overrides: Partial<Resume> = {}): Resume {
  const { n, meta } = nextDocument('resume');
  return {
    ...meta,
    _type: 'resume',
    title: `Resume ${n}`,
    pdfFile: { _type: 'file', asset: { _ref: `file-resume${n}-pdf`, _type: 'reference' } },
    lastUpdated: '2026-10-01',
    isActive: true,
    ...overrides,
  };
}

export function makePresentation(overrides: Partial<Presentation> = {}): Presentation {
  const { n, meta } = nextDocument('presentation');
  return {
    ...meta,
    _type: 'presentation',
    title: `Presentation ${n}`,
    description: `What presentation ${n} covers.`,
    eventName: `Event ${n}`,
    date: '2025-03-01',
    order: n,
    ...overrides,
  };
}

export function makeTalk(overrides: Partial<Talk> = {}): Talk {
  const { n, meta } = nextDocument('talk');
  return {
    ...meta,
    _type: 'talk',
    title: `Talk ${n}`,
    description: `What talk ${n} covers.`,
    venue: `Venue ${n}`,
    date: '2025-04-01',
    order: n,
    ...overrides,
  };
}

export function makeArticle(overrides: Partial<Article> = {}): Article {
  const { n, meta } = nextDocument('article');
  return {
    ...meta,
    _type: 'article',
    title: `Article ${n}`,
    excerpt: `What article ${n} is about.`,
    publication: `Publication ${n}`,
    publicationUrl: `https://example.com/articles/${n}`,
    publishedDate: '2025-06-01',
    order: n,
    ...overrides,
  };
}

/** A slug field holding `current`, as Studio stores a book's or a shelf's slug. */
export const slugOf = (current: string) => ({ _type: 'slug' as const, current });

/** The shelf a book names when a test gives it none: pass `shelfId: shelf._id` to join a shelf. */
const DEFAULT_BOOK_SHELF_ID = 'bookshelf-test';

/**
 * A book as the books query answers it: queued, with two topics, a 520x680 cover asset and
 * `shelfId` naming its shelf. Its order is n*10, the gap the migration leaves between stages.
 */
export function makeBook(overrides: Partial<SanityBook> = {}): SanityBook {
  const { n, meta } = nextDocument('book');
  return {
    ...meta,
    _type: 'book',
    title: `Book ${n}`,
    slug: { _type: 'slug', current: `book-${n}` },
    authors: `Author ${n}`,
    status: 'queued',
    summary: `What book ${n} teaches.`,
    coverImage: {
      _type: 'image',
      asset: { _type: 'reference', _ref: 'image-abc123-520x680-webp' },
    },
    shelfId: DEFAULT_BOOK_SHELF_ID,
    topics: [`Book ${n} topic one`, `Book ${n} topic two`],
    order: n * 10,
    ...overrides,
  };
}

/** A bookshelf section as the bookshelves query answers it (flat: its books name it). */
export function makeBookshelf(overrides: Partial<SanityBookshelf> = {}): SanityBookshelf {
  const { n, meta } = nextDocument('bookshelf');
  return {
    ...meta,
    _type: 'bookshelf',
    title: `Shelf ${n}`,
    slug: { _type: 'slug', current: `shelf-${n}` },
    order: n * 10,
    ...overrides,
  };
}

/** A bookshelf catalog as the one bookshelf query answers it: books by order, shelves by order. */
export interface ScaledBookshelfDocs {
  readonly books: readonly SanityBook[];
  readonly shelves: readonly SanityBookshelf[];
}

/**
 * The production bookshelf's shelf sizes, in shelf order (69 books on 10 shelves, 2026-11-26).
 * makeScaledBookshelfDocs spreads any number of books over its shelves in these proportions.
 */
const PRODUCTION_SHELF_SIZES: readonly number[] = [7, 6, 6, 4, 4, 12, 6, 9, 6, 9];

/** The production shelf count, the scaled catalog's default. */
const PRODUCTION_SHELF_COUNT = PRODUCTION_SHELF_SIZES.length;
/** Every scaled book's topic count, near production's mean of 5.9. */
const SCALED_TOPICS_PER_BOOK = 6;
/** Every this many books, one has been read; the rest are queued, as on the production shelf. */
const SCALED_COMPLETED_EVERY = 23;

/**
 * `total` split over `weights` in proportion (largest remainder), so the parts always add up to
 * `total` and weights that already add up to it come back unchanged. While `total` allows it, a
 * part rounded down to 0 takes one from the largest part: a shelf with no books is left off.
 */
function apportion(total: number, weights: readonly number[]): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const exact = weights.map((weight) => (total * weight) / weightSum);
  const parts = exact.map((share) => Math.floor(share));
  const byRemainder = exact
    .map((share, index) => ({ index, remainder: share - Math.floor(share) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  let left = total - parts.reduce((sum, part) => sum + part, 0);
  for (const { index } of byRemainder) {
    if (left === 0) break;
    parts[index] = (parts[index] ?? 0) + 1;
    left -= 1;
  }
  for (const [index, part] of parts.entries()) {
    const largest = parts.indexOf(Math.max(...parts));
    if (part > 0 || (parts[largest] ?? 0) < 2) continue;
    parts[largest] = (parts[largest] ?? 0) - 1;
    parts[index] = 1;
  }
  return parts;
}

/** A 40-digit hex id, fixed for `seed`, the length of a Sanity image asset's hash. */
const assetHash = (seed: number): string =>
  Array.from({ length: 5 }, (_, part) =>
    (Math.imul(seed + 1, 2_654_435_761 + part * 40_503) >>> 0).toString(16).padStart(8, '0'),
  ).join('');

/** ISO system timestamps for the scaled document `n`, one minute apart from the epoch. */
const scaledMeta = (prefix: string, n: number) => {
  const at = new Date(FIXTURE_EPOCH_MS + n * MINUTE_MS).toISOString();
  return { _id: `${prefix}-${n}`, _createdAt: at, _updatedAt: at, _rev: `rev-scaled-${n}` };
};

/**
 * A catalog of `bookCount` books on `shelfCount` shelves, built with makeBook and makeBookshelf
 * and shaped like production, for budget tests at 69, 300 and 1000 books:
 * - the books are spread over the shelves in production's proportions (PRODUCTION_SHELF_SIZES,
 *   repeated past 10 shelves): 69 books on 10 shelves are exactly production's 7-12 a shelf;
 * - each book has a unique `_id` and slug and a global order in steps of 10 that follows stage
 *   order (shelf by shelf), as the migration left production's (10..690);
 * - its text has production's lengths: a 48-character title, a 165-character summary, six
 *   topics of about 45 characters, an alt text, an ISBN, a publisher and edition, and one url;
 * - one book in SCALED_COMPLETED_EVERY has been read and the one halfway along the stage is
 *   being read; the rest are queued.
 * So JSON.stringify(buildBookshelfCatalog(...).books) is 1,400-1,600 B per book, as production's
 * list payload is (1,409-1,530 B). The same arguments always give the same documents.
 */
export function makeScaledBookshelfDocs(
  bookCount: number,
  shelfCount = PRODUCTION_SHELF_COUNT,
): ScaledBookshelfDocs {
  const weights = Array.from(
    { length: shelfCount },
    (_, index) => PRODUCTION_SHELF_SIZES[index % PRODUCTION_SHELF_COUNT] ?? 1,
  );
  const shelves = weights.map((_, index) => {
    const n = index + 1;
    const label = String(n).padStart(2, '0');
    return makeBookshelf({
      ...scaledMeta('bookshelf-scaled', n),
      title: `Scaled Shelf ${label}`,
      slug: { _type: 'slug', current: `scaled-shelf-${label}` },
      description: `Shelf ${label} of the scaled catalog: books shelved the way production shelves them.`,
      order: n * 10,
    });
  });
  const sizes = apportion(bookCount, weights);
  const shelfIds = shelves.flatMap((shelf, index) =>
    Array.from({ length: sizes[index] ?? 0 }, () => shelf._id),
  );
  const books = shelfIds.map((shelfId, index) => {
    const n = index + 1;
    const label = String(n).padStart(4, '0');
    const title = `Scaled Book ${label}: Systems, Practice and Design`;
    const authors = `Author ${label} & Co-Author`;
    const slug = `scaled-book-${label}-systems`;
    const status =
      index === Math.floor(bookCount / 2)
        ? 'reading'
        : index % SCALED_COMPLETED_EVERY === SCALED_COMPLETED_EVERY - 1
          ? 'completed'
          : 'queued';
    return makeBook({
      ...scaledMeta('book-scaled', n),
      title,
      slug: { _type: 'slug', current: slug },
      spineTitle: `Scaled Book ${label}`,
      authors,
      spineAuthor: 'AUTHOR',
      publisher: 'Scaled Press',
      edition: '2nd Edition',
      year: 2000 + (n % 26),
      isbn: `978-0-00-${String(n).padStart(6, '0')}-0`,
      status,
      summary:
        `Book ${label} of the scaled catalog walks through the fundamentals of its subject, ` +
        'from first principles to production practice, with worked examples and exercises.',
      coverImage: {
        _type: 'image',
        alt: `${title} by ${authors}`,
        asset: { _type: 'reference', _ref: `image-${assetHash(n)}-520x680-webp` },
      },
      shelfId,
      url: `https://books.example.com/catalog/${slug}`,
      topics: Array.from(
        { length: SCALED_TOPICS_PER_BOOK },
        (_, topic) => `Topic ${topic + 1} of book ${label}: concepts & practice`,
      ),
      order: n * 10,
    });
  });
  return { books, shelves };
}

/** A video as '/api/v1/sanity/videos' and loadVideos() list it: a Sanity video by default. */
export function makeVideo(overrides: Partial<ListedVideo> = {}): ListedVideo {
  const { n, meta } = nextDocument('video');
  return {
    ...meta,
    _type: 'youtubeVideo',
    title: `Video ${n}`,
    description: `What video ${n} shows.`,
    videoId: `video${String(n).padStart(6, '0')}`,
    publishedDate: meta._createdAt,
    order: n,
    source: 'sanity',
    ...overrides,
  };
}
