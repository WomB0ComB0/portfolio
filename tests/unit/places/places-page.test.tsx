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
 * @file /places renders every past place on the server: no pagination, the header counts them
 * all, and the filters live in the URL (`q`, `category`) through the shared FilterBar kit in its
 * sticky 'bar' density, narrowing the cards and the map together. Typing filters at once (no
 * debounce); a chip writes ?category=<slug>; old links (the Studio label, any case, its %20 form)
 * still land on their chip, and a bogus one shows everything. A visit today, still to come or
 * undated never shows. The map and the cards are given one array until the results change, so
 * typing that matches the same places re-renders no card. The client islands never build Sanity
 * image URLs themselves.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Place } from '@/hooks/sanity/schemas';
import type { PlaceItem } from '@/types/places';
import { makePlace } from '../../fixtures/sanity-docs';
import { wideLayout } from '../console/filter-bar/wide-layout';

const PLACE_COUNT = 57;
/** Every third place is a hackathon: 19 of the 57. */
const HACKATHON_COUNT = 19;
/** As many are Tech Office visits. */
const TECH_OFFICE_COUNT = 19;

const h = vi.hoisted(() => ({
  loadPlaces: vi.fn<() => Promise<readonly unknown[]>>(),
  mapPlaces: [] as readonly PlaceItem[],
  /** How many times a place card has rendered. */
  cardRenders: 0,
}));

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/sanity/loaders', () => ({ loadPlaces: h.loadPlaces }));
// The real URL builder, as the server uses it.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});
// Google Maps needs a browser API key and network; what it is given is what matters here.
vi.mock('@/app/(routes)/(main)/(personal)/places/_components/map', () => {
  const GoogleMaps = ({ placesToDisplay }: { placesToDisplay: readonly PlaceItem[] }) => {
    h.mapPlaces = placesToDisplay;
    return <div>map of {placesToDisplay.length} places</div>;
  };
  return { GoogleMaps, default: GoogleMaps };
});

// The real card, counted, so a test can tell when typing re-renders the grid.
vi.mock(
  '@/app/(routes)/(main)/(personal)/places/_components/place-card',
  async (importOriginal) => {
    const real =
      await importOriginal<
        typeof import('@/app/(routes)/(main)/(personal)/places/_components/place-card')
      >();
    const PlaceCard = (props: Parameters<typeof real.PlaceCard>[0]) => {
      h.cardRenders += 1;
      return <real.PlaceCard {...props} />;
    };
    return { ...real, PlaceCard };
  },
);

import PlacesPage from '@/app/(routes)/(main)/(personal)/places/(list)/page';

/** The category of place `index`: hackathons, conferences and Tech Office visits in turn. */
const categoryOf = (index: number): Place['category'] =>
  (['Hackathon', 'Conference', 'Tech Office'] as const)[index % 3] ?? 'Event';

const PLACES: readonly Place[] = Array.from({ length: PLACE_COUNT }, (_, index) =>
  makePlace({
    name: index === 0 ? 'Antler NYC' : `Visited ${index}`,
    category: categoryOf(index),
    startDate: '2026-05-19',
    photos:
      index === 0
        ? [{ _type: 'image', asset: { _ref: 'image-c-1600x1200-jpg', _type: 'reference' } }]
        : null,
  }),
);

/** Each card's link to its place page ("Details of …" / "5 photos of …"). */
const placePageLinks = () => screen.queryAllByRole('link', { name: /^(\d+ photos?|Details) of / });
/** The ids the cards link to, in order. */
const cardIds = (): string[] =>
  placePageLinks().map((link) => (link.getAttribute('href') ?? '').replace('/places/', ''));
const mapIds = (): string[] => h.mapPlaces.map((place) => place.id);
const searchField = () => screen.getByRole('searchbox', { name: 'Search places' });
const chips = () => screen.getByRole('list', { name: 'Filter by category' });

async function renderPlaces(searchParams = '', onUrlUpdate?: (event: UrlUpdateEvent) => void) {
  const page = await PlacesPage();
  return render(
    <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
      {page}
    </NuqsTestingAdapter>,
  );
}

