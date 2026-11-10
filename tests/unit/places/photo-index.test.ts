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
 * @file /places/photos' data, built on the server from the past places only: one record per
 * place that has a usable photo (its name, description, category and dates, once) and one per
 * photo (its place's id, its 1-based index in that place, its caption, shape, focus and URLs),
 * in a fixed shuffle. No coordinates anywhere. A visit today, still running, undated or with its
 * photos cleared adds nothing.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Place } from '@/hooks/sanity/schemas';
import { makePlace } from '../../fixtures/sanity-docs';

const h = vi.hoisted(() => ({ loadPlaces: vi.fn<() => Promise<readonly unknown[]>>() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/sanity/loaders', () => ({ loadPlaces: h.loadPlaces }));
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});

import { loadPastPlaces } from '@/app/(routes)/(main)/(personal)/places/_lib/past-place-loaders';
import { buildPhotoIndex } from '@/app/(routes)/(main)/(personal)/places/photos/_lib/photo-index';

type Photo = NonNullable<Place['photos']>[number];

/** A photo of a `width` x `height` asset whose hash is `hash` (40 hex), with extras. */
const photo = (hash: string, width = 1600, height = 1200, extra: Partial<Photo> = {}): Photo => ({
  _type: 'image',
  asset: { _type: 'reference', _ref: `image-${hash}-${width}x${height}-jpg` },
  ...extra,
});
const hash = (n: number): string => n.toString(16).padStart(40, '0');

afterEach(() => {
  vi.useRealTimers();
  h.loadPlaces.mockReset();
});

describe('buildPhotoIndex', () => {
  const A = makePlace({
    name: 'Alpha Hall',
    description: 'A long day of demos.',
    category: 'Hackathon',
    startDate: '2026-04-11',
    endDate: '2026-04-12',
    photos: [
      photo(hash(1), 4000, 3000, {
        caption: '  Opening   night ',
        hotspot: { x: 0.3, y: 0.7, width: 0.1, height: 0.1 },
      }),
      photo(hash(2), 3000, 4000),
      photo(hash(3)),
    ],
  });
  const B = makePlace({ name: 'Beta Lab', photos: [photo(hash(4)), photo(hash(5))] });
  const EMPTY = makePlace({ name: 'Nothing here', photos: [] });
  const CLEARED = makePlace({ name: 'Cleared', photos: null });

  it('keeps one record per place with photos, in the given order, with no coordinates', () => {
    const index = buildPhotoIndex([A, EMPTY, B, CLEARED]);

    expect(index.places).toEqual([
      {
        id: A._id,
        name: 'Alpha Hall',
        description: 'A long day of demos.',
        category: 'Hackathon',
        startDate: '2026-04-11',
        endDate: '2026-04-12',
        photoCount: 3,
      },
      {
        id: B._id,
        name: 'Beta Lab',
        description: B.description,
        category: B.category,
        startDate: B.startDate,
        endDate: null,
        photoCount: 2,
      },
    ]);
    expect(JSON.stringify(index)).not.toMatch(/latitude|longitude/);
  });

  it("gives each photo its place's id, a 1-based index, its caption, shape and focus", () => {
    const { photos } = buildPhotoIndex([A]);
    const byKey = new Map(photos.map((item) => [item.key, item]));

    expect([...byKey.keys()].sort()).toEqual([`${A._id}:1`, `${A._id}:2`, `${A._id}:3`]);
    const first = byKey.get(`${A._id}:1`);
    expect(first).toMatchObject({
      placeId: A._id,
      index: 1,
      caption: 'Opening night',
      focus: { x: 0.3, y: 0.7 },
    });
    expect(first?.ratio).toBeCloseTo(4 / 3);
    expect(byKey.get(`${A._id}:2`)).toMatchObject({ caption: null, focus: null, ratio: 0.75 });
  });

  it("builds the cover thumbnail and the place viewer's whole photo, both uncropped", () => {
    const { photos } = buildPhotoIndex([A]);
    const portrait = photos.find((item) => item.index === 2);
    const thumb = new URL(portrait?.thumb ?? '').searchParams;
    const full = new URL(portrait?.full ?? '').searchParams;

    expect(portrait?.thumb).toMatch(/^https:\/\/cdn\.sanity\.io\/images\/test\/test\//);
    expect(thumb.get('w')).toBe('480');
    expect(thumb.has('rect')).toBe(false);
    expect(full.get('h')).toBe('1200');
    expect(full.get('fit')).toBe('max');
    expect(full.has('rect')).toBe(false);
  });

  it('skips a photo the URL builder cannot read, and counts only the rest', () => {
    const broken = makePlace({
      photos: [photo(hash(6)), { _type: 'image', asset: { _type: 'reference', _ref: 'image-x' } }],
    });
    const index = buildPhotoIndex([broken]);

    expect(index.places[0]?.photoCount).toBe(1);
    expect(index.photos.map((item) => item.key)).toEqual([`${broken._id}:1`]);
  });

  it('puts the photos in the same fixed shuffle on every call, kept by any subset', () => {
    const many = Array.from({ length: 6 }, (_, n) =>
      makePlace({ photos: [photo(hash(100 + n * 2)), photo(hash(101 + n * 2))] }),
    );
    const first = buildPhotoIndex(many).photos.map((item) => item.key);
    const second = buildPhotoIndex(many).photos.map((item) => item.key);
    const placeOrder = many.flatMap((place) => [`${place._id}:1`, `${place._id}:2`]);

    expect(first).toEqual(second);
    expect(first).not.toEqual(placeOrder);
    const kept = new Set([many[1]?._id, many[4]?._id]);
    const subset = first.filter((key) => kept.has(key.split(':')[0]));
    expect(subset).toHaveLength(4);
  });
});

describe('buildPhotoIndex from the past-only loader', () => {
  // 13:00 ET on Nov 10, 2026: from noon, Nov 10 is the cutoff, so Nov 9 is over and Nov 10 is not.
  const NOW = Date.UTC(2026, 10, 10, 18, 0);
  const PAST = makePlace({ name: 'Over', startDate: '2026-11-09', photos: [photo(hash(201))] });
  const TODAY = makePlace({ name: 'Today', startDate: '2026-11-10', photos: [photo(hash(202))] });
  const RUNNING = makePlace({
    name: 'Running',
    startDate: '2026-11-08',
    endDate: '2026-11-20',
    photos: [photo(hash(203))],
  });
  const UNDATED = makePlace({ name: 'Undated', startDate: null, photos: [photo(hash(204))] });
  const CLEARED = makePlace({ name: 'Cleared', startDate: '2026-11-01', photos: null });

  it('never carries a visit that may still be on, nor a cleared one', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    h.loadPlaces.mockResolvedValue([TODAY, RUNNING, PAST, UNDATED, CLEARED]);

    const index = buildPhotoIndex(await loadPastPlaces());
    const text = JSON.stringify(index);

    expect(index.places.map((place) => place.id)).toEqual([PAST._id]);
    expect(index.photos.map((item) => item.placeId)).toEqual([PAST._id]);
    for (const hidden of [TODAY, RUNNING, UNDATED, CLEARED]) {
      expect(text).not.toContain(hidden._id);
      expect(text).not.toContain(hidden.name);
    }
    for (const n of [202, 203, 204]) expect(text).not.toContain(hash(n));
  });
});
