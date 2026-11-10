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
 * @file /places/photos: every photo of every past place, rendered on the server through the
 * past-only loader, filtered by the same URL as /places (?q, ?category, old forms included), with
 * the "Places | Photos" links carrying the filters. A visit today, still running, undated or
 * whose photos were cleared shows nothing. Filters that match only places without photos say
 * "No photos match" and point to the places list with the same filters, never "No places match".
 * The metadata names no location.
 */

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Place } from '@/hooks/sanity/schemas';
import { makePlace } from '../../fixtures/sanity-docs';
import { wideLayout } from '../console/filter-bar/wide-layout';

const h = vi.hoisted(() => ({ loadPlaces: vi.fn<() => Promise<readonly unknown[]>>() }));

vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/sanity/loaders', () => ({ loadPlaces: h.loadPlaces }));
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});

import PhotosPage, { metadata } from '@/app/(routes)/(main)/(personal)/places/photos/page';

type Photo = NonNullable<Place['photos']>[number];
const hash = (n: number): string => n.toString(16).padStart(40, '0');
const photo = (n: number): Photo => ({
  _type: 'image',
  asset: { _type: 'reference', _ref: `image-${hash(n)}-1600x1200-jpg` },
});
const categoryOf = (index: number): Place['category'] =>
  (['Hackathon', 'Conference', 'Tech Office'] as const)[index % 3] ?? 'Event';

/** Nine past places of three photos each; every third a hackathon. */
const PLACES: readonly Place[] = Array.from({ length: 9 }, (_, index) =>
  makePlace({
    name: index === 0 ? 'Antler NYC' : `Visited ${index}`,
    category: categoryOf(index),
    startDate: '2026-05-19',
    photos: [photo(index * 3), photo(index * 3 + 1), photo(index * 3 + 2)],
  }),
);
const NO_PHOTOS = makePlace({ name: 'Bare', startDate: '2026-05-19', photos: null });

const gridLinks = () => within(screen.getByRole('list', { name: 'Photos' })).queryAllByRole('link');

async function renderPhotos(searchParams = '') {
  const page = await PhotosPage();
  return render(
    <NuqsTestingAdapter searchParams={searchParams} hasMemory>
      {page}
    </NuqsTestingAdapter>,
  );
}

let narrow: () => void;

beforeEach(() => {
  narrow = wideLayout();
  h.loadPlaces.mockReset();
  h.loadPlaces.mockResolvedValue([...PLACES, NO_PHOTOS]);
});

afterEach(() => {
  cleanup();
  narrow();
  vi.useRealTimers();
});

