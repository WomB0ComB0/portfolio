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
 * @file axe on the /places list (audit 2026-11-20 #2 card titles as headings, #9 the Maps link
 * that says it opens a new tab, with its icons hidden, minor 6 "3 photos of …" names): the
 * explorer with its bar and its cards, places with and without photos. Google Maps is stood in
 * for, as places-page.test.tsx does: it needs a browser key and the network.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PlacesExplorer } from '@/app/(routes)/(main)/(personal)/places/_components/places-explorer';
import type { PlaceItem } from '@/types/places';
import { expectNoAxeViolations } from '../../utils/axe';
import { wideLayout } from '../console/filter-bar/wide-layout';

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/app/(routes)/(main)/(personal)/places/_components/map', () => {
  const GoogleMaps = ({ placesToDisplay }: { placesToDisplay: readonly PlaceItem[] }) => (
    <div>map of {placesToDisplay.length} places</div>
  );
  return { GoogleMaps, default: GoogleMaps };
});

const SLIVER = (n: number) =>
  `https://cdn.sanity.io/images/test/test/s${n}-1600x1200.jpg?w=96&h=64`;

const place = (n: number, category: string, slivers: readonly string[] = []): PlaceItem => ({
  id: `place-${n}`,
  name: `Visited ${n}`,
  description: `What happened at place ${n}, long enough that the card cuts it off after two lines.`,
  latitude: 40.7,
  longitude: -74,
  category,
  startDate: '2026-05-12',
  photoCount: slivers.length,
  slivers,
});

const PLACES: readonly PlaceItem[] = [
  place(1, 'Hackathon', [SLIVER(1), SLIVER(2), SLIVER(3)]),
  place(2, 'Conference', [SLIVER(4)]),
  place(3, 'Tech Office'),
];

let narrow: () => void;

beforeEach(() => {
  narrow = wideLayout();
});

afterEach(() => {
  cleanup();
  narrow();
});

describe('the /places list under axe', () => {
  it('finds nothing to fix in the bar and the cards, with and without photos', async () => {
    const { container } = render(
      <NuqsTestingAdapter searchParams="" hasMemory>
        <PlacesExplorer places={PLACES} />
      </NuqsTestingAdapter>,
    );

    // The render is the real list: a card per place, each titled by an h2.
    expect(screen.getByRole('list', { name: 'Places' }).children).toHaveLength(PLACES.length);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(PLACES.length);
    await expectNoAxeViolations(container, { label: 'the /places list' });
  });
});
