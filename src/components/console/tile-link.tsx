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

/**
 * @file The stretched link of a `linked` Tile. Server-safe (no directive, no hooks).
 *
 * A `linked` tile is not a link itself, so it can hold more than one: TileLink is its primary
 * link, and an `::after` overlay stretches it over the whole tile. Other links in the tile stay
 * clickable by sitting above the overlay with `relative z-10`.
 */

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** What screen readers hear after a link that opens a new tab. */
export const NEW_TAB_LABEL = '(opens in a new tab)';

/**
 * The overlay covers the nearest positioned ancestor. Inside a linked Tile (`data-linked-tile`)
 * the link drops its own focus ring, because the tile rings itself through
 * `has-[[data-tile-link]:focus-visible]`. Anywhere else it keeps the base `:focus-visible` ring:
 * its overlay still makes the area around it clickable, and keyboard focus must stay visible.
 */
const STRETCHED_LINK_CLASS =
  "after:absolute after:inset-0 after:content-[''] after:rounded-[inherit] [[data-linked-tile]_&]:focus-visible:outline-none";

/** U+2060 WORD JOINER: invisible, and no line may break just before or after it. */
const WORD_JOINER = '\u2060';

/**
 * The new-tab arrow, glued to the word before it. The nowrap span starts with a WORD JOINER, so
 * there is no break opportunity between the link's last word and the icon, and the arrow never
 * wraps onto a line of its own. The span is aria-hidden as a whole, so the joiner stays out of
 * the accessible name too.
 */
function NewTabArrow(): ReactElement {
  return (
    <span aria-hidden="true" data-new-tab-arrow="" className="shrink-0 whitespace-nowrap">
      {WORD_JOINER}
      <ArrowUpRight aria-hidden="true" className="ml-0.5 inline size-3.5" />
    </span>
  );
}

export interface TileLinkProps {
  /** An empty or '#' href renders the children as text, with no link. Linked trimmed. */
  href: string;
  /** Opens in a new tab, with an arrow icon and a spoken "(opens in a new tab)". */
  external?: boolean;
  /** Read only by screen readers, after the visible text, e.g. "about Fraud Guard". */
  srSuffix?: string;
  /** Internal links only. Off by default: a page of tiles would prefetch every target at once. */
  prefetch?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Words only screen readers hear, after what comes before them. The separating space is a text
 * node outside the hidden span: a space inside it is trimmed by some accessible-name engines,
 * which then run the words together ("Read moreabout ...").
 */
export function SrOnlyWords({ children }: { children: ReactNode }): ReactElement {
  return (
    <>
      {' '}
      <span className="sr-only">{children}</span>
    </>
  );
}

/**
 * Where `href` leads, trimmed, or null when it leads nowhere. A missing, blank or bare '#' href
 * comes from data with no URL; linking it would reload the page (or open a copy of it in a new
 * tab), so console components render text or a plain tile instead.
 *
 * Link the returned string, never the raw href: trim() also strips non-breaking spaces, which a
 * browser does not strip from an href but percent-encodes into the path.
 */
export function destinationOf(href: string | undefined): string | null {
  const trimmed = href?.trim() ?? '';
  return trimmed === '' || trimmed === '#' ? null : trimmed;
}

/** Whether `href` leads anywhere (see destinationOf, whose trimmed value is what to link). */
export const hasDestination = (href: string | undefined): href is string =>
  destinationOf(href) !== null;

/**
 * The one link that makes a whole `linked` Tile clickable. It carries `data-tile-link`, which the
 * tile's focus ring keys on, so focusing another link in the tile does not ring the whole tile.
 *
 * The tile must be the nearest positioned ancestor (Tile is `relative`); put no other positioned
 * element between them, or the overlay shrinks to that element. With no destination it renders
 * text, so render that tile as `plain` too (`hasDestination(href)`), or it still lifts on hover.
 *
 * @example
 * <Tile variant="linked">
 *   <h3><TileLink href="/projects/fraud-guard">Fraud Guard</TileLink></h3>
 *   <a className="relative z-10" href={commitUrl}>Latest commit</a>
 * </Tile>
 */
export function TileLink({
  href,
  external = false,
  srSuffix,
  prefetch = false,
  className,
  children,
}: TileLinkProps): ReactElement {
  const destination = destinationOf(href);
  if (destination === null) return <span className={className}>{children}</span>;

  const linkClassName = cn(STRETCHED_LINK_CLASS, className);
  const suffix = srSuffix ? <SrOnlyWords>{srSuffix}</SrOnlyWords> : null;

  if (external) {
    return (
      <a
        href={destination}
        target="_blank"
        rel="noopener noreferrer"
        data-tile-link=""
        className={linkClassName}
      >
        {children}
        <NewTabArrow />
        {suffix}
        <SrOnlyWords>{NEW_TAB_LABEL}</SrOnlyWords>
      </a>
    );
  }

  return (
    <Link href={destination} prefetch={prefetch} data-tile-link="" className={linkClassName}>
      {children}
      {suffix}
    </Link>
  );
}
