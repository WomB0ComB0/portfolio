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
 * @file The owner's opsec rules for /places, checked in the source:
 * - nothing tells where the owner is now: no geolocation, no "Here now", "Upcoming" or "Right
 *   now" words, and no facet but the category (no date chip or sort);
 * - nothing keeps place data on the visitor's device (no web storage, IndexedDB or cookies), so a
 *   place cleared in Studio is gone on the next request;
 * - the URL carries only q and category, never coordinates;
 * - the metadata names no location (no `other`, so the layout's own tags stand);
 * - every reader of places outside the Sanity library goes through the past-only loaders, so no
 *   page, sitemap entry, JSON answer or count can name a visit that may still be on;
 * - no loading.tsx anywhere under /places, so the list is in the first HTML without JavaScript.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// t3-env validates on import; the metadata needs no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/sanity/loaders', () => ({ loadPlaces: vi.fn() }));
vi.mock('@/lib/sanity/client', () => ({ urlFor: vi.fn() }));
vi.mock('@/app/(routes)/(main)/(personal)/places/_components/map', () => ({
  GoogleMaps: () => null,
  default: () => null,
}));

import {
  placeFilters,
  placePhotoFilters,
} from '@/app/(routes)/(main)/(personal)/places/_lib/place-filters';
import { metadata } from '@/app/(routes)/(main)/(personal)/places/(list)/page';
import { metadata as photosMetadata } from '@/app/(routes)/(main)/(personal)/places/photos/page';

const SRC_DIR = path.resolve(__dirname, '../../../src');
const PLACES_DIR = path.join(SRC_DIR, 'app/(routes)/(main)/(personal)/places');

/**
 * The places modules, the categories, the filter libraries and the FilterBar kit, imported
 * statically or lazily (`import('./x')`, as the photos view loads its wall and open view).
 */
const FOLLOWED_IMPORT =
  /(?:from |import\()'(\.{1,2}\/[^']+|@\/app\/\(routes\)\/\(main\)\/\(personal\)\/places\/[^']+|@\/lib\/places\/[^']+|@\/lib\/filters|@\/components\/console\/filter-bar[^']*)'/g;
const MODULE_SUFFIXES = ['.tsx', '.ts', '/index.ts'];

/** Where an import resolves, or undefined for a package or a file this scan does not follow. */
const resolveImport = (from: string, specifier: string): string | undefined => {
  const base = specifier.startsWith('@/')
    ? path.join(SRC_DIR, specifier.slice(2))
    : path.resolve(path.dirname(from), specifier);
  return MODULE_SUFFIXES.map((suffix) => `${base}${suffix}`).find(existsSync);
};

/** `file` and every module it reaches through FOLLOWED_IMPORT. */
function graphOf(file: string, seen: ReadonlySet<string> = new Set()): ReadonlySet<string> {
  if (seen.has(file)) return seen;
  let graph = new Set([...seen, file]);
  for (const [, specifier = ''] of readFileSync(file, 'utf8').matchAll(FOLLOWED_IMPORT)) {
    const imported = resolveImport(file, specifier);
    if (imported) graph = new Set(graphOf(imported, graph));
  }
  return graph;
}

/** A file's code without its comments (a doc comment may name what is banned, to ban it). */
const codeOf = (file: string): string =>
  readFileSync(file, 'utf8')
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/(^|[^:'"])\/\/.*$/gm, '$1');

/** Every file under a folder. */
function filesUnder(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const full = path.join(folder, name);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

const SCANNED = [
  ...new Set([
    ...graphOf(path.join(PLACES_DIR, '_components/places-explorer.tsx')),
    ...graphOf(path.join(PLACES_DIR, 'photos/_components/photos-explorer.tsx')),
    path.join(PLACES_DIR, '(list)/page.tsx'),
    path.join(PLACES_DIR, '_interface/places/places.tsx'),
    path.join(PLACES_DIR, 'photos/page.tsx'),
    path.join(PLACES_DIR, 'photos/_lib/photo-index.ts'),
    path.join(PLACES_DIR, '_lib/place-photo-urls.ts'),
  ]),
];

describe('/places opsec', () => {
  it('scans the island, its filters and the kit', () => {
    const names = SCANNED.map((file) => path.relative(SRC_DIR, file));
    expect(names).toEqual(
      expect.arrayContaining([
        'app/(routes)/(main)/(personal)/places/_lib/place-filters.ts',
        'app/(routes)/(main)/(personal)/places/_components/use-shown-places.ts',
        'app/(routes)/(main)/(personal)/places/_components/map.tsx',
        'lib/places/categories.ts',
        'components/console/filter-bar/use-url-filters.ts',
      ]),
    );
  });

  it('scans the photos island, down to the parts it loads lazily', () => {
    const names = SCANNED.map((file) => path.relative(PLACES_DIR, file));
    expect(names).toEqual(
      expect.arrayContaining([
        'photos/_components/photos-view.tsx',
        'photos/_components/photo-grid.tsx',
        'photos/_components/photo-wall-live.tsx',
        'photos/_components/use-wall-input.ts',
        'photos/_components/wall-sheet.tsx',
        'photos/_components/photo-dialog-live.tsx',
        '_components/places-view-nav.tsx',
        'photos/page.tsx',
        'photos/_lib/photo-index.ts',
        '_lib/place-photo-urls.ts',
      ]),
    );
  });

  it.each(SCANNED.map((file) => [path.relative(SRC_DIR, file), file]))(
    '%s asks for no location and stores nothing on the device',
    (_name, file) => {
      const code = codeOf(file);
      expect(code).not.toMatch(/geolocation|getCurrentPosition|watchPosition/);
      expect(code).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
      expect(code).not.toMatch(/here now|right now|upcoming|currently at/i);
    },
  );

  it('keeps only q and category in the URL, and no facet but the category', () => {
    expect(Object.keys(placeFilters.parsers).sort()).toEqual(['category', 'q']);
    expect(placeFilters.keys).toEqual(['category']);
  });

  it('keeps /places/photos to the same URL: q and category, no view, photo or position', () => {
    expect(Object.keys(placePhotoFilters.parsers).sort()).toEqual(['category', 'q']);
    expect(placePhotoFilters.keys).toEqual(['category']);
  });

  it.each([
    ['/places', metadata],
    ['/places/photos', photosMetadata],
  ])('names no location in the metadata of %s', (_path, pageMetadata) => {
    expect(pageMetadata.other).toBeUndefined();
    expect(JSON.stringify(pageMetadata)).not.toMatch(/geo\.|placename|latitude|longitude/i);
  });

  it('reads places everywhere only through the past-only loaders', () => {
    // The raw readers answer every place, including a visit that may still be on. Only the
    // past-only loaders may import them; the pages, the sitemap, the v1 JSON and the home tiles
    // import those loaders instead.
    const rawReaders: Readonly<Record<string, ReadonlySet<string>>> = {
      '@/lib/sanity/loaders': new Set(['loadPlaces', 'loadPlaceById', 'peekPlaces', 'readPlaces']),
      '@/lib/sanity/api': new Set(['getPlaces']),
      '@/lib/sanity/queries': new Set(['placesQuery', 'placeByIdQuery', 'contentCountsQuery']),
    };
    const allowed = new Set([path.join(PLACES_DIR, '_lib/past-place-loaders.ts')]);
    const SANITY_LIB = path.join(SRC_DIR, 'lib/sanity');
    const IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g;

    const offenders = filesUnder(SRC_DIR)
      .filter((file) => /\.tsx?$/.test(file) && !file.startsWith(SANITY_LIB) && !allowed.has(file))
      .flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(IMPORT)].flatMap(([, names = '', from = '']) =>
          names
            .split(',')
            .map(
              (name) =>
                name
                  .replace(/^\s*type\s+/, '')
                  .split(/\s+as\s+/)[0]
                  ?.trim() ?? '',
            )
            .filter((name) => rawReaders[from]?.has(name))
            .map((name) => `${path.relative(SRC_DIR, file)}: ${name}`),
        ),
      );

    expect(offenders).toEqual([]);
  });

  it('has no loading.tsx anywhere under /places', () => {
    const loading = filesUnder(PLACES_DIR).filter((file) =>
      /^loading\.[jt]sx?$/.test(path.basename(file)),
    );
    expect(loading.map((file) => path.relative(PLACES_DIR, file))).toEqual([]);
  });
});
