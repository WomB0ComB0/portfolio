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
 * @file The place card's quiet photo folder (the owner's "Keep B (quiet)"): a link to the place
 * page named "5 photos of <place>" ("1 photo of <place>"; "Details of <place>" with none), whose
 * decorative folder holds up to three slivers. Each sliver is a fixed-size next/image (two
 * candidates, 1x and 2x, no sizes) of its 96 x 64 crop. One pending spinner, since the place page
 * has no loading.tsx. Server-safe: no hooks of its own beyond the spinner's link status.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { PhotoFolder } from '@/app/(routes)/(main)/(personal)/places/_components/photo-folder';

const SLIVER = (n: number) =>
  `https://cdn.sanity.io/images/test/test/s${n}-1600x1200.jpg?rect=0,0,1600,1067&w=96&h=64&fit=crop&auto=format`;
const SLIVERS = [SLIVER(1), SLIVER(2), SLIVER(3)];

/** The decorative image `img`'s srcset candidates, as [decoded source, descriptor]. */
const candidates = (img: Element): [string, string][] =>
  (img.getAttribute('srcset') ?? '').split(', ').map((entry) => {
    const [url = '', descriptor = ''] = entry.split(' ');
    return [new URL(url, 'http://localhost').searchParams.get('url') ?? '', descriptor];
  });
const spinnersIn = (link: HTMLElement) =>
  Array.from(link.querySelectorAll('span[aria-hidden="true"]')).filter((span) =>
    span.className.includes('data-[pending]'),
  );

afterEach(cleanup);

describe('PhotoFolder', () => {
  it('names the link by the count and the place, and links to the place page', () => {
    render(<PhotoFolder href="/places/p1" count={5} slivers={SLIVERS} placeName="Antler NYC" />);

    expect(screen.getByRole('link', { name: '5 photos of Antler NYC' })).toHaveAttribute(
      'href',
      '/places/p1',
    );
  });

  it('says "1 photo" for one', () => {
    render(<PhotoFolder href="/places/p1" count={1} slivers={[SLIVER(1)]} placeName="X" />);

    expect(screen.getByRole('link', { name: '1 photo of X' })).toBeInTheDocument();
  });

  it('is a plain Details link, with no folder, for a place without photos', () => {
    const { container } = render(
      <PhotoFolder href="/places/p1" count={0} slivers={[]} placeName="X" />,
    );

    expect(screen.getByRole('link', { name: 'Details of X' })).toHaveAttribute(
      'href',
      '/places/p1',
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-photo-folder]')).toBeNull();
  });

  it('draws at most three slivers, decorative, inside a hidden folder', () => {
    const { container } = render(
      <PhotoFolder
        href="/places/p1"
        count={9}
        slivers={[...SLIVERS, SLIVER(4)]}
        placeName="Antler NYC"
      />,
    );
    const folder = container.querySelector('[data-photo-folder]');
    const images = Array.from(container.querySelectorAll('img'));

    expect(folder).toHaveAttribute('aria-hidden', 'true');
    expect(images).toHaveLength(3);
    for (const img of images) {
      expect(folder).toContainElement(img as HTMLElement);
      expect(img).toHaveAttribute('alt', '');
      expect(img).toHaveAttribute('draggable', 'false');
    }
  });

  it('gives each sliver two candidates (1x and 2x) of its own crop, and no sizes', () => {
    const { container } = render(
      <PhotoFolder href="/places/p1" count={3} slivers={SLIVERS} placeName="Antler NYC" />,
    );

    Array.from(container.querySelectorAll('img')).forEach((img, index) => {
      expect(img.hasAttribute('sizes')).toBe(false);
      expect(img).toHaveAttribute('loading', 'lazy');
      const list = candidates(img);
      expect(list.map(([, descriptor]) => descriptor)).toEqual(['1x', '2x']);
      expect(list.every(([source]) => source === SLIVERS[index])).toBe(true);
    });
  });

  it('holds exactly one pending spinner in the link', () => {
    render(<PhotoFolder href="/places/p1" count={2} slivers={SLIVERS} placeName="Antler NYC" />);

    expect(spinnersIn(screen.getByRole('link', { name: /photos of Antler NYC/ }))).toHaveLength(1);
  });

  it('renders on the server, with no lab-only open state', () => {
    const html = renderToStaticMarkup(
      <PhotoFolder href="/places/p1" count={2} slivers={SLIVERS} placeName="Antler NYC" />,
    );

    expect(html).toContain('href="/places/p1"');
    expect(html).not.toContain('data-open');
    expect(html).not.toMatch(/vivid/);
  });
});
