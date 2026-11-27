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
 * @file A book's detail (book-detail-view.tsx) on the fixture catalog of bookshelf-fixtures.ts,
 * in place on the stage and on its own page. In place, it opens from the stage on Enter, steps
 * between books within /bookshelf (#/stage/NN) and returns to the stage. On its own page it shows
 * the title, the numbered topics and the facts and registry links Studio has values for, loads
 * the Sanity CDN cover first, sized to its frame (and above the text at 900 px and under), and
 * links the books before and after, wrapping round. The view takes its neighbours and slim
 * reading-map entries, never the whole catalog.
 */

import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

import { BookDetailView } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/book-detail-view';
import { BookshelfStage } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/bookshelf-stage';
import { toBookNeighbor } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/book-neighbors';
import {
  DEFAULT_BOOK_INDEX,
  getIsbnRegistryLinks,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/books';
import { toReadingMapEntry } from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/reading-map';
import { readCss, styleRules } from '../places/module-css';
import { declarations } from '../styles/css-rules';
import {
  BOOKS,
  bookAt,
  FEATURED,
  FEATURED_DOC,
  FEATURED_ISBN,
  FEATURED_TITLE,
  FEATURED_TOPIC,
  renderWithNuqs as render,
  SHELVES,
  standaloneProps,
  topicLabel,
} from './bookshelf-fixtures';

const COMPONENTS = 'src/app/(routes)/(main)/(personal)/bookshelf/_components';
const DETAIL_CSS = `${COMPONENTS}/book-detail-view.module.css`;
const COVER_FRAME_CSS = `${COMPONENTS}/book-cover-frame.module.css`;
/** Where the detail stacks its text and cover into one column. */
const NARROW_MEDIA = '@media (width <= 900px)';

// An in-page detail sets #/stage/NN; a stage mounted on that hash opens the detail at once.
afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
});

describe('BookDetailView in place', () => {
  it('renders the stage detail view in-page and returns cleanly to Bookshelf', () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} initialSlug={FEATURED.slug} />);

    const stage = screen.getByRole('region', { name: /Bookshelf/i });
    stage.focus();
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(screen.getByRole('heading', { level: 1, name: FEATURED_TITLE })).toBeInTheDocument();
    expect(screen.getByText(FEATURED_TOPIC)).toBeInTheDocument();
    expect(screen.getByText(topicLabel(FEATURED.topics[0]?.number))).toBeInTheDocument();
    expect(screen.getByText(topicLabel(FEATURED.topics.at(-1)?.number))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Back to Bookshelf/i }));
    expect(screen.getByRole('heading', { level: 1, name: 'Bookshelf' })).toBeInTheDocument();
  });

  it('moves focus to its heading when it opens from the stage, and draws no ring round it', () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} initialSlug={FEATURED.slug} />);
    screen.getByRole('region', { name: /Bookshelf/i }).focus();
    fireEvent.keyDown(window, { key: 'Enter' });

    const heading = screen.getByRole('heading', { level: 1, name: FEATURED_TITLE });
    expect(document.activeElement).toBe(heading);
    // The heading is no control: some detail rule turns the focus ring off for it.
    const ringless = styleRules(readCss(DETAIL_CSS))
      .filter((rule) =>
        declarations(rule.body).some(([name, value]) => name === 'outline' && value === 'none'),
      )
      .map((rule) => rule.selector.replace(/:focus(?:-visible)?/g, ''));
    expect(ringless.some((selector) => heading.matches(selector))).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Back to Bookshelf/i }));
  });

  it('steps to the next and previous books within /bookshelf from the in-page detail', () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} initialSlug={FEATURED.slug} />);
    const at = BOOKS.indexOf(FEATURED);
    screen.getByRole('region', { name: /Bookshelf/i }).focus();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByRole('heading', { level: 1, name: FEATURED_TITLE })).toBeInTheDocument();

    const adjacent = () => screen.getByRole('navigation', { name: 'Adjacent books' });
    expect(within(adjacent()).queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(
      within(adjacent()).getByRole('button', { name: new RegExp(bookAt(at + 1).title) }),
    );

    expect(
      screen.getByRole('heading', { level: 1, name: bookAt(at + 1).title }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe(`#/stage/${bookAt(at + 1).stageLabel}`);

    fireEvent.click(within(adjacent()).getByRole('button', { name: new RegExp(FEATURED_TITLE) }));
    expect(screen.getByRole('heading', { level: 1, name: FEATURED_TITLE })).toBeInTheDocument();
    expect(window.location.hash).toBe(`#/stage/${FEATURED.stageLabel}`);

    fireEvent.click(screen.getByRole('button', { name: /Back to Bookshelf/i }));
  });
});

