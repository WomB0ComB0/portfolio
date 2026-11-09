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
 * @file /places/[placeId] renders on the server: an unknown id answers a real 404 (notFound()),
 * the place's summary and photos come from the loaders, and the metadata names the place.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Metadata } from 'next';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Place } from '@/hooks/sanity/schemas';
import { makePlace } from '../../fixtures/sanity-docs';

const FULL_DESCRIPTION =
  'A description long enough that the list card cuts it off, so this page is where it can be read in full.';
const NOT_FOUND_DIGEST = 'NEXT_HTTP_ERROR_FALLBACK;404';
const SITE = 'https://mikeodnis.dev';
const MAX_DESCRIPTION_LENGTH = 160;

const h = vi.hoisted(() => {
  // app.url is read from this variable when the constants module loads.
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://mikeodnis.dev');
  return {
    loadPlaceById: vi.fn<(id: string) => Promise<unknown>>(),
    reportApiFailure: vi.fn((_error: unknown, _report: unknown) => true),
  };
});

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/sanity/loaders', () => ({ loadPlaceById: h.loadPlaceById }));
vi.mock('@/lib/observability/report', () => ({ reportApiFailure: h.reportApiFailure }));
// The real URL builder, so the tests see the URLs the page actually requests.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});

import PlacePage, {
  generateMetadata,
} from '@/app/(routes)/(main)/(personal)/places/[placeId]/page';

const image = (key: string, ref: string, caption?: string) => ({
  _type: 'image' as const,
  _key: key,
  asset: { _ref: ref, _type: 'reference' as const },
  ...(caption && { caption }),
});

const quietPlace = makePlace({
  name: 'Quiet Place',
  description: FULL_DESCRIPTION,
  category: 'Conference',
  latitude: 40.75,
  longitude: -73.99,
  photos: null,
});

const photographedPlace = makePlace({
  name: 'Photographed Place',
  description: FULL_DESCRIPTION,
  category: 'Hackathon',
  photos: [
    // A portrait first: the viewer must not crop it to the frame's shape.
    image('a', 'image-a-3000x4000-jpg'),
    image('b', 'image-b-1600x1200-jpg', 'The stage before the keynote'),
  ],
});

const PLACES: readonly Place[] = [quietPlace, photographedPlace];

const paramsOf = (placeId: string) => ({ params: Promise.resolve({ placeId }) });

async function renderPage(placeId: string) {
  render(await PlacePage(paramsOf(placeId)));
}

/** The decoded src of the image named `name`. */
const imageSrc = (name: string): string =>
  decodeURIComponent(screen.getByRole('img', { name }).getAttribute('src') ?? '');

const ogUrlOf = (metadata: Metadata): unknown =>
  (metadata.openGraph as { url?: unknown } | undefined)?.url;

const ogImageUrlOf = (metadata: Metadata): string => {
  const images = metadata.openGraph?.images;
  const [first] = Array.isArray(images) ? images : [images];
  return String((first as { url?: unknown } | undefined)?.url ?? '');
};

const titleOf = (metadata: Metadata): unknown =>
  (metadata.title as { default?: unknown } | null | undefined)?.default;

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  h.reportApiFailure.mockClear();
  h.loadPlaceById.mockReset();
  h.loadPlaceById.mockImplementation(
    async (id: string) => PLACES.find((place) => place._id === id) ?? null,
  );
});

