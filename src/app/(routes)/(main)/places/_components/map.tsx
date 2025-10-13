'use client';

import type { Marker } from '@googlemaps/markerclusterer';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { AdvancedMarker, APIProvider, InfoWindow, Map, useMap } from '@vis.gl/react-google-maps';
import { useEffect, useRef, useState } from 'react';
import { FaMapMarkerAlt } from 'react-icons/fa';
import { MapStyles } from 'src/data/places';
import { config } from '@/config';
import type { PlaceItem } from '@/types/places';

interface GoogleMapsProps {
  placesToDisplay: PlaceItem[];
}

export default function GoogleMaps({ placesToDisplay }: GoogleMapsProps) {
  return (
    <section className="w-full h-[400px] md:h-[500px] lg:h-[600px] relative rounded-lg overflow-hidden">
      <APIProvider apiKey={config.google.maps.apiKey}>
        <Map
          defaultCenter={{ lat: 40.73061, lng: -73.935242 }} // Center can be dynamic based on placesToDisplay if needed
          defaultZoom={4} // Zoom can also be dynamic
          mapId={config.google.maps.mapId}
          gestureHandling={'greedy'}
          disableDefaultUI={true}
          styles={MapStyles}
        >
          <Markers placesToDisplay={placesToDisplay} /> {/* Pass prop down */}
        </Map>
      </APIProvider>
    </section>
  );
}

type MarkersComponentProps = { placesToDisplay: PlaceItem[] }; // Type for Markers component's props

const Markers = ({ placesToDisplay }: MarkersComponentProps) => {
  // Use the new type name
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
          render: ({ count, position }) => {
            const marker = new google.maps.marker.AdvancedMarkerElement({
              position,
              zIndex: 1000 + count,
            });

            const clusterIcon = document.createElement('div');
            clusterIcon.className = 'custom-cluster-icon';
            clusterIcon.style.cssText = `
              background-color: #560BAD;
              border: 2px solid #ba9bdd;
              border-radius: 50%;
              width: 40px;
              height: 40px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
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
      {placesToDisplay.map(
        (
          place, // Iterate over placesToDisplay
        ) => (
          <AdvancedMarker
            position={{ lat: place.latitude, lng: place.longitude }} // Use place properties
            key={place.id} // Use place.id as key
            ref={(marker) => setMarkerRef(marker, place.id)} // Use place.id for ref key
            onClick={() => setActiveMarker(place.id)} // Use place.id for active marker
          >
            <div className="text-[#560BAD] bg-[#ba9bdd] p-2 rounded-full shadow-lg">
              <FaMapMarkerAlt size={20} />
            </div>
          </AdvancedMarker>
        ),
      )}
      {activeMarker &&
        (() => {
          const activePlace = placesToDisplay.find((p) => p.id === activeMarker);
          if (!activePlace) return null;

          return (
            <InfoWindow
              position={{ lat: activePlace.latitude, lng: activePlace.longitude }} // Use activePlace properties
              onCloseClick={() => setActiveMarker(null)}
              pixelOffset={[0, -30]}
            >
              <div className="bg-[#1E1E1E] text-[#ba9bdd] p-3 rounded-lg shadow-xl max-w-xs border border-purple-700">
                <h3 className="text-md font-semibold mb-1 text-purple-300">{activePlace.name}</h3>
                <p className="text-xs text-gray-400 mb-1">{activePlace.category}</p>
                <p className="text-sm text-gray-300 mb-2 line-clamp-3">{activePlace.description}</p>
                {activePlace.photos &&
                activePlace.photos.length > 0 &&
                activePlace.photos[0]?.url ? (
                  <img
                    src={activePlace.photos[0].url}
                    alt={activePlace.photos[0].caption || activePlace.name}
                    className="w-full h-auto rounded-md max-h-32 object-cover mt-1"
                  />
                ) : (
                  <p className="text-xs text-gray-500 mt-1">No photo available.</p>
                )}
              </div>
            </InfoWindow>
          );
        })()}
    </>
  );
};
