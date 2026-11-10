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
 * @file The /projects Index's groups, which the filter island renders from the rows it keeps:
 * one IndexTable group per heading in style 2 (the open index), in the rows' own order (the
 * Featured group, then the years newest first, then Undated). Each is named by its h2
 * ("Featured, 4 projects" to a screen reader), and every group's sticky bar carries the column
 * labels. Server-safe: no directive, no hooks.
 */

import { Fragment, type ReactElement, type ReactNode } from 'react';

import { INDEX_GROUPS_CLASS, IndexGroup } from '@/components/console/index-table';
import { groupId, groupInOrder } from '../_lib/project-order';
import { projectCount } from '../_lib/project-text';
import { PROJECT_COLUMNS } from './project-index-classes';

/** What grouping needs of a row, plus the row itself. */
export interface GroupedRow {
  readonly id: string;
  readonly group: string;
  readonly groupLabel: string;
  /** The <tr>, rendered on the server. */
  readonly row: ReactNode;
}

/** The rows in their groups, each group keeping the rows' order. */
export function ProjectGroups({ items }: { readonly items: readonly GroupedRow[] }): ReactElement {
  return (
    <div className={INDEX_GROUPS_CLASS}>
      {groupInOrder(items, (item) => item.group).map(({ key, items: rows }) => (
        <IndexGroup
          key={key}
          id={groupId(key)}
          year={rows[0]?.groupLabel ?? key}
          count={projectCount(rows.length)}
          columns={PROJECT_COLUMNS}
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
