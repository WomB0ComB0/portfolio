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
 * @file The home current-roles tile: the owner's current roles in Studio order, but not the first,
 * which the hero's role line already names (owner decision: don't repeat it). Each is a link to its
 * page ('Elysium · since 2023'), and '+N more' counts the current roles named nowhere on the page,
 * or 'All experience' takes its line when none is. A plain tile, because it holds several links.
 * The roles stack, and sit side by side from a 32rem tile.
 */

import Link from 'next/link';
import type { ReactElement } from 'react';

import { SrOnlyWords, Tile } from '@/components/console';
import type { Experience } from '@/lib/sanity/loaders';
import { companyName, formatAsOfDay, formatYear, type Instant } from '../data/format';
import { loadCurrentRoles } from '../data/loaders';
import type { CurrentRoles } from '../data/selectors';
import type { TileResult } from '../data/tile-result';
import {
  joinMeta,
  LoadingNote,
  SkeletonLine,
  TileEmpty,
  TileLabel,
  TileMeta,
  TileUnavailable,
} from './tile-states';

const LABEL = 'Current roles';
const EXPERIENCE_PATH = '/experience';
/** The way to every role: the empty state's link, and the last line when no role is unnamed. */
const ALL_EXPERIENCE = 'All experience';
/** The roles the skeleton holds room for: what the tile lists beside the hero's. */
const SKELETON_ROLES = ['first', 'second'] as const;

const TILE_CLASS = 'gap-3';
const LIST_CLASS = 'grid gap-0.5 @[32rem]:grid-cols-2 @[32rem]:gap-x-4';
/** A role's box: its hover fill reaches past the text, into the tile's padding. */
const ROLE_BOX_CLASS = '-mx-2 flex min-w-0 flex-col gap-0.5 rounded-lg px-2 py-1.5';
const ROLE_LINK_CLASS = `${ROLE_BOX_CLASS} text-foreground transition-colors duration-(--motion-fast) ease-standard hover:bg-surface-2`;
const POSITION_CLASS = 'truncate tile-title text-foreground';
const COMPANY_CLASS = 'truncate tile-meta text-muted-foreground';
const MORE_LINK_CLASS =
  'self-start tile-meta font-medium text-brand-ink underline-offset-4 hover:underline';

const roleHref = (role: Experience): string => `${EXPERIENCE_PATH}/${encodeURIComponent(role._id)}`;

/** The roles the tile lists: every role shown but the first, which the hero names. */
export const rolesBesideHero = ({ roles }: CurrentRoles): readonly Experience[] => roles.slice(1);

/** How many current roles neither the hero nor this tile names. */
const unnamedRoles = ({ roles, total }: CurrentRoles): number => Math.max(0, total - roles.length);

/** 'Elysium · since 2023': the company as people say it, and the year the role began. */
export function roleMeta(role: Experience): string {
  const since = formatYear(role.startDate);
  return joinMeta([companyName(role.company), since ? `since ${since}` : null]);
}

function RoleItem({ role }: { role: Experience }): ReactElement {
  return (
    <li className="min-w-0">
      <Link href={roleHref(role)} prefetch={false} className={ROLE_LINK_CLASS}>
        <span className={POSITION_CLASS}>{role.position}</span>{' '}
        <span className={COMPANY_CLASS}>{roleMeta(role)}</span>
      </Link>
    </li>
  );
}

/**
 * The tile's last line, always there: '+2 more' for the current roles named nowhere on the page,
 * or, with none left unnamed, the empty state's 'All experience' in the same type. So with two
 * roles listed the tile is its skeleton's height whatever the count (without the line it stood
 * 30 px short). With one listed it stays a role shorter stacked (about 56 px); side by side, from
 * a 32rem tile, the one role takes the row two would.
 */
function MoreRoles({ count }: { count: number }): ReactElement {
  return (
    <Link href={EXPERIENCE_PATH} prefetch={false} className={MORE_LINK_CLASS}>
      {count > 0 ? (
        <>
          +{count} more
          <SrOnlyWords>current roles</SrOnlyWords>
        </>
      ) : (
        ALL_EXPERIENCE
      )}
    </Link>
  );
}

export interface RolesTileViewProps {
  result: TileResult<CurrentRoles>;
  now?: Instant;
}

/**
 * The current roles beside the hero's, or a note with a way to the experience page. Stale roles
 * (the list last loaded, served past the deadline) say which day they are from, the note too when
 * the hero's is the only one: the hero names it undated.
 */
export function RolesTileView({ result, now = Date.now() }: RolesTileViewProps): ReactElement {
  const listed = result.status === 'ok' ? rolesBesideHero(result.data) : [];
  const asOf = result.status === 'ok' && result.stale ? formatAsOfDay(result.asOf, now) : '';
  if (result.status !== 'ok' || listed.length === 0) {
    const isError = result.status === 'error';
    const Note = isError ? TileUnavailable : TileEmpty;
    const emptyMessage =
      result.status === 'ok' ? 'No other current roles' : 'No current roles listed';
    const isStale = result.status === 'ok' && result.stale;
    return (
      <Tile className={TILE_CLASS} data-state={isError ? 'error' : isStale ? 'stale' : 'empty'}>
        <TileLabel>{LABEL}</TileLabel>
        <Note
          message={isError ? 'Roles unavailable' : emptyMessage}
          href={EXPERIENCE_PATH}
          linkLabel={ALL_EXPERIENCE}
        />
        {asOf && (
          <TileMeta dated stale>
            {asOf}
          </TileMeta>
        )}
      </Tile>
    );
  }
  return (
    <Tile className={TILE_CLASS} data-state={result.stale ? 'stale' : 'ready'}>
      <TileLabel>{LABEL}</TileLabel>
      <ul className={LIST_CLASS}>
        {listed.map((role) => (
          <RoleItem key={role._id} role={role} />
        ))}
      </ul>
      <MoreRoles count={unnamedRoles(result.data)} />
      {asOf && (
        <TileMeta dated stale>
          {asOf}
        </TileMeta>
      )}
    </Tile>
  );
}

/** The loading roles tile, the loaded one's size: the real label, two roles and the count. */
export function RolesTileSkeleton(): ReactElement {
  return (
    <Tile className={TILE_CLASS} aria-busy="true" data-state="loading">
      <TileLabel>{LABEL}</TileLabel>
      <ul aria-hidden="true" className={LIST_CLASS}>
        {SKELETON_ROLES.map((key) => (
          <li key={key} className={ROLE_BOX_CLASS}>
            <SkeletonLine type="tile-title" bar="h-4 w-4/5" />
            <SkeletonLine type="tile-meta" bar="h-3 w-3/5 rounded-sm" />
          </li>
        ))}
      </ul>
      <SkeletonLine type="tile-meta" bar="h-3 w-16 rounded-sm" className="self-start" />
      <LoadingNote>Loading current roles</LoadingNote>
    </Tile>
  );
}

export async function RolesTile(): Promise<ReactElement> {
  return <RolesTileView result={await loadCurrentRoles()} />;
}
