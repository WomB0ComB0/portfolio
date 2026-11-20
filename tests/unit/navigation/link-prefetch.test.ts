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
 * @file Every next/link in the shell and on the busiest list and detail pages says how it
 * prefetches. Next prefetches each Link that enters the viewport. Every route renders per request
 * and none has a loading.tsx, so a prefetch carries only the route tree, yet each one still runs a
 * function: the footer's three links on every page, one per /places card, the view switches and
 * breadcrumbs. These links opt out with prefetch={false}; the first click fetches the route on
 * demand. The nav flyout's links keep their conditional opt-out (nav-flyout-prefetch.test.tsx).
 *
 * A source scan: a Link added to one of these files without a prefetch prop fails here.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const PLACES = 'src/app/(routes)/(main)/(personal)/places';
const PROJECTS = 'src/app/(routes)/(main)/(professioal)/projects';

/** Each file, and how many next/link elements it has (so the scan cannot pass by finding none). */
const FILES: Readonly<Record<string, number>> = {
  'src/components/layout/nav.tsx': 2,
  'src/components/layout/footer.tsx': 4,
  'src/components/layout/mobile-menu-overlay.tsx': 1,
  'src/components/console/folio/view-switch.tsx': 1,
  'src/app/_components/errors/not-found-view.tsx': 2,
  [`${PLACES}/_components/photo-folder.tsx`]: 2,
  [`${PLACES}/_components/places-view-nav.tsx`]: 1,
  [`${PLACES}/_components/map.tsx`]: 1,
  [`${PLACES}/[placeId]/_components/place-summary.tsx`]: 1,
  [`${PLACES}/photos/_components/photos-explorer.tsx`]: 1,
  [`${PROJECTS}/_components/detail/case-hero.tsx`]: 2,
  [`${PROJECTS}/_components/detail/where-it-sits.tsx`]: 1,
  [`${PROJECTS}/_components/projects-index.tsx`]: 1,
  [`${PROJECTS}/_interface/project-detail/project-detail.tsx`]: 1,
};

/** A `<Link` opening, not `<LinkPending` or any other name that starts with it. */
const LINK_OPENING = /<Link(?=[\s>])/g;

/**
 * The opening tag that starts at `start`: up to the first `>` outside braces and quotes, so an
 * arrow function or a template literal inside an attribute does not end it.
 */
function openingTagAt(source: string, start: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
    } else if (depth === 0 && (char === '"' || char === "'")) {
      quote = char;
    } else if (depth === 0 && char === '>') {
      return source.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated <Link at ${start}`);
}

/** Every next/link opening tag in `file`, with the line it starts on. */
function linkTagsIn(file: string): { line: number; tag: string }[] {
  const source = readFileSync(join(ROOT, file), 'utf8');
  if (!source.includes("from 'next/link'")) return [];
  return [...source.matchAll(LINK_OPENING)].map((match) => ({
    line: source.slice(0, match.index).split('\n').length,
    tag: openingTagAt(source, match.index),
  }));
}

describe('Links that must say how they prefetch', () => {
  it.each(Object.entries(FILES))('%s has %i next/link element(s)', (file, count) => {
    expect(linkTagsIn(file)).toHaveLength(count);
  });

  it.each(Object.keys(FILES))('every next/link in %s sets a prefetch prop', (file) => {
    const missing = linkTagsIn(file)
      .filter(({ tag }) => !/\sprefetch=\{/.test(tag))
      .map(({ line }) => `${file}:${line}`);

    expect(missing).toEqual([]);
  });

  it('turns prefetching off outright everywhere but the nav flyout, which turns it off while closed', () => {
    const conditional = Object.keys(FILES).flatMap((file) =>
      linkTagsIn(file)
        .filter(({ tag }) => !/\sprefetch=\{false\}/.test(tag))
        .map(({ line }) => `${file}:${line}`),
    );

    expect(conditional).toHaveLength(1);
    expect(conditional[0]).toMatch(/^src\/components\/layout\/nav\.tsx:\d+$/);
  });

  it('finds an opening tag that spans lines and holds an arrow function', () => {
    const source = '<Link\n  href="/a"\n  onClick={() => go(1 > 0)}\n  prefetch={false}\n>';
    expect(openingTagAt(source, 0)).toBe(source);
  });
});