describe('place page', () => {
  it('answers 404 for an unknown place, instead of a "not found" card served with a 200', async () => {
    await expect(PlacePage(paramsOf('__nope__'))).rejects.toMatchObject({
      digest: NOT_FOUND_DIGEST,
    });
    expect(h.loadPlaceById).toHaveBeenCalledWith('__nope__');
  });

  it('lets a Sanity outage reach the error boundary', async () => {
    const outage = new Error('sanity is down');
    h.loadPlaceById.mockRejectedValue(outage);

    await expect(PlacePage(paramsOf(quietPlace._id))).rejects.toBe(outage);
  });

  it('shows a place without photos in full, with an empty state instead of the viewer', async () => {
    await renderPage(quietPlace._id);

    expect(screen.getByRole('heading', { level: 1, name: 'Quiet Place' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText(FULL_DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByText('Conference')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No photos yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute(
      'href',
      'https://maps.google.com/?q=40.75,-73.99',
    );
    expect(screen.getByRole('link', { name: 'Back to Places' })).toHaveAttribute('href', '/places');
    expect(screen.getByRole('link', { name: 'Close' })).toHaveAttribute('href', '/places');
    expect(screen.queryByText(/^Photo \d+ of \d+$/)).not.toBeInTheDocument();
  });
});

describe('place photo viewer', () => {
  it('shows the photos under the same header, the portrait whole', async () => {
    await renderPage(photographedPlace._id);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Photographed Place' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Hackathon')).toBeInTheDocument();
    expect(screen.getByText('Photo 1 of 2')).toBeInTheDocument();
    // The portrait is requested whole: fit=max, sized by height, with no aspect-ratio crop.
    const src = imageSrc('Photo of Photographed Place');
    expect(src).toContain('fit=max');
    expect(src).toContain('h=1200');
    expect(src).not.toContain('rect=');
    expect(screen.getByRole('link', { name: 'Close photo viewer' })).toHaveAttribute(
      'href',
      '/places',
    );
    expect(screen.queryByRole('heading', { name: 'No photos yet' })).not.toBeInTheDocument();
  });

  it('moves to another photo from the strip, and shows that photo and its caption', async () => {
    await renderPage(photographedPlace._id);
    const strip = screen.getByRole('toolbar', { name: 'Photos of Photographed Place' });

    fireEvent.click(
      within(strip).getByRole('button', { name: 'Photo 2 of 2: The stage before the keynote' }),
    );

    expect(screen.getByText('Photo 2 of 2')).toBeInTheDocument();
    // The landscape fills the width instead.
    expect(imageSrc('The stage before the keynote')).toContain('w=1600');
    expect(screen.getByText('The stage before the keynote', { selector: 'p' })).toBeInTheDocument();

    fireEvent.click(within(strip).getByRole('button', { name: 'Photo 1 of 2' }));

    expect(screen.getByText('Photo 1 of 2')).toBeInTheDocument();
  });

  it("draws each photo's strip thumbnail as a 320 x 240 crop in the best format", async () => {
    await renderPage(photographedPlace._id);
    const strip = screen.getByRole('toolbar', { name: 'Photos of Photographed Place' });

    // next/image wraps the Sanity URL in /_next/image?url=…
    const sources = within(strip)
      .getAllByRole('button')
      .map((button) => {
        const optimised = new URL(button.querySelector('img')?.getAttribute('src') ?? '', SITE);
        return new URL(optimised.searchParams.get('url') ?? '');
      });

    expect(sources.map((source) => source.pathname)).toEqual([
      '/images/test/test/a-3000x4000.jpg',
      '/images/test/test/b-1600x1200.jpg',
    ]);
    for (const { searchParams } of sources) {
      expect(searchParams.get('w')).toBe('320');
      expect(searchParams.get('h')).toBe('240');
      expect(searchParams.get('fit')).toBe('crop');
      expect(searchParams.get('auto')).toBe('format');
    }
  });

  it('zooms in and back out, within its limits', async () => {
    await renderPage(photographedPlace._id);
    const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
    const zoomOut = screen.getByRole('button', { name: 'Zoom out' });

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(zoomOut).toBeDisabled();

    fireEvent.click(zoomIn);
    expect(screen.getByText('120%')).toBeInTheDocument();
    expect(zoomOut).toBeEnabled();

    fireEvent.click(zoomOut);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(zoomOut).toBeDisabled();

    for (let step = 0; step < 15; step += 1) fireEvent.click(zoomIn);
    expect(screen.getByText('300%')).toBeInTheDocument();
    expect(zoomIn).toBeDisabled();
  });
});

describe('place page metadata', () => {
  it("is the place's own: its name, its URL and its first photo", async () => {
    const metadata = await generateMetadata(paramsOf(photographedPlace._id));

    expect(titleOf(metadata)).toBe('Photographed Place');
    expect(metadata.description).toBe(FULL_DESCRIPTION);
    expect(ogUrlOf(metadata)).toBe(`${SITE}/places/${photographedPlace._id}`);
    const preview = decodeURIComponent(ogImageUrlOf(metadata));
    expect(preview).toContain('/a-3000x4000.jpg');
    expect(preview).toContain('w=1200');
    expect(preview).toContain('h=630');
  });

  it('uses the generated preview card for a place without photos', async () => {
    const metadata = await generateMetadata(paramsOf(quietPlace._id));

    expect(ogImageUrlOf(metadata)).toMatch(/^\/api\/og\?title=Quiet%20Place&/);
  });

  it('cuts a long description at a word boundary, within 160 characters', async () => {
    const words = Array.from({ length: 80 }, (_, i) => `word${i}`);
    const long = words.join(' ');
    expect(long.length).toBeGreaterThan(400);
    const place = makePlace({ name: 'Wordy Place', description: long });
    h.loadPlaceById.mockResolvedValue(place);

    const { description } = await generateMetadata(paramsOf(place._id));

    expect(description).toBeTypeOf('string');
    const text = description as string;
    expect(text.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
    expect(text.endsWith('…')).toBe(true);
    const kept = text.slice(0, -1).split(' ');
    // Every word kept is whole, and as many as fit are kept.
    expect(kept).toEqual(words.slice(0, kept.length));
    expect(`${kept.join(' ')} ${words[kept.length]}…`.length).toBeGreaterThan(
      MAX_DESCRIPTION_LENGTH,
    );
  });

  it('says "Place Not Found" for an unknown id, without og:url or a report', async () => {
    const metadata = await generateMetadata(paramsOf('__nope__'));

    expect(titleOf(metadata)).toBe('Place Not Found');
    expect(ogUrlOf(metadata)).toBeUndefined();
    expect(h.reportApiFailure).not.toHaveBeenCalled();
  });

  it('keeps generic metadata and its URL during an outage, and reports it as a warning', async () => {
    const outage = new Error('sanity is down');
    h.loadPlaceById.mockRejectedValue(outage);

    const metadata = await generateMetadata(paramsOf('some-place'));

    expect(titleOf(metadata)).toBe('Places');
    expect(ogUrlOf(metadata)).toBe(`${SITE}/places/some-place`);
    expect(h.reportApiFailure).toHaveBeenCalledTimes(1);
    expect(h.reportApiFailure).toHaveBeenCalledWith(outage, {
      context: 'build place page metadata',
      level: 'warning',
    });
  });
});
