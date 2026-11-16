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

'use client';

/**
 * @file How a row refers to its series depends on the list it is shown in, and the rows are
 * server markup the filter island only arranges. So a row in a series carries both forms of its
 * "see also" line, rendered on the server, and this picks one: the link ("Series: Upload 3 of
 * 27") or the place said as text ("Upload 3 of 27"). The island says which rows take the text
 * (feed-sections.tsx plainSeriesRows): every row of a series the list already holds whole, where
 * the link would only show the same rows again, and the rows of a long series, where one link is
 * enough (the line that closes a series cut to its newest uploads, or the first row of one
 * listed in part). Only the form picked is in the HTML, with and without JavaScript. Outside the
 * island (no provider) a row keeps its link.
 */

import { createContext, type ReactElement, type ReactNode, useContext } from 'react';

const NO_ROWS: ReadonlySet<string> = new Set();

/** The ids of the rows that say their place in their series as text, in the list as shown. */
const PlainSeriesRows = createContext<ReadonlySet<string>>(NO_ROWS);

export interface PlainSeriesProviderProps {
  /** The ids of the rows whose series is not a link just now. */
  readonly rows: ReadonlySet<string>;
  readonly children: ReactNode;
}

/** Tells the rows inside it which of them say their series place as text. */
export function PlainSeriesProvider({ rows, children }: PlainSeriesProviderProps): ReactElement {
  return <PlainSeriesRows.Provider value={rows}>{children}</PlainSeriesRows.Provider>;
}

export interface SeriesReferenceProps {
  /** The row's id, as the island knows it. */
  readonly rowId: string;
  /** The row's "see also" line with its series as a link. */
  readonly linked: ReactNode;
  /** The same line with the place said as text, for a list where the link leads nowhere new. */
  readonly plain: ReactNode;
}

/** The form of a row's series reference that fits the list it is shown in. */
export function SeriesReference({ rowId, linked, plain }: SeriesReferenceProps): ReactNode {
  return useContext(PlainSeriesRows).has(rowId) ? plain : linked;
}
