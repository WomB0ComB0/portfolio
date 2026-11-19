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
 * @file /media's list while the feed loads (the page streams it behind this): the island's root
 * with the FilterBar kit's own skeleton (the sticky bar at its size, a box per chip), the results
 * line, then one section of rows on the IndexTable kit, each row the still's box and bars where
 * the title and its meta go, as many as fill a first screen. Built from the classes the loaded
 * list uses, so the header above never moves and the list lands in the room it held. Server-safe
 * (no directive, no hooks); decorative but for the bar's own status and one loading note.
 */

import type { ReactElement } from 'react';

import { FILTER_SCOPE_CLASS, RESULTS_HEAD_CLASS } from '@/components/console/filter-bar';
import { SKELETON_BOX_CLASS } from '@/components/console/filter-bar/filter-bar-classes';
import { FilterBarSkeleton } from '@/components/console/filter-bar/skeleton';
import {
  INDEX_GROUPS_CLASS,
  IndexGroup,
  IndexRow,
  indexCellClass,
} from '@/components/console/index-table';
import { cn } from '@/lib/utils';
import {
  type FeedColumn,
  ITEM_CLASS,
  ITEM_TEXT_CLASS,
  LIST_CLASS,
  SECTION_COLUMNS,
  THUMB_CLASS,
} from './feed-classes';

/** The chips the loaded bar usually offers: All, Writing, Video and Streams. */
const SKELETON_CHIPS = 4;
/** Rows enough to fill a first screen under the header, the bar and the section's bar. */
const SKELETON_ROWS = 8;
/** The first section's columns: Writing, which leads the page whenever there is a post. */
const SKELETON_COLUMNS: readonly FeedColumn[] = SECTION_COLUMNS.post;

const BAR_CLASS = 'block rounded-sm bg-surface-3 motion-safe:animate-pulse forced-colors:outline';
const THUMB_PLACEHOLDER_CLASS = cn(THUMB_CLASS, 'motion-safe:animate-pulse');

/** One row: the still's box beside a title bar over a meta bar, and a bar in every other cell. */
function RowSkeleton(): ReactElement {
  const [item, ...rest] = SKELETON_COLUMNS;
  return (
    <IndexRow data-feed-row-skeleton="">
      <td className={item ? indexCellClass(item) : undefined}>
        <div className={ITEM_CLASS}>
          <span className={THUMB_PLACEHOLDER_CLASS} />
          <span className={cn(ITEM_TEXT_CLASS, 'gap-2')}>
            <span className={cn(BAR_CLASS, 'h-3.5 w-3/4')} />
            <span className={cn(BAR_CLASS, 'h-3 w-1/3')} />
          </span>
        </div>
      </td>
      {rest.map((column) => (
        <td key={column.id} className={indexCellClass(column)}>
          <span className={cn(BAR_CLASS, 'ml-auto h-3 w-16')} />
        </td>
      ))}
    </IndexRow>
  );
}

/** The list's room while the feed loads (see the file comment). */
export function MediaFeedSkeleton(): ReactElement {
  return (
    <div data-media-part="feed-skeleton" className={cn(LIST_CLASS, FILTER_SCOPE_CLASS)}>
      <FilterBarSkeleton sticky chips={SKELETON_CHIPS} />
      <div aria-hidden="true" className={RESULTS_HEAD_CLASS}>
        <span className={cn(SKELETON_BOX_CLASS, 'h-4 w-20')} />
      </div>
      <div aria-hidden="true" className={INDEX_GROUPS_CLASS}>
        <IndexGroup
          id="media-loading"
          year={<span className={cn(BAR_CLASS, 'inline-block h-5 w-20 align-middle')} />}
          count=""
          columns={SKELETON_COLUMNS}
          variant="open"
        >
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity.
            <RowSkeleton key={index} />
          ))}
        </IndexGroup>
      </div>
      <span className="sr-only">Loading writing, videos and streams</span>
    </div>
  );
}
