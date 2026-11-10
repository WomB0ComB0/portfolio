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
import { MAIN_CONTENT_ID } from '@/components/animations/pages/page-transition';
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

/**
 * The places map: a dark map with a clustered marker per place given, or a note when the
 * Maps key or map ID is missing. It never centres on a place or asks where the visitor is.
 */
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

  // Fills the box the page gives it: the explorer's map tile sets the height.
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
          // The map sits between the filters and the cards and fills most of a short screen
          // under the sticky bar, so a swipe or a wheel turn over it scrolls the page: two
          // fingers pan it, Ctrl/Cmd + wheel zooms it, and Google's own hint says so. The
          // keyboard and a cluster's click still move it.
          gestureHandling="cooperative"
          disableDefaultUI={true}
        >
          <Markers placesToDisplay={placesToDisplay} />
        </VisGLMap>
      </APIProvider>
    </section>
  );
};

/** A place's marker, and the place object it was built for (reused while that object is the same). */
interface PlaceMarker {
  readonly place: PlaceItem;
  readonly marker: google.maps.marker.AdvancedMarkerElement;
}

/**
 * A cluster: the brand disc with its count in the brand's ink, ringed in the canvas so it reads
 * as cut out of the map where markers crowd. Palette only: no white alphas and no glass (a blur
 * per marker would be redrawn on every frame of a pan).
 */
const CLUSTER_CLASS =
  'flex h-10 w-10 items-center justify-center rounded-full border-2 border-canvas bg-primary text-sm font-semibold text-primary-foreground shadow-tile';
/** A place: the same disc, smaller, with a pin drawn in the brand's ink (currentColor). */
const MARKER_CLASS =
  'flex h-8 w-8 items-center justify-center rounded-full border-2 border-canvas bg-primary text-primary-foreground shadow-tile';
/**
 * The place card on the map: a surface-1 tile like the bar's and the map's, edged in the brand,
 * raised over the map, with no glass. map.css paints Google's tail to match. 16rem wide, or
 * narrower where Google caps its panel (220px on a 390 phone's map), since it clips past that.
 */
const PLACE_CARD_CLASS =
  'places-card relative w-64 max-w-full rounded-tile border border-(--brand-edge) bg-surface-1 p-4 font-sans text-foreground shadow-raised';
/** The card's close button: faint, lifting to the foreground on a surface-2 wash. */
const PLACE_CARD_CLOSE_CLASS =
  'absolute right-2 top-2 rounded-md p-1 text-faint transition-[color,background-color] duration-(--motion-fast) ease-effect hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus';
/** The pin inside a place's marker. */
const PIN_SVG =
  '<svg aria-hidden="true" stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 16 16" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"></path></svg>';

/** The clusterer, each cluster a counted circle that zooms to its bounds on a click. */
function createClusterer(map: google.maps.Map): MarkerClusterer {
  return new MarkerClusterer({
    map,
    onClusterClick: SKIP_BUILT_IN_CLUSTER_CLICK,
    renderer: {
      render: ({ count, position, bounds }, _stats, clusterMap) => {
        const clusterElement = document.createElement('div');
        clusterElement.className = CLUSTER_CLASS;
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

/** A place's marker, titled with its name; a click (or Enter or Space on it) opens its card. */
function placeMarker(
  place: PlaceItem,
  open: (place: PlaceItem) => void,
): google.maps.marker.AdvancedMarkerElement {
  const markerElement = document.createElement('div');
  markerElement.className = MARKER_CLASS;
  markerElement.innerHTML = PIN_SVG;

  const advancedMarker = new google.maps.marker.AdvancedMarkerElement({
    position: { lat: place.latitude, lng: place.longitude },
    content: markerElement,
    title: place.name,
    // Clickable advanced markers also get keyboard focus and Enter/Space activation.
    gmpClickable: true,
  });
  advancedMarker.addEventListener('gmp-click', () => open(place));
  return advancedMarker;
}

/**
 * The markers for `places`, in their order: a place's cached marker while it is the same object
 * (the list re-renders as you type, with the same places), else a new one.
 */
function reuseMarkers(
  cache: ReadonlyMap<string, PlaceMarker>,
  places: readonly PlaceItem[],
  open: (place: PlaceItem) => void,
): ReadonlyMap<string, PlaceMarker> {
  return new Map(
    places.map((place) => {
      const cached = cache.get(place.id);
      const kept = cached?.place === place ? cached : { place, marker: placeMarker(place, open) };
      return [place.id, kept] as const;
    }),
  );
}

/**
 * The places' markers in the clusterer, and the open place's card: kept open while its place is
 * on the map, closed by its own button, by Google, or by Escape on the page or the map.
 */
const Markers = ({ placesToDisplay }: MarkersComponentProps) => {
  const map = useMap();
  const [activeMarker, setActiveMarker] = useState<PlaceItem | null>(null);
  const clusterer = useRef<MarkerClusterer | null>(null);
  const markers = useRef<ReadonlyMap<string, PlaceMarker>>(new Map());

  // Escape on the map, or with nothing focused, closes the place card. "Nothing focused" is the
  // body or the page's <main>, which a click on page content focuses (its tabindex=-1 is there for
  // the skip link). Inside the card Google handles Escape itself (see the InfoWindow's onClose).
  // An Escape another widget already consumed (a dropdown) or aimed elsewhere on the page (the
  // command palette) is left alone.
  useEffect(() => {
    if (!activeMarker) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const { target } = event;
      const onPage =
        target === document.body || (target instanceof Element && target.id === MAIN_CONTENT_ID);
      const onMap = target instanceof Node && map?.getDiv().contains(target);
      if (onPage || onMap) setActiveMarker(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [activeMarker, map]);

  // On unmount the map keeps no markers, and none are kept for a later mount.
  useEffect(
    () => () => {
      clusterer.current?.clearMarkers();
      markers.current = new Map();
    },
    [],
  );

  // Shows exactly the places given, building a marker only for a place not shown before (the
  // list re-renders as you type). Nothing moves: no fitBounds and no centring on any place. The
  // open card stays open while its place is still on the map, as the place given now; it closes
  // once its place is filtered out.
  useEffect(() => {
    if (!map) return;
    setActiveMarker((open) =>
      open ? (placesToDisplay.find((place) => place.id === open.id) ?? null) : null,
    );
    clusterer.current ??= createClusterer(map);
    markers.current = reuseMarkers(markers.current, placesToDisplay, setActiveMarker);
    clusterer.current.clearMarkers(true);
    clusterer.current.addMarkers([...markers.current.values()].map(({ marker }) => marker));
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
          <div className={PLACE_CARD_CLASS}>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setActiveMarker(null)}
              className={PLACE_CARD_CLOSE_CLASS}
            >
              <FiX className="h-4 w-4" aria-hidden="true" />
            </button>
            <h3 className="mb-1 pr-6 text-base font-semibold text-primary">{activeMarker.name}</h3>
            <p className="mb-2 text-xs leading-normal text-muted-foreground">
              {activeMarker.category}
            </p>
            <p className="line-clamp-3 mb-4 text-sm leading-snug text-muted-foreground">
              {activeMarker.description}
            </p>

            {/* With or without photos, the place page has the full description. */}
            <Button asChild size="sm" className="w-full">
              <Link href={`/places/${activeMarker.id}`}>
                {activeMarker.photoCount > 0 ? (
                  <>
                    <FiCamera className="h-4 w-4" aria-hidden="true" />
                    View Photos ({activeMarker.photoCount})
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
