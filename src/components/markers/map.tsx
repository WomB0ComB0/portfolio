'use client';

import { MarkerClusterer } from '@googlemaps/markerclusterer';
import type { Marker } from '@googlemaps/markerclusterer';
import { APIProvider, AdvancedMarker, InfoWindow, Map, useMap } from '@vis.gl/react-google-maps';
import { useEffect, useRef, useState } from 'react';
import { FaMapMarkerAlt } from 'react-icons/fa';
// Removed: import { places } from 'src/data/places';
import { MapStyles } from 'src/data/places'; // Keep MapStyles import
import { PlaceItem } from '@/types/places';

interface GoogleMapsProps { // Renamed for clarity, this is for the main component
  placesToDisplay: PlaceItem[];
}

export default function GoogleMaps({ placesToDisplay }: GoogleMapsProps) { // Accept placesToDisplay as prop
  return (
    <section className="w-full h-[400px] md:h-[500px] lg:h-[600px] relative rounded-lg overflow-hidden">
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
        <Map
          defaultCenter={{ lat: 40.73061, lng: -73.935242 }} // Center can be dynamic based on placesToDisplay if needed
          defaultZoom={4} // Zoom can also be dynamic
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
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

const Markers = ({ placesToDisplay }: MarkersComponentProps) => { // Use the new type name
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
      {placesToDisplay.map((place) => ( // Iterate over placesToDisplay
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
      ))}
      {activeMarker && (() => { // IIFE to allow early return if activePlace not found
        const activePlace = placesToDisplay.find(p => p.id === activeMarker);
        if (!activePlace) return null;

        return (
          <InfoWindow
            position={{ lat: activePlace.latitude, lng: activePlace.longitude }} // Use activePlace properties
            onCloseClick={() => setActiveMarker(null)}
            pixelOffset={{ width: 0, height: -30 }} // Adjust InfoWindow position slightly
          >
            <div className="bg-[#1E1E1E] text-[#ba9bdd] p-3 rounded-lg shadow-xl max-w-xs border border-purple-700">
              <h3 className="text-md font-semibold mb-1 text-purple-300">{activePlace.name}</h3>
              <p className="text-xs text-gray-400 mb-1">{activePlace.category}</p>
              <p className="text-sm text-gray-300 mb-2 line-clamp-3">{activePlace.description}</p>
              {activePlace.photos && activePlace.photos.length > 0 && activePlace.photos[0].url ? (
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
