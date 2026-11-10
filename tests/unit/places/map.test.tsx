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

import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAIN_CONTENT_ID } from '@/components/animations/pages/page-transition';
import type { PlaceItem } from '@/types/places';

type Props = Record<string, unknown> & { children?: ReactNode };

const h = vi.hoisted(() => ({
  mapProps: null as Record<string, unknown> | null,
  infoWindowProps: null as Record<string, unknown> | null,
  clustererOptions: null as Record<string, unknown> | null,
  clusteredMarkers: [] as unknown[],
  fakeMap: {
    fitBounds: vi.fn(),
    getDiv: () => document.querySelector('[data-testid="map"]') as HTMLElement,
  },
  markers: [] as Array<{
    options: Record<string, unknown>;
    listened: string[];
    addListener: ReturnType<typeof vi.fn>;
    dispatchEvent: (event: Event) => boolean;
  }>,
}));

vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: Props) => children,
  Map: (props: Props) => {
    h.mapProps = props;
    return <div data-testid="map">{props.children}</div>;
  },
  useMap: () => h.fakeMap,
  InfoWindow: (props: Props) => {
    h.infoWindowProps = props;
    return <div data-testid="info-window">{props.children}</div>;
  },
}));

// Styles Google's InfoWindow DOM, which the mocks don't render; Vite can't run the Tailwind
// PostCSS config here anyway.
vi.mock('@/app/(routes)/(main)/(personal)/places/_components/map.css', () => ({}));

vi.mock('@googlemaps/markerclusterer', () => ({
  MarkerClusterer: class {
    addMarkers = vi.fn((markers: unknown[]) => {
      h.clusteredMarkers.push(...markers);
    });
    // The clusterer then holds no markers, as the real one does.
    clearMarkers = vi.fn(() => {
      h.clusteredMarkers.length = 0;
    });
    constructor(options: Record<string, unknown>) {
      h.clustererOptions = options;
    }
  },
}));

/** Stands in for google.maps.marker.AdvancedMarkerElement and records how it is listened to. */
class FakeAdvancedMarker extends EventTarget {
  listened: string[] = [];
  addListener = vi.fn();
  options: Record<string, unknown>;
  constructor(options: Record<string, unknown>) {
    super();
    this.options = options;
    h.markers.push(this);
  }
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ) {
    this.listened.push(type);
    super.addEventListener(type, listener, options);
  }
}

import { GoogleMaps } from '@/app/(routes)/(main)/(personal)/places/_components/map';

const place = (id: string, name: string): PlaceItem => ({
  id,
  name,
  description: `${name} description`,
  latitude: 40.7,
  longitude: -74,
  category: 'Hackathon',
  photoCount: 0,
  slivers: [],
});

const PLACES = [place('p1', 'First Place'), place('p2', 'Second Place')];

function clickMarker(index: number) {
  act(() => {
    h.markers[index]?.dispatchEvent(new Event('gmp-click'));
  });
}

