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
 * @file The parts a role page shows beyond the role's name: its length with the figures set
 * apart from their units, its links as named chips and its technologies as tokens that link
 * into /projects, and the keys its lists share.
 * Server-safe (no directive, no hooks). Palette tokens only.
 *
 * - A chip is a real link in a new tab, named by a proper name, a repository slug (the mono
 *   token) or the host, with the site faint beside a name.
 * - A token links only where /projects has the technology, and then says how many projects in
 *   words ("22 projects"), never a bare number. One that leads nowhere is plain text.
 * - Links are at least 24px tall, and on a touch screen their target is 44px.
 */

import Link from 'next/link';
import type { ReactElement } from 'react';

import { NEW_TAB_LABEL, NewTabArrow, SrOnlyWords } from '@/components/console';
import { cn } from '@/lib/utils';
import { projectCount } from '../../projects/_lib/project-text';
import type { RoleLength } from '../_lib/role-length';
import type { RoleLink } from '../_lib/role-links';
import type { TechToken } from '../_lib/role-tech';

/**
 * On a touch screen a link's target reaches 44px without the pill itself growing that tall. The
 * pill is 32px; its overlay is set from its padding box, which a 1px border leaves at 30px, so
 * the overlay reaches 7px past it above and below: 44px with a border, 46px without.
 */
export const TOUCH_TARGET_CLASS =
  "relative pointer-coarse:min-h-8 pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-[7px] pointer-coarse:after:content-['']";
/** A wrapping row of pills; on a touch screen the rows stand clear of each other's targets. */
const PILLS_CLASS = 'flex flex-wrap gap-1.5 pointer-coarse:gap-x-2 pointer-coarse:gap-y-3';

const LENGTH_FIGURE_CLASS = 'font-semibold text-foreground';
const LENGTH_UNIT_CLASS = 'text-muted-foreground';

export interface RoleLengthFigureProps {
  readonly length: RoleLength;
  readonly className?: string;
}

/**
 * '3 yrs 11 mos' with the figures bright and the units quiet. Screen readers hear whole words
 * ("3 years 11 months") instead; they are kept out of a copied length.
 */
export function RoleLengthFigure({ length, className }: RoleLengthFigureProps): ReactElement {
  return (
    <span data-role-length="" className={cn('whitespace-nowrap tabular-nums', className)}>
      <span aria-hidden="true">
        {length.parts.map((part, index) => (
          <span key={part.unit}>
            {index > 0 && ' '}
            <span className={LENGTH_FIGURE_CLASS}>{part.value}</span>{' '}
            <span className={LENGTH_UNIT_CLASS}>{part.unit}</span>
          </span>
        ))}
      </span>
      <span className="sr-only select-none">{length.spoken}</span>
    </span>
  );
}

/**
 * Each entry with a key that stays unique when the CMS lists the same text twice; the role page
 * keys its duties and technologies with it.
 */
export function withKeys(
  items: readonly string[],
): { readonly key: string; readonly text: string }[] {
  const seen = new Map<string, number>();
  return items.map((text) => {
    const count = seen.get(text) ?? 0;
    seen.set(text, count + 1);
    return { key: `${text}#${count}`, text };
  });
}

/** A chip: a quiet surface that takes a stronger rim, and its name the brand ink, on hover. */
const CHIP_CLASS = `group/chip inline-flex min-h-7 max-w-full flex-wrap items-center gap-x-1.5 rounded-md border border-hairline bg-surface-2 px-2.5 py-1 text-faint no-underline transition-[border-color,color] duration-(--motion-fast) ease-effect hover:border-hairline-strong hover:text-brand-ink ${TOUCH_TARGET_CLASS}`;
const CHIP_NAME_CLASS =
  'min-w-0 text-foreground transition-colors duration-(--motion-fast) ease-effect [overflow-wrap:anywhere] group-hover/chip:text-brand-ink';
const CHIP_HOST_CLASS = 'tile-meta text-faint';

export interface RoleLinkChipsProps {
  readonly links: readonly RoleLink[];
  readonly className?: string;
}

/** The role's links as named chips, each opening in a new tab; nothing for no links. */
export function RoleLinkChips({ links, className }: RoleLinkChipsProps): ReactElement | null {
  if (links.length === 0) return null;
  return (
    <ul data-role-links="" className={cn(PILLS_CLASS, className)}>
      {links.map((link) => (
        <li key={link.href} className="max-w-full">
          <a href={link.href} target="_blank" rel="noopener noreferrer" className={CHIP_CLASS}>
            <span className={cn(CHIP_NAME_CLASS, link.token ? 'mono-token' : 'tile-label')}>
              {link.label}
            </span>{' '}
            {link.host && <span className={CHIP_HOST_CLASS}>{link.host}</span>}
            <NewTabArrow />
            <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Every token is one height, linked or not: 28px, or 32px on a touch screen. It is never wider
 * than its line: where enlarged text leaves it no room, its count goes under its name.
 */
const TOKEN_CLASS =
  'inline-flex min-h-7 max-w-full flex-wrap items-center gap-x-1.5 rounded-full border px-2.5 tile-meta pointer-coarse:min-h-8';
/** A technology no project has: plain text in an outline. */
const TOKEN_PLAIN_CLASS = `${TOKEN_CLASS} border-hairline text-muted-foreground`;
/** One that leads to /projects: a surface, brighter text, and the brand's selected fill on hover. */
const TOKEN_LINK_CLASS = `${TOKEN_CLASS} group/token border-hairline bg-surface-2 text-foreground no-underline transition-[border-color,background-color] duration-(--motion-fast) ease-effect hover:border-(--brand-edge) hover:bg-brand-subtle ${TOUCH_TARGET_CLASS}`;
const TOKEN_COUNT_CLASS =
  'text-faint transition-colors duration-(--motion-fast) ease-effect group-hover/token:text-muted-foreground';

/** Each token with a key that stays unique when the CMS lists a technology twice. */
function tokenKeys(
  tech: readonly TechToken[],
): { readonly key: string; readonly token: TechToken }[] {
  const keys = withKeys(tech.map((token) => token.name));
  return tech.map((token, index) => ({ key: keys[index]?.key ?? token.name, token }));
}

export interface RoleTechTokensProps {
  readonly tech: readonly TechToken[];
  readonly className?: string;
}

/**
 * The role's technologies. One /projects has links there, filtered by it, with the number of
 * projects in words; the rest are plain. Nothing for no technologies.
 */
export function RoleTechTokens({ tech, className }: RoleTechTokensProps): ReactElement | null {
  if (tech.length === 0) return null;
  return (
    <ul data-role-tech="" className={cn(PILLS_CLASS, className)}>
      {tokenKeys(tech).map(({ key, token }) => (
        <li key={key} className="max-w-full">
          {token.link ? (
            <Link href={token.link.href} prefetch={false} className={TOKEN_LINK_CLASS}>
              {token.name}{' '}
              <span className={TOKEN_COUNT_CLASS}>{projectCount(token.link.projects)}</span>
            </Link>
          ) : (
            <span className={TOKEN_PLAIN_CLASS}>{token.name}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
