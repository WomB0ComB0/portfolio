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

'use client';

import type { Marker } from '@googlemaps/markerclusterer';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { AdvancedMarker, APIProvider, InfoWindow, Map, useMap } from '@vis.gl/react-google-maps';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { FaMapMarkerAlt } from 'react-icons/fa';
import { MapStyles } from 'src/data/places';
import { config } from '@/config';
import type { PlaceItem } from '@/types/places';

/**
 * Props for the GoogleMaps component.
 * @interface GoogleMapsProps
 * @property {PlaceItem[]} placesToDisplay - Array of place items to display as markers.
 * @author Mike Odnis
 * @readonly
 * @version 1.0.0
 */
interface GoogleMapsProps {
  placesToDisplay: PlaceItem[];
}

/**
 * Renders an interactive Google Map displaying markers for places.
 * Handles API key validation, configures APIProvider and renders map styles
 * and markers via the Markers component. Shows informational message if configuration missing.
 *
 * @function
 * @param {GoogleMapsProps} props - The props object containing places to display on the map.
 * @returns {JSX.Element} Google Maps view or fallback notice.
 * @throws {Error} Throws if API key/Map config are missing (renders UI warning instead).
 * @example
 * <GoogleMaps placesToDisplay={[{ id, name, ... }]} />
 * @web
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @see https://developers.google.com/maps/documentation
 * @see https://github.com/visgl/react-google-maps
 * @public
 * @version 1.0.0
 */
export const GoogleMaps = ({ placesToDisplay }: GoogleMapsProps) => {
  if (!config.google.maps.apiKey) {
    return (
      <section className="relative flex h-[400px] w-full items-center justify-center overflow-hidden rounded-lg bg-muted md:h-[500px] lg:h-[600px]">
        <div className="p-4 text-center">
          <FaMapMarkerAlt className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">
            Google Maps is not configured. Please add your API key to display the map.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative h-[400px] w-full overflow-hidden rounded-lg md:h-[500px] lg:h-[600px]">
      <APIProvider apiKey={config.google.maps.apiKey}>
        <Map
          defaultCenter={{ lat: 40.73061, lng: -73.935242 }}
          defaultZoom={4}
          mapId={config.google.maps.mapId}
          gestureHandling={'greedy'}
          disableDefaultUI={true}
          styles={MapStyles}
        >
          <Markers placesToDisplay={placesToDisplay} />
        </Map>
      </APIProvider>
    </section>
  );
}

/**
 * Props for the Markers component.
 * @typedef {object} MarkersComponentProps
 * @property {PlaceItem[]} placesToDisplay - Array of places to render as markers.
 * @readonly
 * @author Mike Odnis
 * @version 1.0.0
 */
type MarkersComponentProps = { placesToDisplay: PlaceItem[] };

/**
 * Handles marker and marker cluster rendering on the Google Map.
 * Manages marker state, active marker focus, cluster rendering, and InfoWindows.
 *
 * @param {MarkersComponentProps} props - The props object containing places to display.
 * @returns {JSX.Element} Markers and dynamic InfoWindow routing.
 * @throws {Error} Throws if Google Maps script errors or clustering fails.
 * @example
 * <Markers placesToDisplay={[{ id, latitude, longitude, ... }]} />
 * @web
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @see https://developers.google.com/maps/documentation/javascript/marker-clustering
 * @see https://github.com/googlemaps/js-markerclusterer
 * @public
 * @version 1.0.0
 */
const Markers = ({ placesToDisplay }: MarkersComponentProps) => {
  const map = useMap();
  const [markers, setMarkers] = useState<{ [key: string]: Marker }>({});
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const clusterer = useRef<MarkerClusterer | null>(null);

  /**
   * Initializes marker clustering for the map.
   *
   * @private
   * @returns {void}
   * @author Mike Odnis
   * @see https://developers.google.com/maps/documentation/javascript/marker-clustering
   */
  useEffect(() => {
    if (!map) return;
    if (!clusterer.current) {
      clusterer.current = new MarkerClusterer({
        map,
        renderer: {
          render: ({ count, position }) => {
            const marker = new google.maps.marker.AdvancedMarkerElement({
              position,
              zIndex: 1000 + count,
            });

            const clusterIcon = document.createElement('div');
            clusterIcon.className = 'custom-cluster-icon';
            clusterIcon.style.cssText = `
              background-color: var(--primary);
              border: 2px solid var(--primary-foreground);
              border-radius: 50%;
              width: 40px;
              height: 40px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: var(--primary-foreground);
              font-size: 14px;
              font-weight: bold;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            `;
            clusterIcon.textContent = String(count);

            marker.content = clusterIcon;

            return marker;
          },
        },
      });
    }
  }, [map]);

  /**
   * Updates clusterer instance with current markers.
   * Clears and adds all markers as cluster items.
   *
   * @private
   * @returns {void}
   * @author Mike Odnis
   */
  useEffect(() => {
    clusterer.current?.clearMarkers();
    clusterer.current?.addMarkers(Object.values(markers));
  }, [markers]);

  /**
   * Handles refs to track marker instances for clustering.
   *
   * @param {Marker | null} marker - Reference to the Marker instance
   * @param {string} key - The unique place.id key
   * @returns {void}
   * @private
   * @author Mike Odnis
   */
  const setMarkerRef = (marker: Marker | null, key: string) => {
    if (marker && markers[key]) return;
    if (!marker && !markers[key]) return;

    setMarkers((prev) => {
      if (marker) {
        return { ...prev, [key]: marker };
      } else {
        const newMarkers = { ...prev };
        delete newMarkers[key];
        return newMarkers;
      }
    });
  };

  return (
    <>
      {placesToDisplay.map((place) => (
        <AdvancedMarker
          position={{ lat: place.latitude, lng: place.longitude }}
          key={place.id}
          ref={(marker) => setMarkerRef(marker, place.id)}
          onClick={() => setActiveMarker(place.id)}
        >
          <div className="rounded-full bg-primary/20 p-2 shadow-lg text-primary">
            <FaMapMarkerAlt size={20} />
          </div>
        </AdvancedMarker>
      ))}
      {activeMarker &&
        (() => {
          const activePlace = placesToDisplay.find((p) => p.id === activeMarker);
          if (!activePlace) return null;

          return (
            <InfoWindow
              position={{ lat: activePlace.latitude, lng: activePlace.longitude }}
              onCloseClick={() => setActiveMarker(null)}
              pixelOffset={[0, -30]}
            >
              <div className="max-w-xs rounded-lg border border-primary bg-card p-3 shadow-xl">
                <h3 className="mb-1 text-md font-semibold text-primary">{activePlace.name}</h3>
                <p className="mb-1 text-xs text-muted-foreground">{activePlace.category}</p>
                <p className="mb-2 line-clamp-3 text-sm text-foreground">
                  {activePlace.description}
                </p>
                {activePlace.photos &&
                activePlace.photos.length > 0 &&
                activePlace.photos[0]?.url ? (
                  <div className="relative mt-1 h-32 w-full">
                    <Image
                      src={activePlace.photos[0].url}
                      alt={activePlace.photos[0].caption || activePlace.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 320px"
                      className="rounded-md object-cover"
                      priority={false}
                      placeholder="empty"
                    />
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">No photo available.</p>
                )}
              </div>
            </InfoWindow>
          );
        })()}
    </>
  );
};
Markers.displayName = 'Markers';

GoogleMaps.displayName = 'GoogleMaps';
export default GoogleMaps;
