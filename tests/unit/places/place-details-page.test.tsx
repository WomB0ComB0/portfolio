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

import { act, render, screen } from '@testing-library/react';
import { type ReactNode, Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';

const FULL_DESCRIPTION =
  'A description long enough that the list card cuts it off, so this page is where it can be read in full.';

const h = vi.hoisted(() => ({ places: [] as unknown[] }));

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/hooks/sanity/use-sanity-suspense', () => ({
  useSanityPlaces: () => ({ data: h.places, isLoading: false }),
}));
// The site shell (navigation, command palette) plays no part here.
vi.mock('@/components/layout/layout', () => ({
  default: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock('@/lib/sanity/client', () => ({
  urlFor: () => {
    const builder = {
      width: () => builder,
      height: () => builder,
      url: () => 'https://cdn.sanity.io/images/test.jpg',
    };
    return builder;
  },
}));

import PlaceDetailsPage from '@/app/(routes)/(main)/(personal)/places/[placeId]/page';

h.places = [
  {
    _id: 'p1',
    _type: 'place',
    _createdAt: '2026-01-01T00:00:00Z',
    _updatedAt: '2026-01-01T00:00:00Z',
    _rev: 'r1',
    name: 'Quiet Place',
    description: FULL_DESCRIPTION,
    category: 'Conference',
    latitude: 40.75,
    longitude: -73.99,
    startDate: '2026-05-12',
    photos: null,
    order: 1,
    featured: false,
  },
];

/** The page suspends on `use(params)`; React only resumes it inside an awaited act(). */
async function renderPage(placeId: string) {
  await act(async () => {
    render(
      <Suspense fallback={<p>loading</p>}>
        <PlaceDetailsPage params={Promise.resolve({ placeId })} />
      </Suspense>,
    );
  });
}

describe('place page', () => {
  it('shows a place without photos in full, with an empty state instead of the viewer', async () => {
    await renderPage('p1');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Quiet Place' }),
    ).toBeInTheDocument();
    expect(screen.getByText(FULL_DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByText('Conference')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No photos yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute(
      'href',
      'https://maps.google.com/?q=40.75,-73.99',
    );
    expect(screen.getByRole('link', { name: 'Back to Places' })).toHaveAttribute('href', '/places');
  });

  it('says so when the place does not exist', async () => {
    await renderPage('missing');

    expect(await screen.findByRole('heading', { name: 'Place not found' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No photos yet' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Places' })).toHaveAttribute('href', '/places');
  });
});