describe('places map', () => {
  beforeEach(() => {
    h.mapProps = null;
    h.infoWindowProps = null;
    h.clustererOptions = null;
    h.clusteredMarkers.length = 0;
    h.markers.length = 0;
    h.fakeMap.fitBounds.mockClear();
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'test-key');
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID', 'test-map-id');
    vi.stubGlobal('google', { maps: { marker: { AdvancedMarkerElement: FakeAdvancedMarker } } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses Google's dark color scheme, since styles are ignored when a map ID is set", () => {
    render(<GoogleMaps placesToDisplay={PLACES} />);

    expect(h.mapProps).toMatchObject({ mapId: 'test-map-id', colorScheme: 'DARK' });
    expect(h.mapProps).not.toHaveProperty('styles');
  });

  it('makes place markers keyboard-clickable through gmp-click, not the deprecated click events', () => {
    render(<GoogleMaps placesToDisplay={PLACES} />);

    expect(h.markers).toHaveLength(2);
    expect(h.clusteredMarkers).toEqual(h.markers);
    for (const marker of h.markers) {
      expect(marker.options).toMatchObject({ gmpClickable: true });
      expect(marker.listened).toEqual(['gmp-click']);
      expect(marker.addListener).not.toHaveBeenCalled();
    }
  });

  it('opens a header-less info window for the clicked place and moves it to the next one', () => {
    render(<GoogleMaps placesToDisplay={PLACES} />);

    clickMarker(0);
    expect(screen.getByRole('heading', { name: 'First Place' })).toBeInTheDocument();
    expect(h.infoWindowProps).toMatchObject({ headerDisabled: true });

    clickMarker(1);
    expect(screen.getByRole('heading', { name: 'Second Place' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'First Place' })).not.toBeInTheDocument();
  });

  it('links the card to the place page, with or without photos', () => {
    const photoPlace = {
      ...place('p3', 'Photo Place'),
      photoCount: 1,
      slivers: ['https://cdn.sanity.io/images/a.jpg'],
    };
    render(<GoogleMaps placesToDisplay={[...PLACES, photoPlace]} />);

    clickMarker(0);
    expect(screen.getByRole('link', { name: 'View Details' })).toHaveAttribute(
      'href',
      '/places/p1',
    );
    expect(screen.queryByText('No photos available.')).not.toBeInTheDocument();

    clickMarker(2);
    expect(screen.getByRole('link', { name: 'View Photos (1)' })).toHaveAttribute(
      'href',
      '/places/p3',
    );
  });

  it('closes the info window from its own close button', () => {
    render(<GoogleMaps placesToDisplay={PLACES} />);
    clickMarker(0);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByTestId('info-window')).not.toBeInTheDocument();
  });

  it('clears the selection whenever Google closes the card itself, so the same place reopens', () => {
    render(<GoogleMaps placesToDisplay={PLACES} />);
    clickMarker(0);

    // Google closes the window on its own for Escape inside the card, and when one of its
    // point-of-interest windows opens; both fire 'close'.
    const onClose = h.infoWindowProps?.onClose;
    expect(onClose).toBeTypeOf('function');
    act(() => {
      (onClose as () => void)();
    });
    expect(screen.queryByTestId('info-window')).not.toBeInTheDocument();

    clickMarker(0);
    expect(screen.getByRole('heading', { name: 'First Place' })).toBeInTheDocument();
  });

  it('closes the info window with Escape on the page or on the map', () => {
    render(<GoogleMaps placesToDisplay={PLACES} />);

    clickMarker(0);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByTestId('info-window')).not.toBeInTheDocument();

    clickMarker(0);
    fireEvent.keyDown(screen.getByTestId('map'), { key: 'Escape' });
    expect(screen.queryByTestId('info-window')).not.toBeInTheDocument();
  });

  it('leaves the card open for an Escape meant for another widget', () => {
    render(<GoogleMaps placesToDisplay={PLACES} />);
    clickMarker(0);

    // Aimed at a control outside the map (e.g. the category filter or the command palette).
    const outside = document.createElement('input');
    document.body.append(outside);
    fireEvent.keyDown(outside, { key: 'Escape' });
    outside.remove();
    expect(screen.getByTestId('info-window')).toBeInTheDocument();

    // Already handled by a widget that called preventDefault (e.g. a Radix dropdown).
    const consume = (event: Event) => event.preventDefault();
    document.addEventListener('keydown', consume, { capture: true });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    document.removeEventListener('keydown', consume, { capture: true });
    expect(screen.getByTestId('info-window')).toBeInTheDocument();
  });

  describe("inside the page's <main>", () => {
    // The page's <main> has tabindex=-1 so the skip link can focus it, which also lets a click on
    // page content focus it. An Escape pressed after that click targets <main>, not the body.
    const renderInPage = () =>
      render(
        <main id={MAIN_CONTENT_ID} tabIndex={-1}>
          <h1>Places</h1>
          <GoogleMaps placesToDisplay={PLACES} />
        </main>,
      );

    it('closes the card on Escape after a click on page content has focused <main>', () => {
      renderInPage();
      clickMarker(0);
      const main = screen.getByRole('main');
      main.focus();
      expect(main).toHaveFocus();

      fireEvent.keyDown(main, { key: 'Escape' });

      expect(screen.queryByTestId('info-window')).not.toBeInTheDocument();
    });

    it('still leaves the card open for an Escape aimed at a control inside <main>', () => {
      renderInPage();
      clickMarker(0);
      const filter = document.createElement('input');
      screen.getByRole('main').append(filter);

      fireEvent.keyDown(filter, { key: 'Escape' });

      expect(screen.getByTestId('info-window')).toBeInTheDocument();
    });
  });

  describe('when the places it is given change', () => {
    // The list filters as you type, so the map is given new arrays often. A marker is built once
    // per place and kept; the open card stays open while its place is still on the map.
    const THIRD = place('p3', 'Third Place');

    it('builds no new markers and keeps the card open for a new array of the same places', () => {
      const { rerender } = render(<GoogleMaps placesToDisplay={PLACES} />);
      clickMarker(0);
      const built = [...h.markers];

      rerender(<GoogleMaps placesToDisplay={[...PLACES]} />);

      expect(h.markers).toEqual(built);
      expect(h.clusteredMarkers).toEqual(built);
      expect(screen.getByRole('heading', { name: 'First Place' })).toBeInTheDocument();
    });

    it('keeps the card and its marker while the open place stays, dropping only the others', () => {
      const { rerender } = render(<GoogleMaps placesToDisplay={[...PLACES, THIRD]} />);
      clickMarker(0);
      const [first, , third] = h.markers;

      rerender(<GoogleMaps placesToDisplay={[PLACES[0] as PlaceItem, THIRD]} />);

      expect(h.markers).toHaveLength(3);
      expect(h.clusteredMarkers).toEqual([first, third]);
      expect(screen.getByRole('heading', { name: 'First Place' })).toBeInTheDocument();
    });

    it('closes the card once its place is no longer on the map', () => {
      const { rerender } = render(<GoogleMaps placesToDisplay={PLACES} />);
      clickMarker(0);

      rerender(<GoogleMaps placesToDisplay={[PLACES[1] as PlaceItem]} />);

      expect(screen.queryByTestId('info-window')).not.toBeInTheDocument();
      expect(h.clusteredMarkers).toEqual([h.markers[1]]);
    });

    it('builds a marker only for a place it has not shown before, and reuses the rest', () => {
      const { rerender } = render(<GoogleMaps placesToDisplay={[PLACES[0] as PlaceItem]} />);
      expect(h.markers).toHaveLength(1);

      rerender(<GoogleMaps placesToDisplay={[...PLACES, THIRD]} />);

      expect(h.markers).toHaveLength(3);
      expect(h.clusteredMarkers).toEqual(h.markers);
      expect(h.markers.map((marker) => marker.options.title)).toEqual([
        'First Place',
        'Second Place',
        'Third Place',
      ]);
    });

    it('builds a new marker for a place that comes back as a new object', () => {
      const { rerender } = render(<GoogleMaps placesToDisplay={PLACES} />);

      rerender(<GoogleMaps placesToDisplay={[{ ...(PLACES[0] as PlaceItem), name: 'Renamed' }]} />);

      expect(h.markers).toHaveLength(3);
      expect(h.clusteredMarkers).toEqual([h.markers[2]]);
      expect(h.markers[2]?.options.title).toBe('Renamed');
    });
  });

  it('lets the page scroll past the map: two fingers or Ctrl/Cmd + wheel move it', () => {
    render(<GoogleMaps placesToDisplay={PLACES} />);

    // Greedy handling turned every swipe and wheel turn over the map into a pan or zoom, and the
    // map fills most of a short screen under the sticky bar.
    expect(h.mapProps).toMatchObject({ gestureHandling: 'cooperative' });
  });

  describe('on the palette only (no white alphas, no glass)', () => {
    /** Off-palette pieces the markers and the card used to carry. */
    const OFF_PALETTE =
      /\b(?:text|bg|border|ring|fill|stroke)-(?:white|black|neutral(?:-\d+)?)\b|backdrop-blur|\b(?:bg|text|border)-[a-z-]+\/\d+|font-bold/;
    const classesOf = (element: Element | null | undefined): string =>
      element?.getAttribute('class') ?? '';
    const renderCluster = (): FakeAdvancedMarker => {
      const renderer = h.clustererOptions?.renderer as {
        render: (cluster: unknown, stats: unknown, map: unknown) => FakeAdvancedMarker;
      };
      return renderer.render(
        { count: 3, position: { lat: 40.5, lng: -74 }, bounds: undefined },
        {},
        h.fakeMap,
      );
    };

    it('draws a place marker as a brand disc with a canvas ring and a pin in its ink', () => {
      render(<GoogleMaps placesToDisplay={PLACES} />);
      const content = h.markers[0]?.options.content as HTMLElement;

      expect(classesOf(content)).not.toMatch(OFF_PALETTE);
      expect(classesOf(content).split(' ')).toEqual(
        expect.arrayContaining(['bg-primary', 'text-primary-foreground', 'border-canvas']),
      );
      expect(content.querySelector('svg')?.getAttribute('fill')).toBe('currentColor');
    });

    it('draws a cluster the same way, its count in the brand ink', () => {
      render(<GoogleMaps placesToDisplay={PLACES} />);
      const content = renderCluster().options.content as HTMLElement;

      expect(content.textContent).toBe('3');
      expect(classesOf(content)).not.toMatch(OFF_PALETTE);
      expect(classesOf(content).split(' ')).toEqual(
        expect.arrayContaining(['bg-primary', 'text-primary-foreground', 'border-canvas']),
      );
    });

    it('puts the card on a surface tile, its text in the foreground tiers', () => {
      render(<GoogleMaps placesToDisplay={PLACES} />);
      clickMarker(0);
      const card = document.querySelector('.places-card');
      const close = screen.getByRole('button', { name: 'Close' });

      expect(classesOf(card)).not.toMatch(OFF_PALETTE);
      expect(classesOf(card).split(' ')).toEqual(
        expect.arrayContaining(['bg-surface-1', 'text-foreground', 'rounded-tile']),
      );
      // Google caps its panel at the room the map leaves (220px on a 390 phone) and clips past
      // it, so the card narrows to the panel instead of keeping 16rem.
      expect(classesOf(card).split(' ')).toEqual(expect.arrayContaining(['w-64', 'max-w-full']));
      expect(classesOf(close)).not.toMatch(OFF_PALETTE);
      expect(classesOf(close)).toContain('text-faint');
      for (const line of card?.querySelectorAll('p') ?? []) {
        expect(classesOf(line)).toContain('text-muted-foreground');
      }
    });
  });

  it("zooms into a clicked cluster without the clusterer's deprecated addListener wiring", () => {
    render(<GoogleMaps placesToDisplay={PLACES} />);

    // The clusterer only calls marker.addListener('gmp-click') when onClusterClick is set.
    expect(h.clustererOptions).toHaveProperty('onClusterClick', null);

    const renderer = h.clustererOptions?.renderer as {
      render: (cluster: unknown, stats: unknown, map: unknown) => FakeAdvancedMarker;
    };
    const bounds = { south: 40, west: -75, north: 41, east: -73 };
    const clusterMarker = renderer.render(
      { count: 3, position: { lat: 40.5, lng: -74 }, bounds },
      {},
      h.fakeMap,
    );

    expect(clusterMarker.options).toMatchObject({ gmpClickable: true });
    expect(clusterMarker.listened).toEqual(['gmp-click']);

    clusterMarker.dispatchEvent(new Event('gmp-click'));
    expect(h.fakeMap.fitBounds).toHaveBeenCalledWith(bounds);
  });
});
