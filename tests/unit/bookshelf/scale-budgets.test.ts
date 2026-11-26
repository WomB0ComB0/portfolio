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
 * @file The bookshelf's deterministic scaling budgets at 69 (production), 300 and 1000 books on
 * 10 shelves, without Sanity or a browser. Each catalog is makeScaledBookshelfDocs' (production's
 * shelf proportions and per-book JSON size) joined by the real buildBookshelfCatalog; the pages
 * read it through the real loaders, with only the Sanity client answering it.
 * - Payload: the list page ships at most 1,600 B of JSON per book to the stage (a regression
 *   guard: production is 1,409-1,530 B); a book's page ships at most 25 / 90 / 260 KB of props;
 *   a shelf's page ships its own shelf only, at most 1.7 KB per book on it + 1 KB.
 * - Stage DOM: at most 2 x halfWindow + 1 book slots (17 in jsdom, which has no layout) and at
 *   most 700 elements in the shelf shell, at any N.
 * - Jumps: a shelf chip, Home, End, a reading-status chip and the reading map's 'Focus on shelf'
 *   move the stage in ONE change of the live region and at most 2 React commits, settled 250 ms
 *   after the click with no timer left; with reduced motion, at once. A move of 1-2 books is one
 *   400 ms step. An arrow key is still 1 step of 400 ms that recycles 1 slot. A long jump fades
 *   the shelf in for 220 ms on opacity and transform alone (none under reduced motion), and a
 *   pointerdown during the fade finishes it.
 * None is skipped. Byte, CLS and layout budgets that need a real browser are in
 * e2e/performance/bookshelf-budgets.spec.ts.
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { makeScaledBookshelfDocs } from '@tests/fixtures/sanity-docs';
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing';
import { createElement, isValidElement, Profiler, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sanity = vi.hoisted(() => ({ sanityFetchWithToken: vi.fn() }));

// The stage's CSS module: each class name is the name itself, so `.shelf-shell` can be found.
vi.mock('@/app/(routes)/(main)/(personal)/bookshelf/_components/bookshelf.module.css', () => ({
  default: new Proxy({} as Record<string, string>, {
    get: (_target, name) => (typeof name === 'string' ? name : undefined),
  }),
}));
// The catalog draws each cover with the real image URL builder; Sanity answers the fixture.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return {
    sanityFetchWithToken: sanity.sanityFetchWithToken,
    urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source),
  };
});
vi.mock('@/lib/api-integrations/youtube', () => ({
  fetchChannelVideos: vi.fn(),
  fetchYouTubeVideoMetadataBatch: vi.fn(),
}));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }));
// t3-env validates every production variable on import.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});