describe('BookDetailView standalone', () => {
  it('renders with a Back to Bookshelf link and numbered topics', () => {
    render(<BookDetailView {...standaloneProps(FEATURED)} />);

    expect(screen.getByRole('heading', { level: 1, name: FEATURED_TITLE })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Bookshelf/i })).toHaveAttribute(
      'href',
      `/bookshelf?book=${FEATURED.slug}`,
    );
    expect(screen.getByText(topicLabel(FEATURED.topics[0]?.number))).toBeInTheDocument();
    expect(screen.getByText(topicLabel(FEATURED.topics.at(-1)?.number))).toBeInTheDocument();
    expect(screen.getByText(FEATURED_TOPIC)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Direct link/i })).not.toBeInTheDocument();

    const links = getIsbnRegistryLinks(FEATURED.isbn);
    expect(links).toEqual({
      openLibrary: `https://openlibrary.org/isbn/${FEATURED_ISBN}`,
      worldCat: `https://search.worldcat.org/isbn/${FEATURED_ISBN}`,
      isbnSearch: `https://isbnsearch.org/isbn/${FEATURED_ISBN}`,
    });
    expect(screen.getByRole('link', { name: /Open Library/i })).toHaveAttribute(
      'href',
      `https://openlibrary.org/isbn/${FEATURED_ISBN}`,
    );
    expect(screen.getByRole('link', { name: /WorldCat/i })).toHaveAttribute(
      'href',
      `https://search.worldcat.org/isbn/${FEATURED_ISBN}`,
    );
    expect(screen.getByRole('link', { name: /ISBN Search/i })).toHaveAttribute(
      'href',
      `https://isbnsearch.org/isbn/${FEATURED_ISBN}`,
    );
    expect(getIsbnRegistryLinks('N/A')).toBeNull();
  });

  it("draws the Sanity CDN cover with Studio's alt, or the title and authors", () => {
    render(<BookDetailView {...standaloneProps(FEATURED)} />);

    const cover = screen.getByRole('img', { name: `${FEATURED_TITLE} by ${FEATURED_DOC.authors}` });
    expect(cover.getAttribute('src')).toMatch(
      /^https:\/\/cdn\.sanity\.io\/images\/test\/test\/abc123-520x680\.webp\?/,
    );
  });

  it('leaves out the facts and links Studio has no value for', () => {
    const bare = bookAt(DEFAULT_BOOK_INDEX);
    expect(bare.isbn).toBeUndefined();
    expect(bare.url).toBeUndefined();
    render(<BookDetailView {...standaloneProps(bare)} />);

    expect(screen.queryByText(/ISBN/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Explore/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open Library/i })).not.toBeInTheDocument();
    expect(screen.getByText(bare.authors)).toBeInTheDocument();
  });

  it('links the books before and after, wrapping round from the first book to the last', () => {
    const first = bookAt(0);
    render(<BookDetailView {...standaloneProps(first)} />);
    const adjacent = screen.getByRole('navigation', { name: 'Adjacent books' });

    for (const neighbour of [bookAt(-1), bookAt(1)]) {
      const link = within(adjacent).getByRole('link', { name: new RegExp(neighbour.title) });
      expect(link).toHaveAttribute('href', `/bookshelf/${neighbour.slug}`);
      expect(link).toHaveTextContent(`Stage ${neighbour.stageLabel} · ${neighbour.track}`);
    }
  });

  it('has no Previous or Next links when the book is alone on the shelf', () => {
    const only = bookAt(0);
    render(
      <BookDetailView
        book={only}
        prev={toBookNeighbor(only)}
        next={toBookNeighbor(only)}
        mapBooks={[toReadingMapEntry(only)]}
        shelves={SHELVES}
      />,
    );

    expect(screen.queryByRole('navigation', { name: 'Adjacent books' })).not.toBeInTheDocument();
  });

  it('puts the cover above the text at 900 px and under: what the narrow rules order is a grid item', () => {
    const { container } = render(<BookDetailView {...standaloneProps(FEATURED)} />);
    const ordered = [DETAIL_CSS, COVER_FRAME_CSS].flatMap((css) =>
      styleRules(readCss(css))
        .filter((rule) => rule.conditions.includes(NARROW_MEDIA))
        .filter((rule) => declarations(rule.body).some(([name]) => name === 'order'))
        .map((rule) => rule.selector),
    );
    expect(ordered.length).toBeGreaterThan(0);

    for (const selector of ordered) {
      const element = container.querySelector(selector);
      expect(element, selector).not.toBeNull();
      // `order` moves only a grid item: the cover's own slot in the detail grid.
      expect(element?.parentElement, selector).toHaveClass('detail-grid');
      expect(element?.querySelector('img'), selector).toBe(
        screen.getByRole('img', { name: `${FEATURED_TITLE} by ${FEATURED_DOC.authors}` }),
      );
    }
  });

  it('loads its hero cover first, at high fetch priority, sized to the frame', () => {
    render(<BookDetailView {...standaloneProps(FEATURED)} />);

    const cover = screen.getByRole('img', { name: `${FEATURED_TITLE} by ${FEATURED_DOC.authors}` });
    expect(cover).toHaveAttribute('fetchpriority', 'high');
    expect(cover).toHaveAttribute('loading', 'eager');
    expect(cover).toHaveAttribute('sizes', '(max-width: 900px) 260px, 340px');
    const [small, full] = (cover.getAttribute('srcset') ?? '').split(', ');
    expect(full).toBe(`${FEATURED.coverSrc} 520w`);
    const [smallUrl, smallWidth] = (small ?? '').split(' ');
    expect(smallWidth).toBe('340w');
    expect(new URL(smallUrl ?? '').searchParams.get('w')).toBe('340');
  });
});
