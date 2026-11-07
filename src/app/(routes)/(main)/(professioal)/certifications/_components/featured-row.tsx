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
 * @file The Featured row: the certificates the owner switched on in Studio (Featured), up to
 * four in display order. Server-safe (no directive, no hooks). With none featured it renders
 * nothing at all: no label, no placeholder.
 *
 * Each tile is a linked console Tile (the whole tile opens the credential in a new tab): issuer
 * and month, the title, then the destination host. Four columns from a 48rem page; on a phone the
 * tiles scroll sideways inside the row, never the page.
 */

import type { ReactElement } from 'react';

import { Tile, TileLink } from '@/components/console';
import type { LedgerEntry } from '../_lib/ledger';

const HEADING_ID = 'featured-certificates';
const LIST_CLASS =
  '-mx-(--page-gutter) -my-1 flex snap-x snap-mandatory scroll-px-(--page-gutter) gap-2 overflow-x-auto px-(--page-gutter) py-1 [scrollbar-width:none] @min-[48rem]/page:mx-0 @min-[48rem]/page:grid @min-[48rem]/page:grid-cols-4 @min-[48rem]/page:gap-3 @min-[48rem]/page:overflow-visible @min-[48rem]/page:px-0';
const TILE_CLASS = 'w-60 flex-none snap-start gap-1 @min-[48rem]/page:w-auto';

function FeaturedTile({ entry }: { readonly entry: LedgerEntry }): ReactElement {
  return (
    <Tile
      as="li"
      variant={entry.link ? 'linked' : 'plain'}
      tone="hero"
      padding="sm"
      className={TILE_CLASS}
    >
      <p className="flex items-baseline justify-between gap-2 tile-meta">
        <span className="min-w-0 truncate text-muted-foreground">{entry.issuer}</span>
        {entry.month && (
          <time dateTime={entry.month.iso} className="shrink-0 text-faint">
            {entry.month.short}
          </time>
        )}
      </p>
      <h3 className="line-clamp-2 min-h-10 tile-sub font-semibold text-foreground">
        <TileLink href={entry.link?.href ?? ''} external className="text-inherit">
          {entry.title}
        </TileLink>
      </h3>
      {entry.link && <p className="truncate tile-meta text-brand-ink">{entry.link.host}</p>}
    </Tile>
  );
}

export interface FeaturedRowProps {
  /** Already capped and ordered by buildLedger. */
  readonly entries: readonly LedgerEntry[];
}

/** The featured certificates, or nothing when the owner has featured none. */
export function FeaturedRow({ entries }: FeaturedRowProps): ReactElement | null {
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby={HEADING_ID} data-featured="" className="flex flex-col gap-2">
      <h2 id={HEADING_ID} className="tile-label text-muted-foreground">
        Featured
      </h2>
      <ul className={LIST_CLASS}>
        {entries.map((entry) => (
          <FeaturedTile key={entry.id} entry={entry} />
        ))}
      </ul>
    </section>
  );
}