import { BookDetailView } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/book-detail-view';
import { BookshelfStage } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/bookshelf-stage';
import {
  BOOK_STATUS_META,
  type BookItem,
  DEFAULT_BOOK_INDEX,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/books';
import {
  buildBookshelfCatalog,
  hasBooks,
  type NonEmptyBooks,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/load-bookshelf';
import BookshelfPage from '@/app/(routes)/(main)/(personal)/bookshelf/(list)/page';
import BookDetailPage from '@/app/(routes)/(main)/(personal)/bookshelf/[slug]/page';
import ShelfDetailPage from '@/app/(routes)/(main)/(personal)/bookshelf/shelf/[shelfSlug]/page';
import { resetSanityLoaderCaches } from '@/lib/sanity/loaders';

/** The catalog sizes every budget holds at: production's, and two growth points. */
const BOOK_COUNTS = [69, 300, 1000] as const;
type BookCount = (typeof BOOK_COUNTS)[number];

/** Budgets count JSON characters (the fixture is ASCII, so bytes) in decimal kilobytes. */
const KB = 1000;
/** The fixture's per-book list JSON, as production's flight row measures (1,409-1,530 B). */
const FIXTURE_BYTES_PER_BOOK = { min: 1400, max: 1600 } as const;
/** The list page's stage props per book: a regression guard, not a cap on the total. */
const LIST_BYTES_PER_BOOK = 1600;
/**
 * A book page's props. They were 109 / 471 / 1,564 KB with the whole catalog in them; with slim
 * reading-map entries and link-only neighbours they measure 19 / 71 / 230 KB.
 */
const DETAIL_PROPS_BUDGET: Readonly<Record<BookCount, number>> = {
  69: 25 * KB,
  300: 90 * KB,
  1000: 260 * KB,
};
/** A shelf page's props: its own books, and only its own shelf. */
const SHELF_BYTES_PER_BOOK = 1.7 * KB;
const SHELF_BYTES_BASE = 1 * KB;
/**
 * The stage's book slots in jsdom: with no layout, measureStage reads a 1024 x 390 stage, so a
 * 328 px book and halfWindow 8, a pool of 2 x 8 + 1.
 */
const JSDOM_POOL_SIZE = 17;
/** The shelf shell's elements with 10 shelves (651-660 before the scaling work, at every N). */
const SHELL_ELEMENT_BUDGET = 700;
/** A jump settles within this long after the click. */
const SETTLE_MS = 250;
/** Fake time runs in slices this long, well under any timer the stage sets (55 ms and up). */
const TICK_MS = 5;
/** A jump's React commits: the move (with its URL state), and at most one follow-up. */
const MAX_JUMP_COMMITS = 2;
/** One step's transition, and a move of 1-2 books, which slides as one step. */
const STEP_MS = 400;
/** A long jump's fade-in of the shelf. */
const JUMP_IN_MS = 220;
/** The only properties the fade-in may animate: the compositor's. */
const COMPOSITOR_PROPERTIES: readonly string[] = ['opacity', 'transform'];
const REDUCED_MOTION_QUERY = 'prefers-reduced-motion: reduce';

const wrapper = withNuqsTestingAdapter();

const jsonLength = (value: unknown): number => JSON.stringify(value).length;
const mod = (a: number, n: number): number => ((a % n) + n) % n;
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `books` as the islands take them: a list with at least one book. */
function nonEmpty(books: readonly BookItem[]): NonEmptyBooks {
  if (!hasBooks(books)) throw new Error('expected at least one fixture book');
  return books;
}

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

function elementOf<P>(node: ReactNode, type: (props: P) => ReactNode, name: string) {
  const element = findElement(node, type);
  if (!element) throw new Error(`the page renders no ${name}`);
  return element;
}

/** matchMedia that answers only the reduced-motion query. */
const reducedMotionMatchMedia = (query: string): MediaQueryList =>
  ({
    matches: query.includes(REDUCED_MOTION_QUERY),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList;

/** The stage's live readout, e.g. "07 of 69: <title>". */
const liveText = (): string => document.querySelector('[aria-live="polite"]')?.textContent ?? '';
const liveTextOf = (book: BookItem, count: number): string =>
  `${book.stageLabel} of ${count}: ${book.title}`;

/** The stage's step duration, from the inline `--shelf-dur` the shell carries. */
const shelfDuration = (container: HTMLElement): string =>
  container
    .querySelector<HTMLElement>('[style*="--shelf-dur"]')
    ?.style.getPropertyValue('--shelf-dur') ?? '';

/** Each book slot's book (its cover's alt text), by pool index. */
const slotBooks = (container: HTMLElement): ReadonlyMap<string, string> =>
  new Map(
    [...container.querySelectorAll<HTMLElement>('[data-pool-index]')].map((slot) => [
      slot.dataset.poolIndex ?? '',
      slot.querySelector('img')?.getAttribute('alt') ?? '',
    ]),
  );

/** A shelf chip by its shelf title, whatever count it shows: a button in the 'Shelves' group. */
function shelfChip(title: string): HTMLElement {
  return within(screen.getByRole('group', { name: 'Shelves' })).getByRole('button', {
    name: new RegExp(`^${escapeRegExp(title)}\\s*\\d`),
  });
}

/**
 * Element.prototype.animate (jsdom has none) as a spy that answers a fake Animation, so a test
 * can read the fade-in's keyframes and see it finished or cancelled. Removed after each test.
 */
function mockAnimate() {
  const animation = { cancel: vi.fn(), finish: vi.fn() };
  const animate = vi.fn<(keyframes: Keyframe[], options: KeyframeAnimationOptions) => Animation>(
    () => animation as unknown as Animation,
  );
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate });
  return { animate, animation };
}

interface StageProbe {
  readonly container: HTMLElement;
  /** Live-region changes and React commits since the last `reset`. */
  readonly counts: () => { readonly liveChanges: number; readonly commits: number };
  /** Starts counting from now. */
  readonly reset: () => void;
}

/**
 * Renders the stage on the book at `startIndex` under a Profiler that, on every commit, counts
 * a change of the live region (each is one announcement and one stage position), then runs the
 * mount's own timers. Fake timers must be on.
 */
async function renderStage(
  books: NonEmptyBooks,
  shelves: ReturnType<typeof buildBookshelfCatalog>['shelves'],
  startIndex: number,
): Promise<StageProbe> {
  let commits = 0;
  let liveChanges = 0;
  let lastLive = '';
  const onRender = (): void => {
    commits += 1;
    const now = liveText();
    if (now !== lastLive) {
      liveChanges += 1;
      lastLive = now;
    }
  };
  const { container } = render(
    createElement(
      Profiler,
      { id: 'bookshelf-stage', onRender },
      createElement(BookshelfStage, { books, shelves, initialSlug: books[startIndex]?.slug }),
    ),
    { wrapper },
  );
  await act(async () => {
    vi.runOnlyPendingTimers();
  });
  const reset = (): void => {
    commits = 0;
    liveChanges = 0;
    lastLive = liveText();
  };
  reset();
  return { container, counts: () => ({ liveChanges, commits }), reset };
}

/**
 * Runs `ms` of fake time in slices of TICK_MS, each in its own act(): React batches every update
 * inside one act() into one commit, so a single advance would fold a chain of timed steps into
 * one and hide the moves it makes. A browser commits each timer's update on its own.
 */
async function runFor(ms: number): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) {
    await act(async () => {
      vi.advanceTimersByTime(TICK_MS);
    });
  }
}

