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
 * @file The photos grid: the first view on touch, before JavaScript and without it. Every photo
 * is a real link to its past place's page (so it works with no script), upgraded to the open
 * view on a plain left click only; a modified or middle click still opens the place. Each link
 * has a name of its own. The first 48 show, then "Show all" reveals the rest and focuses the 49th.
 * Thumbnails are lazy, sized for two columns on a phone and 240 px cards wider.
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PhotoGrid } from '@/app/(routes)/(main)/(personal)/places/photos/_components/photo-grid';
import { byId, makePhotoPlace, photoData, photosOf, sourceOf } from './photo-fixtures';

const GRID_FIRST = 48;
const { places, photos } = photoData(12, 5);
const PLACES = byId(places);

const links = () => within(screen.getByRole('list', { name: 'Photos' })).getAllByRole('link');

afterEach(cleanup);

describe('PhotoGrid', () => {
  it('shows the first 48, then Show all reveals the rest and focuses the 49th', () => {
    const onOpen = vi.fn();
    render(<PhotoGrid photos={photos} places={PLACES} onOpen={onOpen} enhance />);

    expect(links()).toHaveLength(GRID_FIRST);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 60 photos' }));

    expect(links()).toHaveLength(60);
    expect(document.activeElement).toBe(links()[GRID_FIRST]);
    expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
  });

  it("keeps the hover light outside the photo's clip, so its halo is never cut off", () => {
    render(<PhotoGrid photos={photos.slice(0, 3)} places={PLACES} onOpen={vi.fn()} enhance />);
    const frame = links()[0]?.querySelector('[data-grid-frame]');
    const img = frame?.querySelector('img');
    const clip = img?.parentElement;
    const light = frame?.lastElementChild;

    expect(clip).not.toBe(frame);
    expect(clip?.parentElement).toBe(frame);
    expect(light).not.toBe(clip);
    expect(light?.contains(img ?? null)).toBe(false);
    expect(clip?.contains(light ?? null)).toBe(false);
  });

  it("links each photo to its place's page, with a name of its own", () => {
    const special = { ...makePhotoPlace(99, 2), id: 'a b/c' };
    const all = [...photos.slice(0, 10), ...photosOf([special])];
    render(<PhotoGrid photos={all} places={byId([...places, special])} onOpen={vi.fn()} enhance />);

    const names = links().map((link) => link.textContent ?? '');
    expect(new Set(names).size).toBe(names.length);
    expect(links().at(-1)).toHaveAttribute('href', '/places/a%20b%2Fc');
    expect(links()[0]).toHaveAttribute('href', `/places/${photos[0]?.placeId}`);
    expect(
      screen.getByRole('link', { name: /^Antler NYC.*photo 1 of 5: First at Antler NYC$/ }),
    ).toBe(links()[0]);
  });

  it('opens the view on a plain left click, and lets a modified or middle click navigate', () => {
    const onOpen = vi.fn();
    render(<PhotoGrid photos={photos} places={PLACES} onOpen={onOpen} enhance />);
    const [first] = links();
    if (!first) throw new Error('no link');

    expect(fireEvent.click(first, { button: 0 })).toBe(false);
    expect(onOpen).toHaveBeenCalledTimes(1);
    const [request] = onOpen.mock.calls[0] ?? [];
    expect(request.photo).toBe(photos[0]);
    expect(request.returnFocus).toBe(first);
    expect(request.source).toHaveAttribute('data-grid-frame');

    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }]) {
      expect(fireEvent.click(first, init)).toBe(true);
    }
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('leaves every click to the link when the open view is unavailable', () => {
    const onOpen = vi.fn();
    render(<PhotoGrid photos={photos} places={PLACES} onOpen={onOpen} enhance={false} />);

    expect(fireEvent.click(links()[0] as HTMLElement)).toBe(true);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('draws lazy thumbnails of the cover URL, sized for the grid', () => {
    const { container } = render(
      <PhotoGrid photos={photos} places={PLACES} onOpen={vi.fn()} enhance />,
    );
    const img = container.querySelector('img');

    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('sizes', '(max-width: 639px) 50vw, 240px');
    expect(img?.getAttribute('fetchpriority')).not.toBe('high');
    expect(sourceOf(img?.getAttribute('src') ?? '')).toBe(photos[0]?.thumb);
    expect(img?.getAttribute('style')).toContain('object-position: 30% 20%');
  });

  it('renders the grid and the no-script note on the server', () => {
    const html = renderToStaticMarkup(
      <PhotoGrid photos={photos} places={PLACES} onOpen={vi.fn()} enhance={false} />,
    );

    expect(html.match(/<li/g)).toHaveLength(GRID_FIRST);
    expect(html).toContain('Showing 48 of 60. Open a place for all of its photos');
  });

  it('shows no Show all and no note when every photo fits', () => {
    render(<PhotoGrid photos={photos.slice(0, 20)} places={PLACES} onOpen={vi.fn()} enhance />);

    expect(links()).toHaveLength(20);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing 48 of/)).not.toBeInTheDocument();
  });
});