let narrow: () => void;

beforeEach(() => {
  narrow = wideLayout();
  h.mapPlaces = [];
  h.loadPlaces.mockReset();
  h.loadPlaces.mockResolvedValue(PLACES);
});

afterEach(() => {
  cleanup();
  narrow();
  vi.useRealTimers();
});

describe('/places', () => {
  it('renders every place as a card, with no Load More', async () => {
    await renderPlaces();

    expect(placePageLinks()).toHaveLength(PLACE_COUNT);
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(h.mapPlaces).toHaveLength(PLACE_COUNT);
    expect(document.querySelectorAll('li[data-place-card]')).toHaveLength(PLACE_COUNT);
  });

  it("builds the folder's slivers on the server: up to three 96 x 64 crops", async () => {
    await renderPlaces();

    const [first, second] = h.mapPlaces;
    expect(first?.name).toBe('Antler NYC');
    expect(first?.photoCount).toBe(1);
    expect(first?.slivers).toHaveLength(1);
    const sliver = new URL(first?.slivers[0] ?? '');
    expect(sliver.href).toMatch(/^https:\/\/cdn\.sanity\.io\/images\/test\/test\//);
    expect(sliver.searchParams.get('w')).toBe('96');
    expect(sliver.searchParams.get('h')).toBe('64');
    expect(second).toMatchObject({ photoCount: 0, slivers: [] });
    expect(first).not.toHaveProperty('photos');
    expect(screen.getByRole('link', { name: '1 photo of Antler NYC' })).toHaveAttribute(
      'href',
      `/places/${PLACES[0]?._id}`,
    );
  });

  it('caps the slivers at three, from the first usable photos', async () => {
    const photo = (n: number) => ({
      _type: 'image' as const,
      asset: { _type: 'reference' as const, _ref: `image-s${n}-1600x1200-jpg` },
    });
    const broken = { _type: 'image' as const, asset: { _type: 'reference' as const, _ref: '' } };
    h.loadPlaces.mockResolvedValue([
      makePlace({ name: 'Many', photos: [broken, photo(1), photo(2), photo(3), photo(4)] }),
    ]);
    await renderPlaces();

    const [many] = h.mapPlaces;
    expect(many?.photoCount).toBe(4);
    expect(many?.slivers.map((url) => new URL(url).pathname)).toEqual([
      '/images/test/test/s1-1600x1200.jpg',
      '/images/test/test/s2-1600x1200.jpg',
      '/images/test/test/s3-1600x1200.jpg',
    ]);
    expect(screen.getByRole('link', { name: '4 photos of Many' })).toBeInTheDocument();
  });

  it("uses the kit's sticky bar on a tile, with the search and the category chips", async () => {
    await renderPlaces();

    // jsdom's role table predates <search>; browsers map it to the search landmark.
    const bar = document.querySelector('search[data-filter-part="bar"]');
    expect(bar).toHaveAttribute('data-density', 'bar');
    expect(bar).toHaveAttribute('data-sticky', '');
    expect(bar).toContainElement(searchField());
    expect(searchField()).toHaveAttribute('placeholder', 'Search places');
    expect(
      within(chips())
        .getAllByRole('link')
        .map((chip) => chip.dataset.chip),
    ).toEqual(['all', 'conference', 'event', 'hackathon', 'mentorship', 'research', 'tech-office']);
    expect(bar?.closest('[data-filter-scope]')).toContainElement(
      document.querySelector('[data-places-part="map"]') as HTMLElement,
    );
  });

  it('counts every place in the header, even with a category in the URL', async () => {
    await renderPlaces('?category=Hackathon');

    expect(screen.getByText(`${PLACE_COUNT} locations visited`)).toBeInTheDocument();
    expect(placePageLinks()).toHaveLength(HACKATHON_COUNT);
    expect(h.mapPlaces).toHaveLength(HACKATHON_COUNT);
    expect(h.mapPlaces.every((place) => place.category === 'Hackathon')).toBe(true);
    expect(document.querySelector('[data-filter-part="count"]')).toHaveTextContent(
      `${HACKATHON_COUNT} of ${PLACE_COUNT} places`,
    );
  });

  it.each([
    ['?category=hackathon', HACKATHON_COUNT],
    ['?category=Hackathon', HACKATHON_COUNT],
    ['?category=Tech%20Office', TECH_OFFICE_COUNT],
    ['?category=Tech+Office', TECH_OFFICE_COUNT],
  ])('lands %s on its chip, with the cards and the map in step', async (search, count) => {
    await renderPlaces(search);

    expect(cardIds()).toHaveLength(count);
    expect(mapIds()).toEqual(cardIds());
    const current = within(chips()).getByRole('link', { current: true });
    expect(current).toHaveTextContent(new RegExp(`${count} places$`));
    expect(current.getAttribute('href')).toMatch(/^\/places\?category=[a-z-]+$/);
  });

  it('treats a category it does not know as all of them', async () => {
    await renderPlaces('?category=Bogus');

    expect(placePageLinks()).toHaveLength(PLACE_COUNT);
    expect(h.mapPlaces).toHaveLength(PLACE_COUNT);
    expect(screen.queryByRole('list', { name: 'Applied filters' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Clear all' })).not.toBeInTheDocument();
    expect(within(chips()).getByRole('link', { current: true })).toHaveAttribute(
      'data-chip',
      'all',
    );
  });

  it('searches names and descriptions from ?q, for the cards and the map', async () => {
    await renderPlaces('?q=antler');

    expect(placePageLinks()).toHaveLength(1);
    expect(h.mapPlaces.map((place) => place.name)).toEqual(['Antler NYC']);
    expect(searchField()).toHaveValue('antler');
  });

  it('filters the cards and the map on each keystroke, with no timer to wait for', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    await renderPlaces();

    await act(async () => {
      fireEvent.change(searchField(), { target: { value: 'antler' } });
    });

    expect(placePageLinks()).toHaveLength(1);
    expect(h.mapPlaces.map((place) => place.name)).toEqual(['Antler NYC']);
  });

  it('gives the map the same array while the results stay the same', async () => {
    await renderPlaces('?q=antler');
    const before = h.mapPlaces;

    // A trailing space changes what is typed, not what matches.
    await act(async () => {
      fireEvent.change(searchField(), { target: { value: 'antler ' } });
    });

    expect(searchField()).toHaveValue('antler ');
    expect(h.mapPlaces).toBe(before);
  });

  it('re-renders no card while what is typed still matches the same places', async () => {
    await renderPlaces();
    h.cardRenders = 0;

    // A space changes what is typed, not what matches; nor does a word every place contains.
    await act(async () => {
      fireEvent.change(searchField(), { target: { value: ' ' } });
    });
    await act(async () => {
      fireEvent.change(searchField(), { target: { value: ' place' } });
    });
    expect(h.cardRenders).toBe(0);

    await act(async () => {
      fireEvent.change(searchField(), { target: { value: 'antler' } });
    });
    expect(placePageLinks()).toHaveLength(1);
    expect(h.cardRenders).toBeGreaterThan(0);
  });

  it('lays the cards out to fill the column, edge to edge with the bar and the map', async () => {
    await renderPlaces();
    const grid = screen.getByRole('list', { name: 'Places' });
    const classes = (grid.getAttribute('class') ?? '').split(' ');

    expect(classes).toEqual(
      expect.arrayContaining(['grid', 'grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))]']),
    );
    expect(classes).not.toContain('justify-center');
    expect(classes.some((name) => /minmax\(220px,280px\)/.test(name))).toBe(false);
  });

  it('shows the empty state, with Clear filters, when nothing matches', async () => {
    await renderPlaces('?q=nowhere-at-all');

    expect(placePageLinks()).toHaveLength(0);
    expect(h.mapPlaces).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'No places match' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute('href', '/places');
  });

  it('says there are no places, with no bar and no map, when there are none at all', async () => {
    h.loadPlaces.mockResolvedValue([]);
    await renderPlaces();

    expect(screen.getByText('No places found')).toBeInTheDocument();
    expect(document.querySelector('search')).toBeNull();
    expect(document.querySelector('[data-places-part="map"]')).toBeNull();
    expect(screen.getByText('0 locations visited')).toBeInTheDocument();
  });

  it('writes the search to the URL, replacing the history entry', async () => {
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
    await renderPlaces('', onUrlUpdate);

    await act(async () => {
      fireEvent.change(searchField(), { target: { value: 'antler' } });
    });

    await vi.waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const last = onUrlUpdate.mock.calls.at(-1)?.[0];
    expect(last?.searchParams.get('q')).toBe('antler');
    expect(last?.options.history).toBe('replace');
    expect(last?.options.shallow).toBe(true);
    expect(placePageLinks()).toHaveLength(1);
  });

  it('writes a chip to the URL as its slug, replacing the history entry, and filters in place', async () => {
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
    await renderPlaces('', onUrlUpdate);

    await act(async () => {
      fireEvent.click(within(chips()).getByRole('link', { name: /^Tech Office/ }));
    });

    await vi.waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const last = onUrlUpdate.mock.calls.at(-1)?.[0];
    expect(last?.queryString).toBe('?category=tech-office');
    expect(last?.options.history).toBe('replace');
    expect(last?.options.shallow).toBe(true);
    expect(cardIds()).toHaveLength(TECH_OFFICE_COUNT);
    expect(mapIds()).toEqual(cardIds());
    expect(screen.getByRole('link', { name: 'Remove Category: Tech Office' })).toBeInTheDocument();
  });

  it('clears both filters from the URL', async () => {
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
    await renderPlaces('?q=antler&category=Hackathon', onUrlUpdate);

    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: 'Clear all' }));
    });

    await vi.waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toBe('');
    expect(placePageLinks()).toHaveLength(PLACE_COUNT);
  });

  it('lets a Sanity outage reach the error boundary instead of showing no places', async () => {
    const outage = new Error('sanity is down');
    h.loadPlaces.mockRejectedValue(outage);

    await expect(PlacesPage()).rejects.toBe(outage);
  });
});

