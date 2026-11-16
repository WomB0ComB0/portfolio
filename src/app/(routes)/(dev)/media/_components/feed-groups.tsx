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
 * @file The One feed's years, which the filter island renders from the rows it keeps: one
 * IndexTable group per year in style 2 (the open index), newest first, Undated last, each named
 * by its h2 ("2025, 12 items" to a screen reader) with the column labels in its sticky bar.
 * Server-safe: no directive, no hooks.
 */

import { Fragment, type ReactElement, type ReactNode } from 'react';

import { INDEX_GROUPS_CLASS, IndexGroup } from '@/components/console/index-table';
import { groupByYear } from '../_lib/media-rows';
import { FEED_COLUMNS } from './feed-classes';

/** What grouping needs of a row, plus the row itself. */
export interface GroupedFeedRow {
  readonly id: string;
  readonly year: string;
  /** How many items the row stands for: a folded row's uploads; one when left out. */
  readonly count?: number;
  /** The <tr>, rendered on the server. */
  readonly row: ReactNode;
}

/** "1 item", "12 items": the rows' items added up. */
function itemCount(rows: readonly GroupedFeedRow[]): string {
  const count = rows.reduce((sum, row) => sum + (row.count ?? 1), 0);
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

/** The rows in their years, each year keeping the rows' order. */
export function FeedGroups({ items }: { readonly items: readonly GroupedFeedRow[] }): ReactElement {
  return (
    <div className={INDEX_GROUPS_CLASS}>
      {groupByYear(items).map(({ year, rows }) => (
        <IndexGroup
          key={year}
          id={`media-year-${year.toLowerCase()}`}
          year={year}
          count={itemCount(rows)}
          columns={FEED_COLUMNS}
          variant="open"
        >
          {rows.map((item) => (
            <Fragment key={item.id}>{item.row}</Fragment>
          ))}
        </IndexGroup>
      ))}
    </div>
  );
}
