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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
// The real URL builder, so the viewer test sees the URL the page actually requests.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});

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
  {
    _id: 'p2',
    _type: 'place',
    _createdAt: '2026-01-01T00:00:00Z',
    _updatedAt: '2026-01-01T00:00:00Z',
    _rev: 'r2',
    name: 'Photographed Place',
    description: FULL_DESCRIPTION,
    category: 'Hackathon',
    latitude: 40.75,
    longitude: -73.99,
    startDate: '2026-05-12',
    photos: [
      // A portrait first: the viewer must not crop it to the frame's shape.
      { _type: 'image', _key: 'a', asset: { _ref: 'image-a-3000x4000-jpg', _type: 'reference' } },
      { _type: 'image', _key: 'b', asset: { _ref: 'image-b-1600x1200-jpg', _type: 'reference' } },
    ],
    order: 2,
    featured: false,
  },
];

/**
 * The page suspends on `use(params)`; React only resumes it inside an awaited act(). The page's
 * error boundary resets queries on retry, so it needs a QueryClient, as every page has in the app.
 */
async function renderPage(placeId: string) {
  await act(async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Suspense fallback={<p>loading</p>}>
          <PlaceDetailsPage params={Promise.resolve({ placeId })} />
        </Suspense>
      </QueryClientProvider>,
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

  it('shows the photo viewer, under the same header, for a place with photos', async () => {
    await renderPage('p2');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Photographed Place' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Hackathon')).toBeInTheDocument();
    // The position text only renders in the viewer branch.
    expect(screen.getByText('Photo 1 of 2')).toBeInTheDocument();
    // The portrait is requested whole: sized by height, with no aspect-ratio crop (`rect=`).
    const src = decodeURIComponent(
      screen.getByRole('img', { name: 'Photo of Photographed Place' }).getAttribute('src') ?? '',
    );
    expect(src).toContain('h=1200');
    expect(src).not.toContain('rect=');
    expect(screen.getByRole('link', { name: 'Close photo viewer' })).toHaveAttribute(
      'href',
      '/places',
    );
    expect(screen.queryByRole('heading', { name: 'No photos yet' })).not.toBeInTheDocument();
  });

  it('says so when the place does not exist', async () => {
    await renderPage('missing');

    expect(await screen.findByRole('heading', { name: 'Place not found' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No photos yet' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Places' })).toHaveAttribute('href', '/places');
  });
});
