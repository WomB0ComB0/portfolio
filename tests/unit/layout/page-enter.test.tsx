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
 * @file What remounts the page under PageEnter: the route that is rendered, not the address.
 *
 * PageEnter sits in src/app/(routes)/layout.tsx, and useSelectedLayoutSegments() there returns
 * the segments the router's tree renders below that layout: route groups included, a dynamic
 * segment as its value, never the page's own segment (so never the search params). The address
 * can change without the tree: Back or Forward onto an entry written with another entry's route
 * tree (a pushState carrying Next's state) restores that tree under its own URL, so usePathname()
 * turns while the same route stays rendered. Then the page must keep its state, and only a change
 * of route remounts it (and fades it in).
 */

import { render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PageEnter } from '@/components/animations/pages/page-enter';

const { usePathname, useSelectedLayoutSegments } = vi.hoisted(() => ({
  usePathname: vi.fn<() => string>(),
  useSelectedLayoutSegments: vi.fn<() => string[]>(),
}));
vi.mock('next/navigation', () => ({ usePathname, useSelectedLayoutSegments }));

/** The bookshelf list, (main)/(personal)/bookshelf/(list)/page.tsx, as seen from (routes). */
const LIST_SEGMENTS = ['(main)', '(personal)', 'bookshelf', '(list)'] as const;
/** A book's own page, (main)/(personal)/bookshelf/[slug]/page.tsx, for `slug`. */
const bookSegments = (slug: string) => ['(main)', '(personal)', 'bookshelf', slug] as const;

/** Where the router is: the address it reports and the segments its tree renders. */
const at = (pathname: string, segments: readonly string[]): void => {
  usePathname.mockReturnValue(pathname);
  // A fresh array on every render, as the real hook returns: the key must compare by value.
  useSelectedLayoutSegments.mockImplementation(() => [...segments]);
};

/** Page content that numbers its instances: a remount makes a new one and mounts again. */
let instances = 0;
const mounts = vi.fn<(instance: number) => void>();
const Probe = () => {
  const [instance] = useState(() => {
    instances += 1;
    return instances;
  });
  useEffect(() => {
    mounts(instance);
  }, [instance]);
  return <p data-instance={instance}>Page content</p>;
};

const page = () => (
  <PageEnter>
    <Probe />
  </PageEnter>
);

/** The page's instance number, as it rendered it. */
const shownInstance = (): string | null =>
  screen.getByText('Page content').getAttribute('data-instance');

beforeEach(() => {
  at('/bookshelf', LIST_SEGMENTS);
});

afterEach(() => {
  instances = 0;
  mounts.mockClear();
});

describe('PageEnter remounts on a change of rendered route only', () => {
  it('keeps the page when the address changes but the rendered route does not', () => {
    const { rerender } = render(page());
    const content = screen.getByText('Page content');

    // Forward onto a book's entry pushed over the list's: its URL, the list's tree.
    at('/bookshelf/dune', LIST_SEGMENTS);
    rerender(page());
    // Back to the list's entry.
    at('/bookshelf', LIST_SEGMENTS);
    rerender(page());

    expect(mounts).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Page content')).toBe(content);
    expect(shownInstance()).toBe('1');
  });

  it('remounts the page, fading it in, when the rendered route changes', () => {
    const { rerender } = render(page());
    const content = screen.getByText('Page content');

    at('/places', ['(main)', '(personal)', 'places', '(list)']);
    rerender(page());

    expect(mounts).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Page content')).not.toBe(content);
    expect(shownInstance()).toBe('2');
    const frame = screen.getByText('Page content').parentElement;
    expect(frame?.style.opacity).toBe('0');
  });

  it('remounts the page when a dynamic segment takes another value', () => {
    at('/bookshelf/dune', bookSegments('dune'));
    const { rerender } = render(page());

    at('/bookshelf/emma', bookSegments('emma'));
    rerender(page());

    expect(mounts).toHaveBeenCalledTimes(2);
    expect(shownInstance()).toBe('2');
  });

  it('keeps the page when only the search params change', () => {
    // Next leaves both the pathname and the selected segments as they were: search params live
    // on the page's own segment, which the hook never returns.
    const { rerender } = render(page());
    const content = screen.getByText('Page content');

    rerender(page());

    expect(mounts).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Page content')).toBe(content);
  });
});
