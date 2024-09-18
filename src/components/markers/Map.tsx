'use client';

import { env } from '@/env';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import type { Marker } from '@googlemaps/markerclusterer';
import { APIProvider, AdvancedMarker, Map, useMap } from '@vis.gl/react-google-maps';
import { useEffect, useRef, useState } from 'react';
import { MapStyles, places } from 'src/data/places';

export default function GoogleMaps() {
  return (
    <section
      style={{
        height: '100vh',
        width: '100%',
      }}
    >
      <APIProvider apiKey={env.GOOGLE_MAPS_API_KEY}>
        <Map
          center={{ lat: 40.73061, lng: -73.935242 }}
          zoom={10}
          mapId={env.GOOGLE_MAPS_MAP_ID}
          zoomControl={true}
          fullscreenControl={false}
          styles={MapStyles}
        >
          <Markers points={points} />
        </Map>
      </APIProvider>
    </section>
  );
}

const points: Point[] = places.map(([key, lat, lng]) => ({ key, lat, lng }));
type Point = google.maps.LatLngLiteral & { key: string };
type Props = { points: Point[] };

const Markers = ({ points }: Props) => {
  const map = useMap();
  const [markers, setMarkers] = useState<{ [key: string]: Marker }>({});
  const clusterer = useRef<MarkerClusterer | null>(null);

  useEffect(() => {
    if (!map) return;
    if (!clusterer.current) {
      clusterer.current = new MarkerClusterer({ map });
    }
  }, [map]);

  useEffect(() => {
    clusterer.current?.clearMarkers();
    clusterer.current?.addMarkers(Object.values(markers));
  }, [markers]);

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
      {points.map((point) => (
        <AdvancedMarker
          position={point}
          key={point.key}
          ref={(marker) => setMarkerRef(marker, point.key)}
        >
          <span style={{ fontSize: '2rem' }}>📍</span>
        </AdvancedMarker>
      ))}
    </>
  );
};
