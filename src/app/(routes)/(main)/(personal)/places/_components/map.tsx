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

import { Button } from '@/components/ui/button';
import { darkMapStyle } from '@/data/places';
import type { PlaceItem } from '@/types/places';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { APIProvider, InfoWindow, Map as VisGLMap, useMap } from '@vis.gl/react-google-maps';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { FiCamera, FiMapPin } from 'react-icons/fi';
import type { GoogleMapsProps, MarkersComponentProps } from './map.types';

export const GoogleMaps = ({ placesToDisplay }: GoogleMapsProps) => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

  if (!apiKey || !mapId) {
    return (
      <section className="relative flex h-[400px] w-full items-center justify-center overflow-hidden rounded-lg bg-muted md:h-[500px] lg:h-[600px]">
        <div className="p-4 text-center">
          <FiMapPin className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Google Maps is not configured.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative h-[400px] w-full overflow-hidden rounded-lg md:h-[500px] lg:h-[600px]">
      <APIProvider apiKey={apiKey} libraries={['marker']}>
        <VisGLMap
          defaultCenter={{ lat: 40.73061, lng: -73.935242 }}
          defaultZoom={4}
          mapId={mapId}
          styles={darkMapStyle}
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

  useEffect(() => {
    if (!map) return;

    if (!clusterer.current) {
      clusterer.current = new MarkerClusterer({
        map,
        renderer: {
          render: ({ count, position }) => {
            const clusterElement = document.createElement('div');
            clusterElement.className =
              'flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/50 bg-primary text-sm font-bold text-primary-foreground shadow-lg';
            clusterElement.textContent = String(count);
            return new google.maps.marker.AdvancedMarkerElement({
              position,
              content: clusterElement,
              zIndex: 1000 + count,
            });
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
        map,
        content: markerElement,
        title: place.name,
      });

      advancedMarker.addEventListener('click', () => {
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
          position={{ lat: activeMarker.latitude, lng: activeMarker.longitude }}
          onCloseClick={() => setActiveMarker(null)}
          pixelOffset={[0, -40]}
        >
          <div className="w-64 rounded-lg border border-primary/50 bg-neutral-900/80 p-4 text-white shadow-2xl backdrop-blur-md">
            <h3 className="mb-1 text-base font-bold text-primary">{activeMarker.name}</h3>
            <p className="mb-2 text-xs text-neutral-400">{activeMarker.category}</p>
            <p className="line-clamp-3 mb-4 text-sm text-neutral-300">{activeMarker.description}</p>

            {activeMarker.photos && activeMarker.photos.length > 0 ? (
              <Button asChild size="sm" className="w-full">
                <Link href={`/places/${activeMarker.id}`}>
                  <FiCamera className="mr-2 h-4 w-4" />
                  View Photos ({activeMarker.photos.length})
                </Link>
              </Button>
            ) : (
              <p className="text-center text-xs text-neutral-500">No photos available.</p>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
};

GoogleMaps.displayName = 'GoogleMaps';
export default GoogleMaps;
