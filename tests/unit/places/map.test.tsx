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
import type { PlaceItem } from '@/types/places';

type Props = Record<string, unknown> & { children?: ReactNode };

const h = vi.hoisted(() => ({
  mapProps: null as Record<string, unknown> | null,
  infoWindowProps: null as Record<string, unknown> | null,
  clustererOptions: null as Record<string, unknown> | null,
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
    addMarkers = vi.fn();
    clearMarkers = vi.fn();
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
  photos: [],
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
