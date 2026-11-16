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
 * @file The ways to sponsor as plain rows: one linked Tile per platform, so each row lifts on the
 * kit's spring hover (never a scale) and the whole row is its one link, to a new tab. Each row has
 * a monochrome icon (fg-muted on surface-2, brand-ink only while its row is hovered or its link
 * has keyboard focus), the name and one line. No amounts: the owner decided against rates.
 * Server-safe: no directive, no hooks.
 *
 * With text enlarged, on a page under ten lines of its own text wide (never at the browser's own
 * size, where a 320px phone is 12 lines wide), the icon sits above the words, which then get the
 * row's whole width instead of a sliver beside the icon.
 */

import type { ReactElement } from 'react';
import type { IconType } from 'react-icons';
import { SiBuymeacoffee, SiGithubsponsors, SiKofi, SiOpencollective } from 'react-icons/si';

import { Tile, TileLink } from '@/components/console';
import { PRIMARY_WAY_ID, type SponsorWay, type SponsorWayId } from '../_lib/ways';
import { SECTION_LABEL_CLASS } from './sponsor-classes';

const WAY_ICONS: Readonly<Record<SponsorWayId, IconType>> = {
  'github-sponsors': SiGithubsponsors,
  'open-collective': SiOpencollective,
  'ko-fi': SiKofi,
  'buy-me-a-coffee': SiBuymeacoffee,
};

const WAYS_HEADING_ID = 'sponsor-ways-heading';

/** The row: icon beside the words; the icon above them on a page under ten lines wide. */
const ROW_CLASS =
  'flex-row items-center gap-3.5 @max-[10lh]/page:flex-col @max-[10lh]/page:items-start';

/**
 * The icon's chip. Its colour follows the row's hover and its link's keyboard focus on the
 * effect easing; nothing moves but the row itself.
 */
const ICON_CHIP_CLASS = [
  'grid size-10 shrink-0 place-items-center rounded-[0.625rem] bg-surface-2 text-muted-foreground',
  'shadow-[inset_0_0_0_1px_var(--hairline)]',
  'transition-colors duration-(--motion-base) ease-effect',
  'group-hover/tile:text-brand-ink group-has-[[data-tile-link]:focus-visible]/tile:text-brand-ink',
].join(' ');

/** The name and its line. A word longer than its line breaks only as a last resort. */
const BODY_CLASS = 'min-w-0 flex-1 space-y-0.5 [overflow-wrap:anywhere]';

/** One platform. The primary way (GitHub Sponsors) carries the kit's hero wash. */
function WayRow({ way }: { readonly way: SponsorWay }): ReactElement {
  const Icon = WAY_ICONS[way.id];
  return (
    <Tile
      as="li"
      variant="linked"
      tone={way.id === PRIMARY_WAY_ID ? 'hero' : 'default'}
      className={ROW_CLASS}
    >
      <span aria-hidden="true" className={ICON_CHIP_CLASS}>
        <Icon className="size-5" />
      </span>
      <div className={BODY_CLASS}>
        <h3 className="tile-title text-foreground">
          {/* text-inherit: the name stays foreground; brand is for the row's hover and focus. */}
          <TileLink href={way.href} external={way.newTab} className="text-inherit">
            {way.name}
          </TileLink>
        </h3>
        <p className="tile-sub text-muted-foreground">{way.purpose}</p>
      </div>
    </Tile>
  );
}

export interface WaysListProps {
  /** Already shaped (shapeWays): primary first, every link usable. */
  readonly ways: readonly SponsorWay[];
}

/** The ways to sponsor, in order. */
export function WaysList({ ways }: WaysListProps): ReactElement {
  return (
    <section aria-labelledby={WAYS_HEADING_ID} data-sponsor-ways="" className="flex flex-col gap-3">
      <h2 id={WAYS_HEADING_ID} className={SECTION_LABEL_CLASS}>
        Ways to sponsor
      </h2>
      <ul className="grid gap-2.5">
        {ways.map((way) => (
          <WayRow key={way.id} way={way} />
        ))}
      </ul>
    </section>
  );
}
