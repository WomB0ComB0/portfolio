
'use client';

import { config } from '@/config';
import type { PlaceItem } from '@/types/places';
import type { Marker } from '@googlemaps/markerclusterer';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { AdvancedMarker, APIProvider, InfoWindow, Map, useMap } from '@vis.gl/react-google-maps';
import { useEffect, useRef, useState } from 'react';
import { FaMapMarkerAlt } from 'react-icons/fa';
import { MapStyles } from 'src/data/places';

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
export default function GoogleMaps({ placesToDisplay }: GoogleMapsProps) {
  // Check if API key is available
  if (!config.google.maps.apiKey) {
    return (
      <section className="w-full h-[400px] md:h-[500px] lg:h-[600px] relative rounded-lg overflow-hidden bg-muted flex items-center justify-center">
        <div className="text-center p-4">
          <FaMapMarkerAlt className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">
            Google Maps is not configured. Please add your API key to display the map.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full h-[400px] md:h-[500px] lg:h-[600px] relative rounded-lg overflow-hidden">
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
          <div className="text-[#560BAD] bg-[#ba9bdd] p-2 rounded-full shadow-lg">
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

