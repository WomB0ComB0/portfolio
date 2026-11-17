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

import type { ReactElement } from 'react';
import type { RoleSubRole } from '../_lib/role-subroles';
import { RolePeriodText } from './role-parts';
import { RoleLengthFigure, RoleLinkChips, RoleTechTokens, withKeys } from './role-row-parts';

const ROLE_PROGRESSION_LABEL = 'Roles at this organization';

export interface RoleProgressionProps {
  /** Unique to the parent engagement on this page. */
  readonly id: string;
  readonly subRoles: readonly RoleSubRole[];
  readonly variant?: 'compact' | 'full';
}

function Dates({ role }: { readonly role: RoleSubRole }): ReactElement {
  return (
    <p
      data-sub-role-period=""
      className="flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-1 tile-meta text-muted-foreground"
    >
      <span className="min-w-0">
        <RolePeriodText period={role.period} />
      </span>
      {role.length ? (
        <>
          <span aria-hidden="true">·</span>
          <RoleLengthFigure
            length={role.length}
            className="[&_span]:font-normal [&_span]:text-inherit"
          />
        </>
      ) : null}
      {role.employmentType ? (
        <>
          <span aria-hidden="true">·</span>
          <span>{role.employmentType}</span>
        </>
      ) : null}
    </p>
  );
}

/** A shared parent-tenure scale, never a progress meter or another employment count. */
function Interval({ lane }: Pick<RoleSubRole, 'lane'>): ReactElement | null {
  if (!lane) return null;
  return (
    <span
      data-sub-role-lane=""
      aria-hidden="true"
      className="relative block h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
    >
      <span
        className="absolute inset-y-0 rounded-full bg-brand"
        style={{ left: `${lane.startPercent}%`, width: `${lane.widthPercent}%` }}
      />
    </span>
  );
}

function Content({ role }: { readonly role: RoleSubRole }): ReactElement | null {
  if (
    !role.description &&
    role.duties.length === 0 &&
    role.links.length === 0 &&
    role.tech.length === 0
  )
    return null;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {role.description ? (
        <p className="max-w-[68ch] text-body-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
          {role.description}
        </p>
      ) : null}
      {role.duties.length > 0 ? (
        <ul className="flex min-w-0 max-w-[68ch] list-disc flex-col gap-1 pl-5 text-body-sm leading-6 text-muted-foreground">
          {withKeys(role.duties).map(({ key, text }) => (
            <li key={key} className="[overflow-wrap:anywhere]">
              {text}
            </li>
          ))}
        </ul>
      ) : null}
      <RoleLinkChips links={role.links} />
      <RoleTechTokens tech={role.tech} />
    </div>
  );
}

/** Nested dates on the index; full child detail below the parent's existing clock. */
export function RoleProgression({
  id,
  subRoles = [],
  variant = 'full',
}: RoleProgressionProps): ReactElement | null {
  if (subRoles.length === 0) return null;
  const compact = variant === 'compact';
  const Heading = compact ? 'h4' : 'h3';
  const list = (
    <ol
      id={compact ? id : undefined}
      data-role-progression={compact ? 'compact' : undefined}
      aria-label={compact ? ROLE_PROGRESSION_LABEL : undefined}
      className={
        compact
          ? 'mt-3 flex min-w-0 flex-col gap-3 border-l border-hairline-strong pl-3'
          : 'flex min-w-0 flex-col gap-5'
      }
    >
      {subRoles.map((role) => (
        <li
          key={role.key}
          data-sub-role=""
          data-sub-role-key={role.key}
          className={
            compact
              ? 'min-w-0'
              : 'flex min-w-0 flex-col gap-3 border-b border-hairline pb-5 last:border-0 last:pb-0'
          }
        >
          <div className="flex min-w-0 flex-col gap-1">
            <Heading
              className={
                compact
                  ? 'text-body-sm font-medium leading-5 text-foreground [overflow-wrap:anywhere]'
                  : 'tile-title text-foreground [overflow-wrap:anywhere]'
              }
            >
              {role.position}
            </Heading>
            <Dates role={role} />
          </div>
          {compact ? null : (
            <>
              <Interval lane={role.lane} />
              <Content role={role} />
            </>
          )}
        </li>
      ))}
    </ol>
  );
  if (compact) return list;
  return (
    <section
      id={id}
      data-role-progression="full"
      aria-labelledby={`${id}-title`}
      className="flex min-w-0 flex-col gap-4"
    >
      <h2
        id={`${id}-title`}
        className="border-b border-hairline-strong pb-2 tile-title text-foreground"
      >
        {ROLE_PROGRESSION_LABEL}
      </h2>
      {subRoles.some((role) => role.lane !== null) ? (
        <p aria-hidden="true" className="tile-meta text-faint">
          Each bar shows its share of the overall tenure.
        </p>
      ) : null}
      {list}
    </section>
  );
}
