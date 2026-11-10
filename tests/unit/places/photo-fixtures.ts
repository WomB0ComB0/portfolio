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
 * @file Synthetic data and device stubs for the /places/photos component tests: photo places,
 * wall photos (Sanity CDN URLs on the test project, as the server builds them), and a matchMedia
 * that answers the fine-pointer, reduced-motion and phone queries as a test asks, and can change
 * its answers later (a phone rotated, a window zoomed), telling the 'change' listeners whose
 * query flipped. Not a test file.
 */

import { vi } from 'vitest';

import { COMPACT_QUERY } from '@/app/(routes)/(main)/(personal)/places/photos/_lib/dialog-layout';
import { FINE_POINTER } from '@/hooks/use-fine-pointer';
import { REDUCED_MOTION_QUERY } from '@/lib/design/motion';
import type { PhotoPlace, WallPhoto } from '@/types/places';

export { COMPACT_QUERY };

const CATEGORIES = ['Hackathon', 'Conference', 'Tech Office'] as const;

/** A past place with `photoCount` photos. */
export const makePhotoPlace = (n: number, photoCount: number): PhotoPlace => ({
  id: `place-${n}`,
  name: n === 0 ? 'Antler NYC' : `Visited ${n}`,
  description: `What happened at place ${n}.`,
  category: CATEGORIES[n % CATEGORIES.length] ?? 'Event',
  startDate: '2026-05-19',
  endDate: n % 2 === 0 ? '2026-05-20' : null,
  photoCount,
});

/** The photos of `places`, numbered within each place, the first of each captioned. */
export const photosOf = (places: readonly PhotoPlace[]): WallPhoto[] =>
  places.flatMap((place) =>
    Array.from({ length: place.photoCount }, (_, offset) => ({
      key: `${place.id}:${offset + 1}`,
      placeId: place.id,
      index: offset + 1,
      caption: offset === 0 ? `First at ${place.name}` : null,
      ratio: offset % 3 === 1 ? 0.75 : 4 / 3,
      focus: offset === 0 ? { x: 0.3, y: 0.2 } : null,
      thumb: `https://cdn.sanity.io/images/test/test/${place.id}-${offset}-1600x1200.jpg?h=360&fit=max`,
      full: `https://cdn.sanity.io/images/test/test/${place.id}-${offset}-1600x1200.jpg?w=1600&fit=max`,
    })),
  );

/** `count` places of `each` photos, and their photos. */
export function photoData(count: number, each: number) {
  const places = Array.from({ length: count }, (_, n) => makePhotoPlace(n, each));
  return { places, photos: photosOf(places) };
}

/** The places by id, as the view takes them. */
export const byId = (places: readonly PhotoPlace[]): ReadonlyMap<string, PhotoPlace> =>
  new Map(places.map((place) => [place.id, place]));

export interface DeviceStub {
  readonly fine?: boolean;
  readonly reduced?: boolean;
  readonly compact?: boolean;
}

export interface DeviceControl {
  /** Becomes `next`: every 'change' listener of a query whose answer flipped is told. */
  readonly become: (next: DeviceStub) => void;
}

type MediaListener = (event: { readonly matches: boolean; readonly media: string }) => void;

/** Whether `device` matches `query`. */
const answers = (device: DeviceStub, query: string): boolean =>
  (query === FINE_POINTER && Boolean(device.fine)) ||
  (query === REDUCED_MOTION_QUERY && Boolean(device.reduced)) ||
  (query === COMPACT_QUERY && Boolean(device.compact));

/**
 * Answers matchMedia as the given device, and becomes another on `become`; undo with
 * vi.unstubAllGlobals().
 */
export function stubDevice(initial: DeviceStub): DeviceControl {
  let device = initial;
  const listeners = new Set<{ readonly query: string; readonly listener: MediaListener }>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return answers(device, query);
    },
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: (_type: string, listener: MediaListener) => {
      listeners.add({ query, listener });
    },
    removeEventListener: (_type: string, listener: MediaListener) => {
      for (const entry of listeners) if (entry.listener === listener) listeners.delete(entry);
    },
    dispatchEvent: () => false,
  }));
  return {
    become: (next) => {
      const before = device;
      device = next;
      for (const { query, listener } of [...listeners]) {
        const matches = answers(next, query);
        if (matches !== answers(before, query)) listener({ matches, media: query });
      }
    },
  };
}

/** The decoded `url` param of a /_next/image src. */
export const sourceOf = (src: string | null): string =>
  new URL(src ?? '', 'http://localhost').searchParams.get('url') ?? '';
