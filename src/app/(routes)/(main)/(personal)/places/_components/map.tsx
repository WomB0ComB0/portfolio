'use client';

/// <reference types="@types/google.maps" />

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

import { MarkerClusterer, type onClusterClickHandler } from '@googlemaps/markerclusterer';
import { APIProvider, InfoWindow, useMap, Map as VisGLMap } from '@vis.gl/react-google-maps';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { FiCamera, FiInfo, FiMapPin, FiX } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import type { PlaceItem } from '@/types/places';
import type { GoogleMapsProps, MarkersComponentProps } from './map.types';
import './map.css';

/**
 * MarkerClusterer's own cluster click handling calls `marker.addListener('gmp-click')`, which Maps
 * deprecates for AdvancedMarkerElement. `null` skips it (the option type has no "off" value); the
 * cluster renderer below adds the same zoom-to-bounds through `addEventListener`.
 */
const SKIP_BUILT_IN_CLUSTER_CLICK = null as unknown as onClusterClickHandler;

/**
 * Lifts the place card above its marker. A module constant, because vis.gl's InfoWindow closes and
 * reopens whenever this array's identity changes.
 */
const PLACE_CARD_OFFSET: [number, number] = [0, -40];

export const GoogleMaps = ({ placesToDisplay }: GoogleMapsProps) => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

  if (!apiKey || !mapId) {
    return (
      <section className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
        <div className="p-4 text-center">
          <FiMapPin className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Google Maps is not configured.</p>
        </div>
      </section>
    );
  }

  // Fills the box the page gives it: places.tsx sets the height, matching its loading skeleton.
  return (
    <section className="places-map relative h-full w-full overflow-hidden rounded-lg">
      <APIProvider apiKey={apiKey} libraries={['marker']}>
        <VisGLMap
          defaultCenter={{ lat: 40.73061, lng: -73.935242 }}
          defaultZoom={4}
          mapId={mapId}
          // A map ID (required for advanced markers) makes Maps ignore `styles`. The dark color
          // scheme uses the map ID's dark style, or Google's default dark style if none is linked.
          colorScheme="DARK"
          gestureHandling={'greedy'}
          disableDefaultUI={true}
        >
          <Markers placesToDisplay={placesToDisplay} />
        </VisGLMap>
      </APIProvider>
    </section>
  );
};

const Markers = ({ placesToDisplay }: MarkersComponentProps) => {
  const map = useMap();
  const [activeMarker, setActiveMarker] = useState<PlaceItem | null>(null);
  const clusterer = useRef<MarkerClusterer | null>(null);
  const markers = useRef<{ [key: string]: google.maps.marker.AdvancedMarkerElement }>({});

  // Escape on the map, or with nothing focused, closes the place card. Inside the card Google
  // handles Escape itself (see the InfoWindow's onClose). An Escape another widget already
  // consumed (a dropdown) or aimed elsewhere on the page (the command palette) is left alone.
  useEffect(() => {
    if (!activeMarker) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const { target } = event;
      const onMapOrPage =
        target === document.body || (target instanceof Node && map?.getDiv().contains(target));
      if (onMapOrPage) setActiveMarker(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [activeMarker, map]);

  useEffect(() => {
    if (!map) return;

    setActiveMarker(null);

    if (!clusterer.current) {
      clusterer.current = new MarkerClusterer({
        map,
        onClusterClick: SKIP_BUILT_IN_CLUSTER_CLICK,
        renderer: {
          render: ({ count, position, bounds }, _stats, clusterMap) => {
            const clusterElement = document.createElement('div');
            clusterElement.className =
              'flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/50 bg-primary text-sm font-bold text-primary-foreground shadow-lg';
            clusterElement.textContent = String(count);
            const clusterMarker = new google.maps.marker.AdvancedMarkerElement({
              position,
              content: clusterElement,
              zIndex: 1000 + count,
              title: `${count} places`,
              gmpClickable: true,
            });
            clusterMarker.addEventListener('gmp-click', () => {
              if (bounds) clusterMap.fitBounds(bounds);
            });
            return clusterMarker;
          },
        },
      });
    }

    clusterer.current.clearMarkers();
    markers.current = {};

    for (const place of placesToDisplay) {
      const markerElement = document.createElement('div');
      markerElement.className =
        'flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/30 bg-primary/80 shadow-md backdrop-blur-sm';
      markerElement.innerHTML = `<svg stroke="currentColor" fill="white" stroke-width="0" viewBox="0 0 16 16" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"></path></svg>`;

      const advancedMarker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: place.latitude, lng: place.longitude },
        content: markerElement,
        title: place.name,
        // Clickable advanced markers also get keyboard focus and Enter/Space activation.
        gmpClickable: true,
      });

      advancedMarker.addEventListener('gmp-click', () => {
        setActiveMarker(place);
      });

      markers.current[place.id] = advancedMarker;
    }

    clusterer.current.addMarkers(Object.values(markers.current));

    return () => {
      clusterer.current?.clearMarkers();
    };
  }, [map, placesToDisplay]);

  return (
    <>
      {activeMarker && (
        <InfoWindow
          // One InfoWindow per place: moving to another place remounts it, instead of vis.gl's
          // close-and-reopen of a single window (which fires 'close'). So onClose only sees real
          // closes, including the ones Google makes itself: Escape with focus in the card (where
          // open() puts it), and auto-closing it when one of its point-of-interest windows opens.
          key={activeMarker.id}
          position={{ lat: activeMarker.latitude, lng: activeMarker.longitude }}
          pixelOffset={PLACE_CARD_OFFSET}
          // Google's header row only holds its close button; the card has its own, so the
          // header's white band goes. map.css turns the rest of Google's chrome transparent.
          headerDisabled
          onClose={() => setActiveMarker(null)}
        >
          {/* font-sans: the card sits inside Google's .gm-style, which sets Roboto. */}
          <div className="places-card relative w-64 rounded-lg border border-primary/50 bg-(--places-infowindow-bg) p-4 font-sans text-white backdrop-blur-md">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setActiveMarker(null)}
              className="absolute right-2 top-2 rounded-md p-1 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <FiX className="h-4 w-4" aria-hidden="true" />
            </button>
            <h3 className="mb-1 pr-6 text-base font-bold text-primary">{activeMarker.name}</h3>
            <p className="mb-2 text-xs leading-normal text-neutral-400">{activeMarker.category}</p>
            <p className="line-clamp-3 mb-4 text-sm leading-snug text-neutral-300">
              {activeMarker.description}
            </p>

            {/* With or without photos, the place page has the full description. */}
            <Button asChild size="sm" className="w-full">
              <Link href={`/places/${activeMarker.id}`}>
                {activeMarker.photos && activeMarker.photos.length > 0 ? (
                  <>
                    <FiCamera className="h-4 w-4" aria-hidden="true" />
                    View Photos ({activeMarker.photos.length})
                  </>
                ) : (
                  <>
                    <FiInfo className="h-4 w-4" aria-hidden="true" />
                    View Details
                  </>
                )}
              </Link>
            </Button>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

GoogleMaps.displayName = 'GoogleMaps';
export default GoogleMaps;