describe('/places/photos', () => {
  it('renders the header, the filter bar and every photo in the grid', async () => {
    await renderPhotos();

    expect(
      screen.getByRole('heading', { level: 1, name: "Places I've Visited" }),
    ).toBeInTheDocument();
    expect(screen.getByText('27 photos from 9 past visits')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search places' })).toBeInTheDocument();
    // jsdom shows the first 48; all 27 fit.
    expect(gridLinks()).toHaveLength(27);
    expect(
      gridLinks().every((link) => /^\/places\/[^/]+$/.test(link.getAttribute('href') ?? '')),
    ).toBe(true);
  });

  it('marks Photos as the current view and carries the filters to Places', async () => {
    await renderPhotos('?q=antler&category=Hackathon');
    const nav = screen.getByRole('navigation', { name: 'Places views' });

    expect(within(nav).getByRole('link', { name: 'Photos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Places' })).toHaveAttribute(
      'href',
      '/places?category=hackathon&q=antler',
    );
  });

  it.each(['?category=hackathon', '?category=Hackathon', '?category=HACKATHON'])(
    'shows only that category for %s, already in the server HTML',
    async (search) => {
      const page = await PhotosPage();
      const html = renderToString(
        <NuqsTestingAdapter searchParams={search}>{page}</NuqsTestingAdapter>,
      );
      const hackathons = PLACES.filter((place) => place.category === 'Hackathon');

      expect(html.match(/data-photo-key=/g)).toHaveLength(hackathons.length * 3);
      for (const place of PLACES.filter((item) => item.category !== 'Hackathon')) {
        expect(html).not.toContain(`href="/places/${place._id}"`);
      }
    },
  );

  it('searches by place name and shows the empty state when nothing matches', async () => {
    await renderPhotos('?q=antler');
    expect(gridLinks()).toHaveLength(3);
    cleanup();

    await renderPhotos('?q=nowhere-at-all');
    expect(screen.queryByRole('list', { name: 'Photos' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No photos match' })).toBeInTheDocument();
  });

  it('says a place without photos is in the places list, the filters carried there', async () => {
    await renderPhotos('?q=bare&category=hackathon');
    const empty = screen.getByRole('heading', { name: 'No photos match' }).parentElement;
    if (!empty) throw new Error('no empty state');

    expect(screen.queryByRole('heading', { name: 'No places match' })).not.toBeInTheDocument();
    expect(empty).toHaveTextContent('Places without photos are in the places list.');
    expect(within(empty).getByRole('link', { name: 'the places list' })).toHaveAttribute(
      'href',
      '/places?category=hackathon&q=bare',
    );
  });

  it('filters in place as the search is typed', async () => {
    await renderPhotos();

    await act(async () => {
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search places' }), {
        target: { value: 'antler' },
      });
    });

    expect(gridLinks()).toHaveLength(3);
  });

  it('says there are no photos yet, with no bar, when no past place has one', async () => {
    h.loadPlaces.mockResolvedValue([NO_PHOTOS]);
    await renderPhotos();

    expect(screen.getByText('No photos yet')).toBeInTheDocument();
    expect(document.querySelector('search')).toBeNull();
    expect(screen.getByText('0 photos from 0 past visits')).toBeInTheDocument();
  });

  it('names no location in its metadata, and points og:url at itself', () => {
    expect(metadata.other).toBeUndefined();
    expect(JSON.stringify(metadata)).not.toMatch(/geo\.|placename|latitude|longitude/i);
    expect(String(metadata.openGraph?.url)).toMatch(/\/places\/photos$/);
  });

  it('lets a Sanity outage reach the error boundary', async () => {
    const outage = new Error('sanity is down');
    h.loadPlaces.mockRejectedValue(outage);

    await expect(PhotosPage()).rejects.toBe(outage);
  });
});

describe('/places/photos past visits only', () => {
  // 13:00 ET on Nov 10, 2026: from noon, Nov 10 is the cutoff, so Nov 9 is over and Nov 10 is not.
  const NOW = Date.UTC(2026, 10, 10, 18, 0);
  const PAST = makePlace({ name: 'Over', startDate: '2026-11-09', photos: [photo(901)] });
  const TODAY = makePlace({ name: 'Today', startDate: '2026-11-10', photos: [photo(902)] });
  const RUNNING = makePlace({
    name: 'Running',
    startDate: '2026-11-08',
    endDate: '2026-11-20',
    photos: [photo(903)],
  });
  const UNDATED = makePlace({ name: 'Undated', startDate: null, photos: [photo(904)] });

  it('shows no photo, count or chip of a visit that may still be on', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    h.loadPlaces.mockResolvedValue([TODAY, RUNNING, PAST, UNDATED]);
    const page = await PhotosPage();
    const html = renderToString(<NuqsTestingAdapter>{page}</NuqsTestingAdapter>);

    expect(html).toContain('1 photo from 1 past visit');
    expect(html).toContain(`href="/places/${PAST._id}"`);
    for (const hidden of [TODAY, RUNNING, UNDATED]) {
      expect(html).not.toContain(hidden._id);
      expect(html).not.toContain(hidden.name);
    }
    for (const n of [902, 903, 904]) {
      expect(html).not.toContain(hash(n));
      expect(html).not.toContain(encodeURIComponent(hash(n)));
    }
  });
});
