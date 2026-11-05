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

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlaceCard } from '@/app/(routes)/(main)/(personal)/places/_components/place-card';
import type { PlaceItem } from '@/types/places';

const place = (photos: PlaceItem['photos']): PlaceItem => ({
  id: 'p1',
  name: 'Test Place',
  description: 'A description long enough that the card cuts it off after two lines.',
  latitude: 40.7,
  longitude: -74,
  category: 'Hackathon',
  startDate: '2026-05-12',
  photos,
});

describe('PlaceCard', () => {
  it('links to the photos when the place has some', () => {
    render(
      <PlaceCard
        place={place([
          { url: 'https://cdn.sanity.io/images/a.jpg' },
          { url: 'https://cdn.sanity.io/images/b.jpg' },
        ])}
      />,
    );

    expect(screen.getByRole('link', { name: 'View Photos (2) for Test Place' })).toHaveAttribute(
      'href',
      '/places/p1',
    );
    expect(screen.queryByRole('link', { name: /View Details/ })).not.toBeInTheDocument();
  });

  it('still links to the place page without photos, where the full description is', () => {
    render(<PlaceCard place={place([])} />);

    expect(screen.getByRole('link', { name: 'View Details for Test Place' })).toHaveAttribute(
      'href',
      '/places/p1',
    );
    expect(screen.queryByRole('link', { name: /View Photos/ })).not.toBeInTheDocument();
  });

  it('puts a pending spinner inside the place page link, and none in the Maps link', () => {
    render(<PlaceCard place={place([])} />);

    const spinnersIn = (link: HTMLElement) =>
      Array.from(link.querySelectorAll('span[aria-hidden="true"]')).filter((span) =>
        span.className.includes('data-[pending]'),
      );
    expect(
      spinnersIn(screen.getByRole('link', { name: 'View Details for Test Place' })),
    ).toHaveLength(1);
    expect(spinnersIn(screen.getByRole('link', { name: /^Test Place/ }))).toHaveLength(0);
  });

  it('opens the location in Google Maps from the card header', () => {
    render(<PlaceCard place={place([])} />);

    expect(screen.getByRole('link', { name: /^Test Place/ })).toHaveAttribute(
      'href',
      'https://maps.google.com/?q=40.7,-74',
    );
  });
});
