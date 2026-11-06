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

import 'server-only';

/**
 * @file The home site index: four links to the main sections, each with how many entries it
 * holds ('22 projects'). A plain tile of four cells divided by hairlines: 2x2 below a 36rem tile,
 * one row of four above.
 *
 * A section whose list failed to load shows its name without a number: never a made-up count.
 */

import Link from 'next/link';
import type { ReactElement } from 'react';

import { numberFormatter, Tile } from '@/components/console';
import { loadSiteCounts, type SiteCounts } from '../data/loaders';
import { LoadingNote, SkeletonBar } from './tile-states';

const TITLE = 'Site index';
const VISIBLE_LABEL = 'Index';

/** Every count unknown: the index's fallback when the tile itself fails. */
export const UNKNOWN_SITE_COUNTS: SiteCounts = {
  projects: null,
  roles: null,
  certifications: null,
  places: null,
};

interface IndexEntry {
  readonly key: keyof SiteCounts;
  readonly href: string;
  readonly one: string;
  readonly other: string;
}

export const SITE_INDEX_ENTRIES = [
  { key: 'projects', href: '/projects', one: 'project', other: 'projects' },
  { key: 'roles', href: '/experience', one: 'role', other: 'roles' },
  { key: 'certifications', href: '/certifications', one: 'certification', other: 'certifications' },
  { key: 'places', href: '/places', one: 'place', other: 'places' },
] as const satisfies readonly IndexEntry[];

/**
 * The hairlines are the list's background showing through 1px gaps between surface cells.
 *
 * The longest name, 'CERTIFICATIONS', is 14 label-mono glyphs: 114 px at 0.08em tracking, 101 px
 * without. Four across waits for a 36rem tile, where a cell has 119 px inside its padding (at
 * 30rem it had 95). In the 2x2 grid below an 18rem tile (a 320 px viewport gives 254 px), the
 * cells loosen their padding and the names their tracking, which leaves 105 px for 101.
 */
const GRID_CLASS =
  'grid grid-cols-2 gap-px overflow-hidden rounded-md border border-hairline bg-hairline @xl:grid-cols-4';
const CELL_PADDING_CLASS = 'px-3 py-3 @max-2xs:px-2.5';
/** The list clips its corners, so the focus ring is drawn inside each cell. */
const CELL_LINK_CLASS = `flex h-full min-h-20 flex-col justify-end gap-1 bg-surface-1 ${CELL_PADDING_CLASS} text-foreground transition-colors duration-(--motion-fast) ease-standard hover:bg-surface-2 focus-visible:-outline-offset-2`;
const COUNT_CLASS = 'figure text-[2rem]';
const CELL_NAME_CLASS = 'label-mono text-muted-foreground @max-2xs:tracking-normal';
/** The visible 'Index': label-mono sets no weight, so it takes the h2 labels' semibold itself. */
const VISIBLE_LABEL_CLASS = 'label-mono font-semibold text-muted-foreground';

const formatCount = (value: number): string => numberFormatter().format(value);

function IndexCell({ entry, count }: { entry: IndexEntry; count: number | null }): ReactElement {
  const name = count === 1 ? entry.one : entry.other;
  return (
    <li>
      <Link href={entry.href} prefetch={false} className={CELL_LINK_CLASS}>
        {count !== null && (
          <>
            <span className={COUNT_CLASS}>{formatCount(count)}</span>{' '}
          </>
        )}
        <span className={CELL_NAME_CLASS}>{name}</span>
      </Link>
    </li>
  );
}

/** The index's heading: 'Site index' for screen readers, 'Index' on screen. */
function IndexHeading(): ReactElement {
  return (
    <>
      <h2 className="sr-only">{TITLE}</h2>
      <p aria-hidden="true" className={VISIBLE_LABEL_CLASS}>
        {VISIBLE_LABEL}
      </p>
    </>
  );
}

export interface SiteIndexTileViewProps {
  counts: SiteCounts;
}

export function SiteIndexTileView({ counts }: SiteIndexTileViewProps): ReactElement {
  return (
    <Tile className="gap-3">
      <IndexHeading />
      <ul className={GRID_CLASS}>
        {SITE_INDEX_ENTRIES.map((entry) => (
          <IndexCell key={entry.key} entry={entry} count={counts[entry.key]} />
        ))}
      </ul>
    </Tile>
  );
}

/** The loading index: the real heading and four cells with a bar where each number goes. */
export function SiteIndexTileSkeleton(): ReactElement {
  return (
    <Tile className="gap-3" aria-busy="true" data-state="loading">
      <IndexHeading />
      <ul aria-hidden="true" className={GRID_CLASS}>
        {SITE_INDEX_ENTRIES.map((entry) => (
          <li
            key={entry.key}
            className={`flex min-h-20 flex-col justify-end gap-1 bg-surface-1 ${CELL_PADDING_CLASS}`}
          >
            <SkeletonBar className="h-8 w-10" />
            <span className={CELL_NAME_CLASS}>{entry.other}</span>
          </li>
        ))}
      </ul>
      <LoadingNote>Loading the site index</LoadingNote>
    </Tile>
  );
}

export async function SiteIndexTile(): Promise<ReactElement> {
  return <SiteIndexTileView counts={await loadSiteCounts()} />;
}