describe('/places past visits only', () => {
  // 13:00 ET on Nov 10, 2026: from noon, Nov 10 is the cutoff, so Nov 9 is over and Nov 10 is not.
  const NOW = Date.UTC(2026, 10, 10, 18, 0);
  const PAST = makePlace({ name: 'Over', startDate: '2026-11-09' });
  const TODAY = makePlace({ name: 'Today', startDate: '2026-11-10' });
  const RUNNING = makePlace({ name: 'Running', startDate: '2026-11-08', endDate: '2026-11-20' });
  const UNDATED = makePlace({ name: 'Undated', startDate: null });

  it('shows no visit that may still be on, anywhere: cards, map, header or chips', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    h.loadPlaces.mockResolvedValue([TODAY, RUNNING, PAST]);
    await renderPlaces();

    expect(cardIds()).toEqual([PAST._id]);
    expect(mapIds()).toEqual([PAST._id]);
    expect(screen.getByText('1 location visited')).toBeInTheDocument();
    expect(within(chips()).getByRole('link', { name: /^All/ })).toHaveTextContent('All 1 place');
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
    expect(screen.queryByText('Running')).not.toBeInTheDocument();
  });

  it('drops an undated place: with no day it may still be on', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    h.loadPlaces.mockResolvedValue([PAST, UNDATED]);
    await renderPlaces();

    expect(cardIds()).toEqual([PAST._id]);
    expect(mapIds()).toEqual([PAST._id]);
    expect(screen.queryByText('Undated')).not.toBeInTheDocument();
  });
});

