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
 * @file The home current-roles tile: up to three current roles in Studio order, each a link to
 * its page, and how many more there are. A plain tile, because it holds several links.
 *
 * Below a 20rem tile the third role is hidden, and the '+N more' count grows by one to match, so
 * the count always says how many roles are not on screen.
 */

import Link from 'next/link';
import type { ReactElement } from 'react';

import { SrOnlyWords, Tile } from '@/components/console';
import type { Experience } from '@/lib/sanity/loaders';
import { cn } from '@/lib/utils';
import { formatAsOfDay, formatMonthYear, type Instant } from '../data/format';
import { loadCurrentRoles } from '../data/loaders';
import type { CurrentRoles } from '../data/selectors';
import type { TileResult } from '../data/tile-result';
import {
  joinMeta,
  LoadingNote,
  SkeletonBar,
  TileEmpty,
  TileLabel,
  TileMeta,
  TileUnavailable,
} from './tile-states';

const LABEL = 'Current roles';
const EXPERIENCE_PATH = '/experience';
/** Roles listed below a 20rem tile; ROLES_SHOWN (3) above it. */
const NARROW_ROLES_SHOWN = 2;

const ROLE_LINK_CLASS =
  '-mx-2 block rounded-md px-2 py-1.5 text-foreground transition-colors duration-(--motion-fast) ease-standard hover:bg-surface-2';
/** line-clamp sets its own display (a clamped box), so the span needs no `block`. */
const POSITION_CLASS = 'line-clamp-2 wrap-break-word text-body-sm font-semibold';
const COMPANY_CLASS = 'block truncate font-mono text-meta text-muted-foreground';
const MORE_LINK_CLASS = 'font-mono text-meta font-medium text-brand-ink hover:underline';

const roleHref = (role: Experience): string => `${EXPERIENCE_PATH}/${encodeURIComponent(role._id)}`;

function RoleItem({ role, index }: { role: Experience; index: number }): ReactElement {
  const since = formatMonthYear(role.startDate);
  return (
    <li className={index >= NARROW_ROLES_SHOWN ? 'hidden @xs:block' : undefined}>
      <Link href={roleHref(role)} prefetch={false} className={ROLE_LINK_CLASS}>
        <span className={POSITION_CLASS}>{role.position}</span>{' '}
        <span className={COMPANY_CLASS}>
          {joinMeta([role.company, since ? `since ${since}` : null])}
        </span>
      </Link>
    </li>
  );
}

function MoreLink({ count, className }: { count: number; className?: string }): ReactElement {
  return (
    <Link href={EXPERIENCE_PATH} prefetch={false} className={cn(MORE_LINK_CLASS, className)}>
      +{count} more
      <SrOnlyWords>current roles</SrOnlyWords>
    </Link>
  );
}

/** How many roles are not on screen below the 20rem tile (at least as many as above it). */
const hiddenWhenNarrow = ({ roles, total }: CurrentRoles): number =>
  total - Math.min(roles.length, NARROW_ROLES_SHOWN);

/**
 * '+N more' for the roles not on screen. When the narrow and wide counts differ, one link shows
 * below the 20rem tile and the other above it; display: none keeps the hidden one unread.
 */
function MoreRoles({ roles, total }: CurrentRoles): ReactElement | null {
  const wide = total - roles.length;
  const narrow = hiddenWhenNarrow({ roles, total });
  if (narrow <= 0) return null;
  if (narrow === wide) {
    return (
      <p className="mt-auto">
        <MoreLink count={narrow} />
      </p>
    );
  }
  return (
    <p className="mt-auto">
      <MoreLink count={narrow} className="@xs:hidden" />
      {wide > 0 && <MoreLink count={wide} className="hidden @xs:inline" />}
    </p>
  );
}

export interface RolesTileViewProps {
  result: TileResult<CurrentRoles>;
  now?: Instant;
}

/**
 * The current roles, or a note with a way to the experience page. Stale roles (the list last
 * loaded, served past the deadline) say which day they are from.
 */
export function RolesTileView({ result, now = Date.now() }: RolesTileViewProps): ReactElement {
  if (result.status !== 'ok') {
    const Note = result.status === 'error' ? TileUnavailable : TileEmpty;
    return (
      <Tile className="gap-3" data-state={result.status}>
        <TileLabel>{LABEL}</TileLabel>
        <Note
          className="mt-auto"
          message={result.status === 'error' ? 'Roles unavailable' : 'No current roles listed'}
          href={EXPERIENCE_PATH}
          linkLabel="All experience"
        />
      </Tile>
    );
  }
  const { roles } = result.data;
  const asOf = result.stale ? formatAsOfDay(result.asOf, now) : '';
  return (
    <Tile className="gap-3" data-state={result.stale ? 'stale' : undefined}>
      <TileLabel>{LABEL}</TileLabel>
      <ul className="flex flex-col gap-1">
        {roles.map((role, index) => (
          <RoleItem key={role._id} role={role} index={index} />
        ))}
      </ul>
      <MoreRoles {...result.data} />
      {asOf && (
        // Under the '+N more' link, which already takes the tile's foot, when there is one.
        <TileMeta dated className={hiddenWhenNarrow(result.data) > 0 ? 'mt-0' : undefined}>
          {asOf}
        </TileMeta>
      )}
    </Tile>
  );
}

/** The loading roles tile, with the real label. */
export function RolesTileSkeleton(): ReactElement {
  return (
    <Tile className="gap-3" aria-busy="true" data-state="loading">
      <TileLabel>{LABEL}</TileLabel>
      <div className="flex flex-col gap-3">
        <SkeletonBar className="h-9 w-4/5" />
        <SkeletonBar className="h-9 w-3/5" />
      </div>
      <LoadingNote>Loading current roles</LoadingNote>
    </Tile>
  );
}

export async function RolesTile(): Promise<ReactElement> {
  return <RolesTileView result={await loadCurrentRoles()} />;
}
