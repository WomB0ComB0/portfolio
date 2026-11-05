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
 * @file /places renders every place on the server: no pagination, the header counts them all,
 * and the filters live in the URL (`q`, `category`) and narrow the cards and the map together.
 * The client islands never build Sanity image URLs themselves.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Place } from '@/hooks/sanity/schemas';
import type { PlaceItem } from '@/types/places';
import { makePlace } from '../../fixtures/sanity-docs';

const PLACE_COUNT = 57;
/** Every third place is a hackathon: 19 of the 57. */
const HACKATHON_COUNT = 19;

const h = vi.hoisted(() => ({
  loadPlaces: vi.fn<() => Promise<readonly unknown[]>>(),
  mapPlaces: [] as readonly PlaceItem[],
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

import PlacesLoading from '@/app/(routes)/(main)/(personal)/places/(list)/loading';
import PlacesPage from '@/app/(routes)/(main)/(personal)/places/(list)/page';

const PLACES: readonly Place[] = Array.from({ length: PLACE_COUNT }, (_, index) =>
  makePlace({
    name: index === 0 ? 'Antler NYC' : `Visited ${index}`,
    category: index % 3 === 0 ? 'Hackathon' : 'Conference',
    photos:
      index === 0
        ? [{ _type: 'image', asset: { _ref: 'image-c-1600x1200-jpg', _type: 'reference' } }]
        : null,
  }),
);

/** Each card's link to its place page ("View Details for …" / "View Photos (n) for …"). */
const placePageLinks = () => screen.queryAllByRole('link', { name: /^View (Details|Photos)/ });

async function renderPlaces(searchParams = '', onUrlUpdate?: (event: UrlUpdateEvent) => void) {
  const page = await PlacesPage();
  return render(
    <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
      {page}
    </NuqsTestingAdapter>,
  );
}

beforeEach(() => {
  h.mapPlaces = [];
  h.loadPlaces.mockReset();
  h.loadPlaces.mockResolvedValue(PLACES);
});

describe('/places', () => {
  it('renders every place as a card, with no Load More', async () => {
    await renderPlaces();

    expect(placePageLinks()).toHaveLength(PLACE_COUNT);
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(h.mapPlaces).toHaveLength(PLACE_COUNT);
  });

  it('builds the photo URLs on the server', async () => {
    await renderPlaces();

    const [first] = h.mapPlaces;
    expect(first?.name).toBe('Antler NYC');
    expect(first?.photos).toHaveLength(1);
    expect(first?.photos[0]?.url).toMatch(/^https:\/\/cdn\.sanity\.io\/images\/test\/test\//);
    expect(screen.getByRole('link', { name: 'View Photos (1) for Antler NYC' })).toHaveAttribute(
      'href',
      `/places/${PLACES[0]?._id}`,
    );
  });

  it('counts every place in the header, even with a category in the URL', async () => {
    await renderPlaces('?category=Hackathon');

    expect(screen.getByText(`${PLACE_COUNT} locations visited`)).toBeInTheDocument();
    expect(placePageLinks()).toHaveLength(HACKATHON_COUNT);
    expect(h.mapPlaces).toHaveLength(HACKATHON_COUNT);
    expect(h.mapPlaces.every((place) => place.category === 'Hackathon')).toBe(true);
    expect(
      screen.getByText(`Showing ${HACKATHON_COUNT} of ${PLACE_COUNT} places`),
    ).toBeInTheDocument();
  });

  it('treats a category no place has as all of them', async () => {
    await renderPlaces('?category=Bogus');

    expect(placePageLinks()).toHaveLength(PLACE_COUNT);
    expect(h.mapPlaces).toHaveLength(PLACE_COUNT);
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('searches names and descriptions from ?q, for the cards and the map', async () => {
    await renderPlaces('?q=antler');

    expect(placePageLinks()).toHaveLength(1);
    expect(h.mapPlaces.map((place) => place.name)).toEqual(['Antler NYC']);
    expect(screen.getByPlaceholderText('Search places...')).toHaveValue('antler');
  });

  it('shows the empty state when nothing matches', async () => {
    await renderPlaces('?q=nowhere-at-all');

    expect(placePageLinks()).toHaveLength(0);
    expect(screen.getByText('No places found')).toBeInTheDocument();
  });

  it('writes the search to the URL, replacing the history entry', async () => {
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
    await renderPlaces('', onUrlUpdate);

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Search places...'), {
        target: { value: 'antler' },
      });
    });

    await vi.waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const last = onUrlUpdate.mock.calls.at(-1)?.[0];
    expect(last?.searchParams.get('q')).toBe('antler');
    expect(last?.options.history).toBe('replace');
    expect(last?.options.shallow).toBe(true);
    // The list follows once typing settles.
    await vi.waitFor(() => expect(placePageLinks()).toHaveLength(1));
  });

  it('clears both filters from the URL', async () => {
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
    await renderPlaces('?q=antler&category=Hackathon', onUrlUpdate);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    });

    await vi.waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toBe('');
    await vi.waitFor(() => expect(placePageLinks()).toHaveLength(PLACE_COUNT));
  });

  it('lets a Sanity outage reach the error boundary instead of showing no places', async () => {
    const outage = new Error('sanity is down');
    h.loadPlaces.mockRejectedValue(outage);

    await expect(PlacesPage()).rejects.toBe(outage);
  });
});

describe('/places loading skeleton', () => {
  // Without JavaScript, a cold load shows only this skeleton: the page streams into a hidden
  // element that only a script reveals. The header must already be the page's own, h1 included.
  it("shows the page's own header, with only the count line as a placeholder", async () => {
    const { unmount } = await renderPlaces();
    const loadedTitle = screen.getByRole('heading', { level: 1 }).textContent;
    expect(loadedTitle).toBeTruthy();
    unmount();

    render(<PlacesLoading />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(loadedTitle ?? '');
    expect(heading.closest('.page-header')).not.toBeNull();
    // The header is the page's, not part of what is loading; the count needs the data.
    expect(screen.getByRole('status', { name: 'Loading places' })).not.toContainElement(heading);
    expect(screen.queryByText(/locations? visited/)).not.toBeInTheDocument();
  });

  it('lays its cards out in the same grid as the loaded page', async () => {
    const { unmount } = await renderPlaces();
    const loadedClass = placePageLinks()[0]?.closest('.grid')?.className;
    expect(loadedClass).toBeTruthy();
    unmount();

    render(<PlacesLoading />);
    const skeletonGrid = screen
      .getByRole('status', { name: 'Loading places' })
      .querySelector('.grid');

    expect(skeletonGrid?.className).toBe(loadedClass);
    expect(skeletonGrid?.children.length).toBeGreaterThan(0);
  });
});

describe('/places client islands', () => {
  const SRC_DIR = path.resolve(__dirname, '../../../src');
  const PLACES_DIR = path.join(SRC_DIR, 'app/(routes)/(main)/(personal)/places');
  const ISLANDS = [
    '_components/places-explorer.tsx',
    '[placeId]/_components/place-photo-viewer.tsx',
  ];
  /** Imports that would put @sanity/client (and the image URL builder) in the browser bundle. */
  const SERVER_SIDE_IMPORT =
    /from '(@\/lib\/sanity\/client|@\/lib\/sanity\/loaders|[^']*viewer-photo-url)'/;
  const PLACES_IMPORT =
    /from '(\.{1,2}\/[^']+|@\/app\/\(routes\)\/\(main\)\/\(personal\)\/places\/[^']+)'/g;
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
});
