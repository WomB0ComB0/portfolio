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
 * @file The shelf cards under the stage (shelf-cards-grid.tsx), on the fixture catalog of
 * bookshelf-fixtures.ts: one card per shelf, in shelf order, linking its /bookshelf/shelf/<slug>
 * page, each with a ribbon track and progress fill. Each fanned cover is offered at its drawn
 * 100 px width at 1x, 2x and 3x, and a card skips drawing, and so fetching its covers, until it
 * nears the viewport.
 */

import { screen } from '@testing-library/react';
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

import { BookshelfStage } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/bookshelf-stage';
import { BOOKS, renderWithNuqs as render, SHELVES, widthOf } from './bookshelf-fixtures';

afterEach(() => {
  vi.useRealTimers();
});

describe('ShelfCardsGrid', () => {
  it('renders separated fanned shelf cards linking to /bookshelf/shelf/[slug], in shelf order', () => {
    render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Shelves' })).toBeInTheDocument();
    expect(SHELVES.map((shelf) => shelf.slug)).toEqual(['backend', 'ai', 'humanities']);
    for (const shelf of SHELVES) {
      const link = screen.getByRole('link', { name: new RegExp(shelf.title) });
      expect(link).toHaveAttribute('href', `/bookshelf/shelf/${shelf.slug}`);
    }
  });

  it('offers each fanned shelf-card cover at its drawn 100 px width, at 1x, 2x and 3x', () => {
    const { container } = render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const fans = container.querySelectorAll<HTMLImageElement>(
      'section[aria-labelledby="shelves-heading"] img',
    );

    expect(fans.length).toBeGreaterThan(0);
    for (const img of fans) {
      const candidates = (img.getAttribute('srcset') ?? '').split(', ').map((c) => c.split(' '));
      expect(candidates.map(([, density]) => density)).toEqual(['1x', '2x', '3x']);
      expect(candidates.map(([url]) => widthOf(url))).toEqual([100, 200, 300]);
      expect(candidates[0]?.[0]).toBe(img.getAttribute('src'));
      expect(img).toHaveAttribute('width', '100');
      expect(img).toHaveAttribute('height', '131');
      expect(img).toHaveAttribute('loading', 'lazy');
      expect(img).toHaveAttribute('decoding', 'async');
    }
  });

  it('skips drawing a shelf card, and so fetching its fan covers, until it nears the viewport', () => {
    const { container } = render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    const cards = container.querySelectorAll<HTMLAnchorElement>(
      'section[aria-labelledby="shelves-heading"] a[href^="/bookshelf/shelf/"]',
    );

    expect(cards).toHaveLength(SHELVES.length);
    for (const card of cards) {
      expect(card).toHaveClass(
        '[content-visibility:auto]',
        '[contain-intrinsic-block-size:auto_343px]',
      );
    }
  });

  it('renders a ribbon track and progress fill on every shelf card', () => {
    const { container } = render(<BookshelfStage books={BOOKS} shelves={SHELVES} />);
    for (const shelf of SHELVES) {
      const track = container.querySelector(`[data-shelf-ribbon-track="${shelf.slug}"]`);
      const fill = container.querySelector(`[data-shelf-ribbon-fill="${shelf.slug}"]`);
      expect(track, shelf.slug).not.toBeNull();
      expect(fill, shelf.slug).not.toBeNull();
      expect(track).toHaveClass('bg-brand-subtle');
      expect(fill).toHaveClass('bg-brand');
    }
  });
});
