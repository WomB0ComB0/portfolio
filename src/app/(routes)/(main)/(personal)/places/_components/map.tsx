'use client';

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

import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { APIProvider, InfoWindow, useMap, Map as VisGLMap } from '@vis.gl/react-google-maps';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { FaMapMarkerAlt } from 'react-icons/fa';
// import { MapStyles } from 'src/data/places';
import { config } from '@/config';
import type { PlaceItem } from '@/types/places';
import type { GoogleMapsProps, MarkersComponentProps } from './map.types';
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
      <APIProvider apiKey={config.google.maps.apiKey} libraries={['marker']}>
        <VisGLMap
          defaultCenter={{ lat: 40.73061, lng: -73.935242 }}
          defaultZoom={4}
          mapId={config.google.maps.mapId}
          gestureHandling={'greedy'}
          disableDefaultUI={true}
          // styles={MapStyles}
        >
          <Markers placesToDisplay={placesToDisplay} />
        </VisGLMap>
      </APIProvider>
    </section>
  );
};
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
  const [activeMarker, setActiveMarker] = useState<PlaceItem | null>(null);
  const clusterer = useRef<MarkerClusterer | null>(null);
  const markers = useRef<{ [key: string]: google.maps.marker.AdvancedMarkerElement }>({});

  // Effect to initialize and update the MarkerClusterer
  useEffect(() => {
    if (!map) return;

    // Initialize the clusterer if it doesn't exist
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

    // Clear existing markers from the clusterer and our ref
    clusterer.current.clearMarkers();
    markers.current = {};

    // Create new markers for the places to display
    for (const place of placesToDisplay) {
      const markerElement = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: place.latitude, lng: place.longitude },
        map, // Assign the map instance directly
        content: createMarkerContent(), // Use a helper to create the marker's HTML
      });

      markerElement.addEventListener('click', () => {
        setActiveMarker(place);
      });

      markers.current[place.id] = markerElement;
    }

    // Add the new markers to the clusterer
    clusterer.current.addMarkers(Object.values(markers.current));

    // Cleanup function to remove markers when component unmounts
    return () => {
      clusterer.current?.clearMarkers();
    };
  }, [map, placesToDisplay]);

  // Helper function to create the marker icon content
  const createMarkerContent = () => {
    const container = document.createElement('div');
    container.className = 'rounded-full bg-primary/20 p-2 shadow-lg text-primary';
    container.innerHTML = `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 384 512" height="20" width="20" xmlns="http://www.w3.org/2000/svg"><path d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67a24 24 0 0 1-35.464 0zM192 256c35.346 0 64-28.654 64-64s-28.654-64-64-64-64 28.654-64 64 28.654 64 64 64z"></path></svg>`;
    return container;
  };

  // The component now only renders the InfoWindow, as markers are managed imperatively.
  return (
    <>
      {activeMarker && (
        <InfoWindow
          position={{
            lat: activeMarker.latitude,
            lng: activeMarker.longitude,
          }}
          onCloseClick={() => setActiveMarker(null)}
          pixelOffset={[0, -40]} // Adjust offset for the new marker style
        >
          <div className="max-w-xs rounded-lg border border-primary bg-card p-3 shadow-xl">
            <h3 className="mb-1 text-md font-semibold text-primary">{activeMarker.name}</h3>
            <p className="mb-1 text-xs text-muted-foreground">{activeMarker.category}</p>
            <p className="mb-2 line-clamp-3 text-sm text-foreground">{activeMarker.description}</p>
            {activeMarker.photos &&
            activeMarker.photos.length > 0 &&
            activeMarker.photos[0]?.url ? (
              <div className="relative mt-1 h-32 w-full">
                <Image
                  src={activeMarker.photos[0].url}
                  alt={activeMarker.photos[0].caption || activeMarker.name}
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
      )}
    </>
  );
};
Markers.displayName = 'Markers';

GoogleMaps.displayName = 'GoogleMaps';
export default GoogleMaps;
