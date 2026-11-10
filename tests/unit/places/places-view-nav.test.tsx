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
 * @file The "Places | Photos" switch between /places and /places/photos: two plain links (so it
 * works without JavaScript) that carry the current q and category both ways, the current page
 * marked with aria-current. Nothing else enters the URL.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { PlacesViewNav } from '@/app/(routes)/(main)/(personal)/places/_components/places-view-nav';
import { placeFilters } from '@/app/(routes)/(main)/(personal)/places/_lib/place-filters';
import { FilterBar, useUrlFilters } from '@/components/console/filter-bar';

/** The nav inside a model read from the URL, as the explorers give it. */
function Harness({ current }: { readonly current: 'places' | 'photos' }): ReactElement {
  const { model } = useUrlFilters(placeFilters, []);
  return (
    <FilterBar.Provider model={model}>
      <PlacesViewNav current={current} />
    </FilterBar.Provider>
  );
}

const withUrl = (search: string, current: 'places' | 'photos') => (
  <NuqsTestingAdapter searchParams={search}>
    <Harness current={current} />
  </NuqsTestingAdapter>
);

const nav = () => screen.getByRole('navigation', { name: 'Places views' });

afterEach(cleanup);

describe('PlacesViewNav', () => {
  it('links both views, with the current one marked', () => {
    render(withUrl('', 'places'));

    const places = within(nav()).getByRole('link', { name: 'Places' });
    const photos = within(nav()).getByRole('link', { name: 'Photos' });
    expect(places).toHaveAttribute('href', '/places');
    expect(places).toHaveAttribute('aria-current', 'page');
    expect(photos).toHaveAttribute('href', '/places/photos');
    expect(photos).not.toHaveAttribute('aria-current');
  });

  it('carries the search and the category both ways', () => {
    render(withUrl('?q=antler&category=Tech%20Office', 'photos'));

    expect(within(nav()).getByRole('link', { name: 'Places' })).toHaveAttribute(
      'href',
      '/places?category=tech-office&q=antler',
    );
    const photos = within(nav()).getByRole('link', { name: 'Photos' });
    expect(photos).toHaveAttribute('href', '/places/photos?category=tech-office&q=antler');
    expect(photos).toHaveAttribute('aria-current', 'page');
  });

  it('drops anything else in the URL', () => {
    render(withUrl('?view=wall&photo=x&category=bogus', 'photos'));

    expect(within(nav()).getByRole('link', { name: 'Places' })).toHaveAttribute('href', '/places');
  });

  it('renders its links on the server, for a visit without JavaScript', () => {
    const html = renderToString(withUrl('?category=hackathon', 'places'));

    expect(html).toContain('aria-label="Places views"');
    expect(html).toContain('href="/places/photos?category=hackathon"');
    expect(html).toContain('aria-current="page"');
  });
});
