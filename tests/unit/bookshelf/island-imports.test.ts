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
 * @file Keeps server code out of the `/bookshelf` and `/bookshelf/free` client islands. An island
 * may import the isomorphic types and URL parsers (src/lib/free-books/types.ts,
 * bookshelf/_lib/bookshelf-filters.ts, free/_lib/free-books-filters.ts, normalise.ts), but must
 * never reach, even transitively, the free-books parser, catalog, loader, Redis store,
 * threat-intel clients or content inspectors, the security manifest JSON, the bookshelf loader,
 * DOMPurify or marked. Each forbidden path must exist, so a moved module fails here instead of
 * passing unchecked. The reading map's Radix dialog stays off the first load: the stage and the
 * detail reach it only through the lazy import in reading-map-dialog.tsx.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { importGraph } from '@tests/utils/import-graph';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'src');
const BOOKSHELF = path.join(SRC, 'app/(routes)/(main)/(personal)/bookshelf');

const CLIENT_ISLANDS = [
  path.join(BOOKSHELF, '_components/bookshelf-stage.tsx'),
  // Its own island entry on /bookshelf/[slug], not only reached through the stage.
  path.join(BOOKSHELF, '_components/book-detail-view.tsx'),
  path.join(BOOKSHELF, 'free/_components/free-books-explorer.tsx'),
];

const FORBIDDEN_MODULES = [
  path.join(SRC, 'lib/free-books/parse.ts'),
  path.join(SRC, 'lib/free-books/catalog.ts'),
  path.join(SRC, 'lib/free-books/loader.ts'),
  path.join(SRC, 'lib/free-books/manifest-store.ts'),
  path.join(SRC, 'lib/free-books/threat-intel.ts'),
  path.join(SRC, 'lib/free-books/content-inspection.ts'),
  path.join(SRC, 'lib/free-books/security-manifest.json'),
  path.join(BOOKSHELF, '_lib/load-bookshelf.ts'),
];

const FORBIDDEN_PACKAGES = new Set(['dompurify', 'marked', 'server-only']);

/** The reading map's loader, the live dialog it fetches on intent, and the site's dialog kit. */
const MAP_LOADER = path.join(BOOKSHELF, '_components/reading-map-dialog.tsx');
const MAP_LIVE = path.join(BOOKSHELF, '_components/reading-map-dialog-live.tsx');
const UI_DIALOG = path.join(SRC, 'components/ui/dialog.tsx');
/** A static value import (not `import type`) or re-export from `specifier`. */
const staticImportOf = (specifier: string): RegExp =>
  new RegExp(
    String.raw`(?:^|[\s;])(?:import|export)\s+(?!type\s)[^'";]*?from\s*['"]${specifier.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}['"]`,
    'm',
  );

/** The island's reach: data and styles are listed but never read. */
const collectValueGraph = (entry: string) =>
  importGraph(entry, { src: SRC, leaves: ['.json', '.css'] });

describe('bookshelf client island compartmentalization', () => {
  // A moved or renamed module would pass the checks below without ever being looked for.
  it.each(FORBIDDEN_MODULES.map((file) => [path.relative(ROOT, file), file] as const))(
    '%s exists, so the guard is not vacuous',
    (_label, file) => {
      expect(existsSync(file)).toBe(true);
    },
  );

  // The covers are sized by the site's CDN loader (coverAt in book-covers.ts): that module takes
  // only a type from next/image, so the island stays free of next/image's runtime.
  it('sizes the stage covers through the CDN loader, never through next/image', () => {
    const { files, packages } = collectValueGraph(CLIENT_ISLANDS[0] ?? '');

    expect(files.has(path.join(SRC, 'lib/images/cdn-loader.ts'))).toBe(true);
    expect(packages.has('next/image')).toBe(false);
  });

  it.each(CLIENT_ISLANDS.map((file) => [path.relative(ROOT, file), file] as const))(
    '%s never reaches server loaders, Redis manifest store, security JSON, or DOMPurify',
    (_label, islandPath) => {
      const { files, packages } = collectValueGraph(islandPath);

      for (const forbidden of FORBIDDEN_MODULES) {
        expect(files.has(forbidden), path.relative(ROOT, forbidden)).toBe(false);
      }
      for (const pkg of FORBIDDEN_PACKAGES) {
        expect(packages.has(pkg), pkg).toBe(false);
      }
    },
  );

  it.each(CLIENT_ISLANDS.slice(0, 2).map((file) => [path.relative(ROOT, file), file] as const))(
    "%s reaches the Radix dialog only through the reading map's lazy import",
    (_label, islandPath) => {
      const sources = [...collectValueGraph(islandPath).files]
        .filter((file) => /\.(?:m?js|tsx?)$/.test(file))
        .map((file) => ({ file: path.relative(ROOT, file), source: readFileSync(file, 'utf8') }));
      const importersOf = (specifier: string): string[] =>
        sources
          .filter(({ source }) => staticImportOf(specifier).test(source))
          .map(({ file }) => file)
          .sort();

      expect(importersOf('@radix-ui/react-dialog')).toEqual(
        [MAP_LIVE, UI_DIALOG].map((file) => path.relative(ROOT, file)).sort(),
      );
      expect(importersOf('@/components/ui/dialog')).toEqual([path.relative(ROOT, MAP_LIVE)]);
      expect(importersOf('./reading-map-dialog-live')).toEqual([]);
      expect(readFileSync(MAP_LOADER, 'utf8')).toMatch(
        /import\(\s*['"]\.\/reading-map-dialog-live['"]\s*\)/,
      );
    },
  );
});