describe('/places client islands', () => {
  const SRC_DIR = path.resolve(__dirname, '../../../src');
  const PLACES_DIR = path.join(SRC_DIR, 'app/(routes)/(main)/(personal)/places');
  const ISLANDS = [
    '_components/places-explorer.tsx',
    'photos/_components/photos-explorer.tsx',
    '[placeId]/_components/place-photo-viewer.tsx',
  ];
  /**
   * Imports, static or lazy, that would put @sanity/client (and the image URL builder) in the
   * browser bundle.
   */
  const SERVER_SIDE_IMPORT =
    /(?:from |import\()'(@\/lib\/sanity\/client|@\/lib\/sanity\/loaders|@\/hooks\/sanity\/schemas|[^']*viewer-photo-url)'/;
  /** Static imports and lazy ones (`import('./x')`), so a lazily loaded part is checked too. */
  const PLACES_IMPORT =
    /(?:from |import\()'(\.{1,2}\/[^']+|@\/app\/\(routes\)\/\(main\)\/\(personal\)\/places\/[^']+|@\/lib\/places\/[^']+)'/g;
  const MODULE_SUFFIXES = ['.tsx', '.ts', '/index.ts'];

  const resolveImport = (from: string, specifier: string): string | undefined => {
    const base = specifier.startsWith('@/')
      ? path.join(SRC_DIR, specifier.slice(2))
      : path.resolve(path.dirname(from), specifier);
    return MODULE_SUFFIXES.map((suffix) => `${base}${suffix}`).find(existsSync);
  };

  /** `file` and every places module it imports, directly or through other places modules. */
  function placesGraph(file: string, seen: ReadonlySet<string> = new Set()): ReadonlySet<string> {
    if (seen.has(file)) return seen;
    let graph = new Set([...seen, file]);
    for (const [, specifier = ''] of readFileSync(file, 'utf8').matchAll(PLACES_IMPORT)) {
      const imported = resolveImport(file, specifier);
      if (imported) graph = new Set(placesGraph(imported, graph));
    }
    return graph;
  }

  it('guards a lazy import of a server-side module as well as a static one', () => {
    expect("import { urlFor } from '@/lib/sanity/client';").toMatch(SERVER_SIDE_IMPORT);
    expect("const { urlFor } = await import('@/lib/sanity/client');").toMatch(SERVER_SIDE_IMPORT);
    expect("await import('../_lib/viewer-photo-url');").toMatch(SERVER_SIDE_IMPORT);
    expect("await import('./photo-wall-live');").not.toMatch(SERVER_SIDE_IMPORT);
  });

  it.each(ISLANDS)('%s is a client module that never builds Sanity URLs', (island) => {
    const file = path.join(PLACES_DIR, island);

    expect(readFileSync(file, 'utf8').startsWith("'use client';")).toBe(true);
    const graph = placesGraph(file);
    expect(graph.size).toBeGreaterThan(1);
    for (const module of graph) {
      expect(readFileSync(module, 'utf8'), path.relative(PLACES_DIR, module)).not.toMatch(
        SERVER_SIDE_IMPORT,
      );
    }
  });

  it("reaches the photos view's lazily loaded wall and open view through its island", () => {
    const graph = [
      ...placesGraph(path.join(PLACES_DIR, 'photos/_components/photos-explorer.tsx')),
    ].map((file) => path.relative(PLACES_DIR, file));

    expect(graph).toEqual(
      expect.arrayContaining([
        'photos/_components/photo-wall-live.tsx',
        'photos/_components/wall-sheet.tsx',
        'photos/_components/photo-dialog-live.tsx',
        '_lib/place-filters.ts',
      ]),
    );
  });

  it('reaches the filter schema and the map input through the island', () => {
    const graph = [...placesGraph(path.join(PLACES_DIR, ISLANDS[0] as string))].map((file) =>
      path.relative(SRC_DIR, file),
    );

    expect(graph).toEqual(
      expect.arrayContaining([
        'app/(routes)/(main)/(personal)/places/_lib/place-filters.ts',
        'app/(routes)/(main)/(personal)/places/_components/use-shown-places.ts',
        'lib/places/categories.ts',
      ]),
    );
  });
});
