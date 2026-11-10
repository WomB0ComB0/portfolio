'use client';

/**
 * Copyright 2026 Mike Odnis
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
 * @file "Places | Photos": the two views of the past places, /places (the map and the cards) and
 * /places/photos (every photo). Two plain links, so the switch works without JavaScript, each
 * carrying the current search and category (the same URL rule on both paths, nothing else). It
 * sits at the end of the results header, inside the FilterBar's Provider, and reads its state.
 */

import Link from 'next/link';
import type { ReactElement } from 'react';

import { useFilterBar } from '@/components/console/filter-bar/context';
import { placeFilters, placePhotoFilters, placeStateOf } from '../_lib/place-filters';
import styles from './places-view-nav.module.css';

export type PlacesView = 'places' | 'photos';

export interface PlacesViewNavProps {
  /** The page it is on, marked with aria-current. */
  readonly current: PlacesView;
}

/** The two views, in order, with the schema that writes each one's link. */
const VIEWS = [
  { view: 'places', label: 'Places', schema: placeFilters },
  { view: 'photos', label: 'Photos', schema: placePhotoFilters },
] as const;

/** The segmented switch between the places list and the photos view, filters carried across. */
export function PlacesViewNav({ current }: PlacesViewNavProps): ReactElement {
  const state = placeStateOf(useFilterBar().model.active);
  return (
    <nav aria-label="Places views" className={styles.nav} data-places-views="">
      {VIEWS.map(({ view, label, schema }) => (
        <Link
          key={view}
          href={schema.serialize(state)}
          className={styles.link}
          aria-current={view === current ? 'page' : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
