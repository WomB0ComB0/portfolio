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

/**
 * An array of Google Maps style definitions for customizing the appearance of the map in the portfolio project.
 *
 * This style configuration provides a dark visual theme optimized for user readability and aesthetics,
 * including colors for roads, water, parks, points of interest, and administrative areas.
 * Use this constant when initializing a Google Map instance's `styles` property to apply the visual theme.
 *
 * @readonly
 * @public
 * @type {readonly google.maps.MapTypeStyle[]}
 * @web
 * @see {@link https://developers.google.com/maps/documentation/javascript/style-reference Google Maps Style Reference}
 * @see {@link https://github.com/WomB0ComB0/portfolio GitHub portfolio project}
 * @version 1.0.0
 * @author Mike Odnis
 *
 * @example
 * import { MapStyles } from './src/data/places';
 * new google.maps.Map(document.getElementById('map') as HTMLElement, {
 *   center: { lat: 40.7128, lng: -74.006 },
 *   zoom: 12,
 *   styles: MapStyles
 * });
 */
export const MapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#242424' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242424' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#ba9bdd' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#ba9bdd' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#ba9bdd' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#2a2a2a' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#560BAD' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#38414e' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#212a37' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#ba9bdd' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#560BAD' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#242424' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#ba9bdd' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2f3948' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#ba9bdd' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#1c1c1c' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#ba9bdd' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#242424' }],
  },
] as const satisfies google.maps.MapTypeStyle[];
