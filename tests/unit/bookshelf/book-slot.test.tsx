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
 * @file A shelf slot paints its 3D state from props, so the server HTML already shows the active
 * cover, the side tilts and the filter highlight before hydration; and a slot reused for another
 * book (a jump) mounts a fresh cover image instead of repainting the previous book's cover.
 */

import { render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Class names resolve to their own keys, so assertions read the real state class names.
vi.mock('@/app/(routes)/(main)/(personal)/bookshelf/_components/bookshelf.module.css', () => ({
  default: new Proxy({} as Record<string, string>, {
    get: (_target, name) => (typeof name === 'string' ? name : undefined),
  }),
}));

import { BookshelfBookSlot } from '@/app/(routes)/(main)/(personal)/bookshelf/_components/bookshelf-book-slot';
import {
  type BookItem,
  getLiveConsoleSpineTheme,
} from '@/app/(routes)/(main)/(personal)/bookshelf/_lib/books';

const book = (slug: string): BookItem => ({
  slug,
  stage: 1,
  stageLabel: '01',
  title: `Book ${slug}`,
  spineTitle: `Book ${slug}`,
  authors: 'A. Author',
  spineAuthor: 'AUTHOR',
  track: 'Systems',
  shelfSlug: 'systems',
  status: 'queued',
  summary: 'A synthetic book.',
  coverSrc: `https://cdn.sanity.io/images/proj/production/${slug}-520x680.webp?w=520&h=680&fit=crop&auto=format`,
  coverAlt: `Book ${slug} by A. Author`,
  spine: getLiveConsoleSpineTheme(0),
  topics: [{ number: 1, title: 'Topic' }],
  updatedAt: '2026-01-01T00:00:00Z',
});

type SlotProps = ComponentProps<typeof BookshelfBookSlot>;
const props = (overrides: Partial<SlotProps> = {}): SlotProps => ({
  poolIndex: 0,
  offset: 0,
  x: 0,
  book: book('alpha'),
  isActive: true,
  isHighlighted: false,
  isDimmed: false,
  registerRef: () => {},
  ...overrides,
});

const slotClasses = (markup: string): string[] => {
  const match = /data-pool-index="0"[^>]*class="([^"]*)"/.exec(markup);
  return match?.[1]?.split(/\s+/) ?? [];
};

describe('BookshelfBookSlot state classes in the server HTML', () => {
  it('marks the active slot, and only it', () => {
    const classes = slotClasses(renderToStaticMarkup(<BookshelfBookSlot {...props()} />));
    expect(classes).toEqual(expect.arrayContaining(['slot', 'is-active']));
    expect(classes).not.toContain('is-before');
    expect(classes).not.toContain('is-after');
  });

  it('tilts slots before and after the active one', () => {
    const before = slotClasses(
      renderToStaticMarkup(<BookshelfBookSlot {...props({ offset: -2, isActive: false })} />),
    );
    const after = slotClasses(
      renderToStaticMarkup(<BookshelfBookSlot {...props({ offset: 3, isActive: false })} />),
    );
    expect(before).toContain('is-before');
    expect(before).not.toContain('is-active');
    expect(after).toContain('is-after');
    expect(after).not.toContain('is-active');
  });

  it('carries the filter highlight and dimming', () => {
    expect(
      slotClasses(renderToStaticMarkup(<BookshelfBookSlot {...props({ isHighlighted: true })} />)),
    ).toContain('is-highlighted');
    expect(
      slotClasses(
        renderToStaticMarkup(<BookshelfBookSlot {...props({ isActive: false, isDimmed: true })} />),
      ),
    ).toContain('is-dimmed');
  });
});

describe('BookshelfBookSlot cover image identity', () => {
  it('mounts a new cover <img> when the slot is reused for another book', () => {
    const { container, rerender } = render(<BookshelfBookSlot {...props()} />);
    const first = container.querySelector('img');
    rerender(<BookshelfBookSlot {...props({ book: book('beta') })} />);
    const second = container.querySelector('img');
    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
    expect(second?.getAttribute('alt')).toBe('Book beta by A. Author');
  });

  it('keeps the same <img> while the same book only moves between offsets', () => {
    const { container, rerender } = render(
      <BookshelfBookSlot {...props({ offset: 4, isActive: false })} />,
    );
    const first = container.querySelector('img');
    rerender(<BookshelfBookSlot {...props({ offset: 1, isActive: false })} />);
    expect(container.querySelector('img')).toBe(first);
  });
});
