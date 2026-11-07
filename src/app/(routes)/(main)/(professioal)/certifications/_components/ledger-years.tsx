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
 * table per year, newest first, each named by its h2 ("2024, 26 certificates" to a screen reader:
 * a pause between the year and the count). The column header row shows once, under the first
 * year, as in the lab; every later table keeps it for screen readers, hidden in place.
 */

import { Fragment, type ReactElement, type ReactNode } from 'react';

import { countLabel } from '../_lib/format';
import { groupByYear, type LedgerEntry } from '../_lib/ledger';
import {
  ISSUED_COL_CLASS,
  ISSUER_COL_CLASS,
  TABLE_CLASS,
  TH_CLASS,
  TH_HIDDEN_CLASS,
  THEAD_CLASS,
  VERIFY_COL_CLASS,
  YEAR_COUNT_CLASS,
  YEAR_HEAD_CLASS,
} from './ledger-classes';

/** What the island needs of a row to filter and group it, plus the row itself. */
export interface LedgerRowItem
  extends Pick<LedgerEntry, 'id' | 'year' | 'familySlug' | 'chip' | 'skills' | 'haystack'> {
  /** The <tr>, rendered on the server. */
  readonly row: ReactNode;
}

const COLUMNS = ['Certificate', 'Issuer', 'Issued', 'Verify'] as const;

interface YearTableProps {
  readonly year: string;
  readonly items: readonly LedgerRowItem[];
  /** The first year shows the column header row; the others keep it for readers only. */
  readonly first: boolean;
}

function YearTable({ year, items, first }: YearTableProps): ReactElement {
  const headingId = `certificates-${year}`;
  const headerClass = (column: string): string =>
    !first ? TH_HIDDEN_CLASS : column === 'Issued' ? `${TH_CLASS} text-right` : TH_CLASS;
  return (
    <section className="flex flex-col">
      <h2 id={headingId} data-ledger-part="year-head" className={YEAR_HEAD_CLASS}>
        <span>{year}</span>
        <span className="sr-only">,</span>{' '}
        <span className={YEAR_COUNT_CLASS}>{countLabel(items.length)}</span>
      </h2>
      <table aria-labelledby={headingId} className={TABLE_CLASS}>
        <colgroup>
          <col />
          <col className={ISSUER_COL_CLASS} />
          <col className={ISSUED_COL_CLASS} />
          <col className={VERIFY_COL_CLASS} />
        </colgroup>
        <thead className={THEAD_CLASS}>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className={headerClass(column)}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <Fragment key={item.id}>{item.row}</Fragment>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** The rows in year tables, newest year first, each keeping the rows' order. */
export function YearTables({ items }: { readonly items: readonly LedgerRowItem[] }): ReactElement {
  return (
    <>
      {groupByYear(items).map((group, index) => (
        <YearTable key={group.year} year={group.year} items={group.entries} first={index === 0} />
      ))}
    </>
  );
}
