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

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlaceCard } from '@/app/(routes)/(main)/(personal)/places/_components/place-card';
import type { PlaceItem } from '@/types/places';

const SLIVER = (n: number) =>
  `https://cdn.sanity.io/images/test/test/s${n}-1600x1200.jpg?w=96&h=64`;

const place = (photoCount: number, slivers: readonly string[] = []): PlaceItem => ({
  id: 'p1',
  name: 'Test Place',
  description: 'A description long enough that the card cuts it off after two lines.',
  latitude: 40.7,
  longitude: -74,
  category: 'Hackathon',
  startDate: '2026-05-12',
  photoCount,
  slivers,
});

const spinnersIn = (link: HTMLElement) =>
  Array.from(link.querySelectorAll('span[aria-hidden="true"]')).filter((span) =>
    span.className.includes('data-[pending]'),
  );

afterEach(cleanup);

describe('PlaceCard', () => {
  it('links to the photos through the quiet folder when the place has some', () => {
    const { container } = render(<PlaceCard place={place(2, [SLIVER(1), SLIVER(2)])} />);

    expect(screen.getByRole('link', { name: '2 photos of Test Place' })).toHaveAttribute(
      'href',
      '/places/p1',
    );
    expect(container.querySelectorAll('[data-photo-folder] img')).toHaveLength(2);
    expect(screen.queryByRole('link', { name: /^Details/ })).not.toBeInTheDocument();
  });

  it('still links to the place page without photos, where the full description is', () => {
    const { container } = render(<PlaceCard place={place(0)} />);

    expect(screen.getByRole('link', { name: 'Details of Test Place' })).toHaveAttribute(
      'href',
      '/places/p1',
    );
    expect(container.querySelector('[data-photo-folder]')).toBeNull();
    expect(screen.queryByRole('link', { name: /photos? of/ })).not.toBeInTheDocument();
  });

  it('puts a pending spinner inside the place page link, and none in the Maps link', () => {
    render(<PlaceCard place={place(0)} />);

    expect(spinnersIn(screen.getByRole('link', { name: 'Details of Test Place' }))).toHaveLength(1);
    expect(spinnersIn(screen.getByRole('link', { name: /^Test Place/ }))).toHaveLength(0);
  });

  it('opens the location in Google Maps from the card header, with the title and description', () => {
    render(<PlaceCard place={place(1, [SLIVER(1)])} />);
    const maps = screen.getByRole('link', { name: /^Test Place/ });

    expect(maps).toHaveAttribute('href', 'https://maps.google.com/?q=40.7,-74');
    expect(maps).toHaveTextContent('A description long enough');
    expect(screen.getByRole('link', { name: '1 photo of Test Place' })).toBeInTheDocument();
  });
});