/** Clicks or presses something, then lets the stage run for `ms` of fake time. */
async function actThenWait(action: () => void, ms = SETTLE_MS): Promise<void> {
  await act(async () => {
    action();
  });
  await runFor(ms);
}

/** The carousel region, focused, as keyboard navigation expects. */
function focusedStage(): HTMLElement {
  const stage = screen.getByRole('region', { name: /Bookshelf/i });
  stage.focus();
  return stage;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, 'animate');
});

describe.each(BOOK_COUNTS)('the bookshelf at %i books on 10 shelves', (count) => {
  const docs = makeScaledBookshelfDocs(count);
  const catalog = buildBookshelfCatalog(docs.books, docs.shelves);
  const books = nonEmpty(catalog.books);
  const { shelves } = catalog;
  const middle = Math.floor(count / 2);
  const bookAt = (index: number): BookItem => books[mod(index, count)] ?? books[0];

  /** The shelf whose first book is farthest round the circular stage from `start`. */
  const farthestShelfFrom = (start: number) =>
    shelves
      .map((shelf) => {
        const target = books.findIndex((book) => book.shelfSlug === shelf.slug);
        const forward = mod(target - start, count);
        return { title: shelf.title, target, distance: Math.min(forward, count - forward) };
      })
      .reduce((best, next) => (next.distance > best.distance ? next : best));

  beforeEach(() => {
    resetSanityLoaderCaches();
    sanity.sanityFetchWithToken.mockReset().mockResolvedValue(docs);
  });

  describe('payload', () => {
    it('uses a fixture calibrated to production (1,400-1,600 B of list JSON per book)', () => {
      expect(books).toHaveLength(count);
      expect(shelves).toHaveLength(10);
      const perBook = jsonLength(books) / count;
      expect(perBook).toBeGreaterThanOrEqual(FIXTURE_BYTES_PER_BOOK.min);
      expect(perBook).toBeLessThanOrEqual(FIXTURE_BYTES_PER_BOOK.max);
    });

    it(`ships at most ${LIST_BYTES_PER_BOOK} B of stage props per book on /bookshelf`, async () => {
      const page = await BookshelfPage({});
      const stage = elementOf(page, BookshelfStage, 'BookshelfStage');

      expect(stage.props.books).toHaveLength(count);
      expect(jsonLength(stage.props) / count).toBeLessThanOrEqual(LIST_BYTES_PER_BOOK);
    });

    it(`ships at most ${DETAIL_PROPS_BUDGET[count] / KB} KB of props on a book's page`, async () => {
      const page = await BookDetailPage({ params: Promise.resolve({ slug: books[0].slug }) });
      const view = elementOf(page, BookDetailView, 'BookDetailView');

      expect(jsonLength(view.props)).toBeLessThanOrEqual(DETAIL_PROPS_BUDGET[count]);
    });

    it("keeps the first book's Previous link wrapping round to the last book", async () => {
      const last = bookAt(-1);
      const page = await BookDetailPage({ params: Promise.resolve({ slug: books[0].slug }) });
      render(elementOf(page, BookDetailView, 'BookDetailView'), { wrapper });

      const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
      expect(hrefs).toContain(`/bookshelf/${encodeURIComponent(last.slug)}`);
    });

    it("ships only its own shelf, at most 1.7 KB per book + 1 KB, on a shelf's page", async () => {
      const largest = shelves.reduce((best, shelf) =>
        shelf.bookSlugs.length > best.bookSlugs.length ? shelf : best,
      );
      const page = await ShelfDetailPage({
        params: Promise.resolve({ shelfSlug: largest.slug }),
      });
      const stage = elementOf(page, BookshelfStage, 'BookshelfStage');
      const shelfBooks = stage.props.books.length;

      expect(shelfBooks).toBe(largest.bookSlugs.length);
      expect
        .soft(jsonLength(stage.props))
        .toBeLessThanOrEqual(SHELF_BYTES_PER_BOOK * shelfBooks + SHELF_BYTES_BASE);
      expect(stage.props.shelves).toHaveLength(1);
    });
  });

  describe('stage DOM', () => {
    it(`renders at most ${JSDOM_POOL_SIZE} book slots and ${SHELL_ELEMENT_BUDGET} shell elements`, async () => {
      vi.useFakeTimers();
      const { container } = await renderStage(books, shelves, DEFAULT_BOOK_INDEX);

      expect(container.querySelectorAll('[data-pool-index]').length).toBeLessThanOrEqual(
        JSDOM_POOL_SIZE,
      );
      const shell = container.querySelector('.shelf-shell');
      expect(shell).not.toBeNull();
      expect(shell?.querySelectorAll('*').length).toBeLessThanOrEqual(SHELL_ELEMENT_BUDGET);
    });
  });

  describe('jumps', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    /** One move: one announcement, at most 2 commits, the target on stage, no timer left. */
    const expectOneMove = (probe: StageProbe, target: BookItem): void => {
      const { liveChanges, commits } = probe.counts();
      expect.soft(liveChanges, 'live-region changes').toBe(1);
      expect.soft(commits, 'React commits').toBeLessThanOrEqual(MAX_JUMP_COMMITS);
      expect.soft(liveText(), 'the book on stage').toBe(liveTextOf(target, count));
      expect(vi.getTimerCount(), 'timers left after the jump').toBe(0);
    };

    it('moves to the farthest shelf in one move when its chip is clicked', async () => {
      const farthest = farthestShelfFrom(DEFAULT_BOOK_INDEX);
      expect(farthest.distance).toBeGreaterThan(2);
      const probe = await renderStage(books, shelves, DEFAULT_BOOK_INDEX);

      await actThenWait(() => fireEvent.click(shelfChip(farthest.title)));

      expectOneMove(probe, bookAt(farthest.target));
    });

    it.each([
      ['Home', 0],
      ['End', count - 1],
    ] as const)('moves from the middle of the stage with %s in one move', async (key, target) => {
      const probe = await renderStage(books, shelves, middle);
      const stage = focusedStage();
      probe.reset();

      await actThenWait(() => fireEvent.keyDown(stage, { key }));

      expectOneMove(probe, bookAt(target));
    });

    it("moves to the first book being read in one move when the 'Reading' chip is clicked", async () => {
      const target = books.findIndex((book) => book.status === 'reading');
      expect(target).toBe(middle);
      const probe = await renderStage(books, shelves, DEFAULT_BOOK_INDEX);
      const status = screen.getByRole('group', { name: 'Reading status' });
      const reading = new RegExp(`^${BOOK_STATUS_META.reading.label}\\s*\\d`);

      await actThenWait(() =>
        fireEvent.click(within(status).getByRole('button', { name: reading })),
      );

      expectOneMove(probe, bookAt(target));
    });

    it("moves to a book half the stage away in one move from the map's 'Focus on shelf'", async () => {
      const probe = await renderStage(books, shelves, DEFAULT_BOOK_INDEX);
      await actThenWait(() =>
        fireEvent.click(screen.getByRole('button', { name: /Reading map/i })),
      );
      const dialog = screen.getByRole('dialog', { name: /Reading map/i });
      const focus = within(dialog).getAllByRole('button', { name: 'Focus on shelf' })[middle];
      if (!focus) throw new Error(`no 'Focus on shelf' button for book ${middle}`);
      probe.reset();

      await actThenWait(() => fireEvent.click(focus));

      expectOneMove(probe, bookAt(middle));
    }, 30_000);

    it(`fades the shelf in for ${JUMP_IN_MS} ms on opacity and transform alone`, async () => {
      const { animate } = mockAnimate();
      const farthest = farthestShelfFrom(DEFAULT_BOOK_INDEX);
      const probe = await renderStage(books, shelves, DEFAULT_BOOK_INDEX);

      await actThenWait(() => fireEvent.click(shelfChip(farthest.title)));

      expect(animate).toHaveBeenCalledTimes(1);
      const [keyframes, options] = animate.mock.calls[0] ?? [[], {}];
      expect(animate.mock.contexts[0]).toBe(probe.container.querySelector('.shelf'));
      expect(options.duration).toBe(JUMP_IN_MS);
      const animated = new Set(keyframes.flatMap((frame) => Object.keys(frame)));
      expect([...animated].filter((key) => !COMPOSITOR_PROPERTIES.includes(key))).toEqual([]);
      expect(keyframes.map((frame) => frame.opacity)).toEqual([0, 1]);
    });

    it('finishes the fade when a pointer goes down on the stage, so a drag never fights it', async () => {
      const { animation } = mockAnimate();
      const farthest = farthestShelfFrom(DEFAULT_BOOK_INDEX);
      await renderStage(books, shelves, DEFAULT_BOOK_INDEX);
      await act(async () => {
        fireEvent.click(shelfChip(farthest.title));
      });
      expect(animation.finish).not.toHaveBeenCalled();

      const stage = screen.getByRole('region', { name: /Bookshelf/i });
      fireEvent.pointerDown(stage, { pointerId: 1, button: 0, clientX: 500, clientY: 200 });

      expect(animation.finish).toHaveBeenCalledTimes(1);
    });

    it('moves at once, with no transition, under reduced motion', async () => {
      vi.stubGlobal('matchMedia', reducedMotionMatchMedia);
      const { animate } = mockAnimate();
      const farthest = farthestShelfFrom(DEFAULT_BOOK_INDEX);
      const probe = await renderStage(books, shelves, DEFAULT_BOOK_INDEX);

      await act(async () => {
        fireEvent.click(shelfChip(farthest.title));
      });

      expect.soft(probe.counts().liveChanges, 'live-region changes at once').toBe(1);
      expect
        .soft(liveText(), 'the book on stage at once')
        .toBe(liveTextOf(bookAt(farthest.target), count));
      expect.soft(shelfDuration(probe.container)).toBe('0ms');
      expect.soft(animate, 'the fade-in').not.toHaveBeenCalled();
      await runFor(SETTLE_MS);
      expect.soft(probe.counts().liveChanges, 'live-region changes after settling').toBe(1);
      expect(vi.getTimerCount(), 'timers left after the jump').toBe(0);
    });

    it(`slides a move of 2 books as ONE ${STEP_MS} ms step`, async () => {
      const probe = await renderStage(books, shelves, 2);
      const stage = focusedStage();
      probe.reset();

      await actThenWait(() => fireEvent.keyDown(stage, { key: 'Home' }));

      expect.soft(shelfDuration(probe.container)).toBe(`${STEP_MS}ms`);
      expectOneMove(probe, bookAt(0));
    });

    it(`keeps an arrow key to 1 step of ${STEP_MS} ms that recycles 1 slot`, async () => {
      const probe = await renderStage(books, shelves, DEFAULT_BOOK_INDEX);
      const stage = focusedStage();
      const before = slotBooks(probe.container);
      probe.reset();

      await actThenWait(() => fireEvent.keyDown(stage, { key: 'ArrowRight' }));

      const after = slotBooks(probe.container);
      const recycled = [...after].filter(([pool, book]) => before.get(pool) !== book);
      expect(probe.counts().liveChanges).toBe(1);
      expect(liveText()).toBe(liveTextOf(bookAt(DEFAULT_BOOK_INDEX + 1), count));
      expect(shelfDuration(probe.container)).toBe(`${STEP_MS}ms`);
      expect(recycled).toHaveLength(1);
    });
  });
});
