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
 * @file The home site index: four links to the main sections, each a figure with its section's
 * name ('22 projects'). A slim, flush tile of four cells divided by hairlines, 2x2 at every width.
 * The numbers and names say what it is, so its h2 ('Site index') is for screen readers only.
 *
 * A section whose list failed to load shows its name without a number: never a made-up count.
 * The tile then says 'error' (tile-states.tsx's state contract): its cell is a line shorter than
 * the reference content its skeleton holds.
 */

import Link from 'next/link';
import type { ReactElement } from 'react';

import { numberFormatter, Tile } from '@/components/console';
import { loadSiteCounts, type SiteCounts } from '../data/loaders';
import { FigurePlaceholder, LoadingNote } from './tile-states';

const TITLE = 'Site index';

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

/** The digits the skeleton holds room for: '64'. */
const SKELETON_DIGITS = 2;

/**
 * The hairlines are the list's background showing through 1px gaps between surface cells; the list
 * runs to the tile's edges, its corners 1px inside the tile's (the border).
 *
 * Always 2x2. Four across needs every name beside its figure, about 623 px of list (39rem), which
 * only a narrow bento from 39rem to 40rem gave this tile: a 16 px band whose estimates were the
 * 2x2 tile's, so the four-across tile left a hole and moved the page.
 */
const GRID_CLASS =
  'grid grid-cols-2 gap-px overflow-hidden rounded-[calc(var(--radius-tile)-1px)] bg-hairline';
const CELL_CLASS = 'flex min-w-0 bg-surface-1';
/**
 * A figure and its name on one baseline; the name wraps under the figure in a cell too narrow for
 * both. The list clips its corners, so the focus ring is drawn inside the cell.
 */
const CELL_BODY_CLASS = 'flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 px-4 py-3.5';
const CELL_LINK_CLASS = `${CELL_BODY_CLASS} text-foreground transition-colors duration-(--motion-fast) ease-standard hover:bg-surface-2 focus-visible:-outline-offset-2`;
const COUNT_CLASS = 'figure-sm text-foreground';
const NAME_CLASS = 'figure-unit text-muted-foreground';
/** The count's type, for its placeholder while the counts load. */
const COUNT_PLACEHOLDER_CLASS = 'figure-sm';

const formatCount = (value: number): string => numberFormatter().format(value);

function IndexCell({ entry, count }: { entry: IndexEntry; count: number | null }): ReactElement {
  const name = count === 1 ? entry.one : entry.other;
  return (
    <li className={CELL_CLASS}>
      <Link href={entry.href} prefetch={false} className={CELL_LINK_CLASS}>
        {count !== null && (
          <>
            <span className={COUNT_CLASS}>{formatCount(count)}</span>{' '}
          </>
        )}
        <span className={NAME_CLASS}>{name}</span>
      </Link>
    </li>
  );
}

export interface SiteIndexTileViewProps {
  counts: SiteCounts;
}

/** Whether every section's count loaded: the reference content, else the error state. */
const hasEveryCount = (counts: SiteCounts): boolean =>
  SITE_INDEX_ENTRIES.every((entry) => counts[entry.key] !== null);

export function SiteIndexTileView({ counts }: SiteIndexTileViewProps): ReactElement {
  return (
    <Tile padding="none" data-state={hasEveryCount(counts) ? 'ready' : 'error'}>
      <h2 className="sr-only">{TITLE}</h2>
      <ul className={GRID_CLASS}>
        {SITE_INDEX_ENTRIES.map((entry) => (
          <IndexCell key={entry.key} entry={entry} count={counts[entry.key]} />
        ))}
      </ul>
    </Tile>
  );
}

/** The loading index: the real heading and names, a placeholder as wide as each count. */
export function SiteIndexTileSkeleton(): ReactElement {
  return (
    <Tile padding="none" aria-busy="true" data-state="loading">
      <h2 className="sr-only">{TITLE}</h2>
      <ul aria-hidden="true" className={GRID_CLASS}>
        {SITE_INDEX_ENTRIES.map((entry) => (
          <li key={entry.key} className={CELL_CLASS}>
            <span className={CELL_BODY_CLASS}>
              <FigurePlaceholder digits={SKELETON_DIGITS} className={COUNT_PLACEHOLDER_CLASS} />{' '}
              <span className={NAME_CLASS}>{entry.other}</span>
            </span>
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
