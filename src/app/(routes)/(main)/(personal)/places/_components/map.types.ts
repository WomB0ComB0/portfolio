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

import type { PlaceItem } from '@/types/places';

/**
 * Props for the GoogleMaps component.
 * @interface GoogleMapsProps
 * @property {PlaceItem[]} placesToDisplay - Array of place items to display as markers.
 * @author Mike Odnis
 * @readonly
 * @version 1.0.0
 */
export interface GoogleMapsProps {
  placesToDisplay: PlaceItem[];
}

/**
 * Props for the Markers component.
 * @typedef {object} MarkersComponentProps
 * @property {PlaceItem[]} placesToDisplay - Array of places to render as markers.
 * @readonly
 * @author Mike Odnis
 * @version 1.0.0
 */
export type MarkersComponentProps = { placesToDisplay: PlaceItem[] };
