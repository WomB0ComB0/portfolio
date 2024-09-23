'use client';

import { MarkerClusterer } from '@googlemaps/markerclusterer';
import type { Marker } from '@googlemaps/markerclusterer';
import { APIProvider, AdvancedMarker, InfoWindow, Map, useMap } from '@vis.gl/react-google-maps';
import { useEffect, useRef, useState } from 'react';
import { FaMapMarkerAlt } from 'react-icons/fa';
import { MapStyles, places } from 'src/data/places';

export default function GoogleMaps() {
  return (
    <section className="w-full h-[400px] md:h-[500px] lg:h-[600px] relative rounded-lg overflow-hidden">
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
        <Map
          defaultCenter={{ lat: 40.73061, lng: -73.935242 }}
          defaultZoom={4}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
          gestureHandling={'greedy'}
          disableDefaultUI={true}
          styles={MapStyles}
        >
          <Markers places={places} />
        </Map>
      </APIProvider>
    </section>
  );
}
type Props = { places: typeof places };

const Markers = ({ places }: Props) => {
  const map = useMap();
  const [markers, setMarkers] = useState<{ [key: string]: Marker }>({});
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const clusterer = useRef<MarkerClusterer | null>(null);

  useEffect(() => {
    if (!map) return;
    if (!clusterer.current) {
      clusterer.current = new MarkerClusterer({
        map,
        renderer: {
          render: ({ count, position }) =>
            new google.maps.Marker({
              label: { text: String(count), color: '#242424', fontSize: '12px' },
              position,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 20,
                fillColor: '#560BAD',
                fillOpacity: 0.9,
                strokeColor: '#ba9bdd',
                strokeWeight: 2,
              },
              zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
            }),
        },
      });
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
      {places.map(([name, description, lat, lng]) => (
        <AdvancedMarker
          position={{ lat, lng }}
          key={name}
          ref={(marker) => setMarkerRef(marker, name)}
          onClick={() => setActiveMarker(name)}
        >
          <div className="text-[#560BAD] bg-[#ba9bdd] p-2 rounded-full shadow-lg">
            <FaMapMarkerAlt size={20} />
          </div>
        </AdvancedMarker>
      ))}
      {activeMarker && (
        <InfoWindow
          position={{
            lat: places.find(([name]) => name === activeMarker)?.[2] || 0,
            lng: places.find(([name]) => name === activeMarker)?.[3] || 0,
          }}
          onCloseClick={() => setActiveMarker(null)}
        >
          <div className="bg-[#242424] text-[#ba9bdd] p-4 rounded-lg shadow-lg max-w-xs">
            <h3 className="text-lg font-bold mb-2">{activeMarker}</h3>
            <p className="text-sm">{places.find(([name]) => name === activeMarker)?.[1]}</p>
          </div>
        </InfoWindow>
      )}
    </>
  );
};
