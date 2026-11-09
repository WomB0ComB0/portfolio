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
 * @file The Ledger's year tables, which the filter island renders from the rows it keeps: one
 * IndexTable group per year, newest first, in style 1 (the ruled ledger). Each is named by its h2
 * ("2024, 26 certificates" to a screen reader: a pause between the year and the count), and every
 * year's sticky bar carries the column labels, so a year far down the page still says what its
 * columns are.
 */

import { Fragment, type ReactElement, type ReactNode } from 'react';

import { INDEX_GROUPS_CLASS, IndexGroup } from '@/components/console/index-table';
import { countLabel } from '../_lib/format';
import { groupByYear, type LedgerEntry } from '../_lib/ledger';
import { LEDGER_COLUMNS } from './ledger-classes';

/** What the island needs of a row to filter and group it, plus the row itself. */
export interface LedgerRowItem
  extends Pick<LedgerEntry, 'id' | 'year' | 'familySlug' | 'chip' | 'skills' | 'haystack'> {
  /** The <tr>, rendered on the server. */
  readonly row: ReactNode;
}

/** The rows in year tables, newest year first, each keeping the rows' order. */
export function YearTables({ items }: { readonly items: readonly LedgerRowItem[] }): ReactElement {
  return (
    <div className={INDEX_GROUPS_CLASS}>
      {groupByYear(items).map((group) => (
        <IndexGroup
          key={group.year}
          id={`certificates-${group.year}`}
          year={group.year}
          count={countLabel(group.entries.length)}
          columns={LEDGER_COLUMNS}
          variant="ledger"
        >
          {group.entries.map((item) => (
            <Fragment key={item.id}>{item.row}</Fragment>
          ))}
        </IndexGroup>
      ))}
    </div>
  );
}
