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
 * @file The Ledger's own layout, on the shared kits: the island's root, the four columns as data
 * for the IndexTable kit (style 1, the ruled ledger), and the title and Verify cells' insides. The
 * bar, chips, tokens and empty state come from the FilterBar kit's classes; the rows, year bars
 * and hover from the IndexTable kit's. Server-safe (no directive): the server rows import it.
 *
 * Every size answers to the shell's `page` container: the columns past the title show from a
 * 40rem page (a phone's row is one cell and a meta line), the skills beside a title from 48rem,
 * the Verify column widens with the page. Type is the refined set from globals.css.
 */

import type { IndexColumn } from '@/components/console/index-table';

/** The island's root: the bar, the results header, then the years. */
export const LIST_CLASS = 'flex flex-col gap-4 @min-[48rem]/page:gap-5';

/**
 * Certificate, Issuer, Issued (the month: the year bar holds the year) and Verify (the platform,
 * then Copy ID). The title takes what the others leave.
 */
export const LEDGER_COLUMNS = [
  { id: 'title', label: 'Certificate' },
  {
    id: 'issuer',
    label: 'Issuer',
    priority: 1,
    width: 'w-[8.5rem] @min-[48rem]/page:w-[10rem] @min-[64rem]/page:w-[12rem]',
  },
  { id: 'issued', label: 'Issued', align: 'end', priority: 1, width: 'w-[4.5rem]', sort: 'date' },
  {
    id: 'verify',
    label: 'Verify',
    align: 'end',
    priority: 1,
    width: 'w-[9.5rem] @min-[48rem]/page:w-[11.5rem]',
  },
] as const satisfies readonly IndexColumn[];

/** The title line: the title, then its skills, faint, in whatever room is left. */
export const TITLE_LINE_CLASS = 'flex min-w-0 items-baseline gap-3';
/** The skills beside a title: from 48rem, truncated first so the title keeps its room. */
export const SKILLS_CLASS =
  'hidden min-w-0 flex-1 truncate tile-meta text-faint @min-[48rem]/page:block';
/** Verify: the platform (its text truncates, never its arrow), then the Copy ID slot. */
export const VERIFY_CLASS = 'flex min-w-0 items-center justify-end gap-1';
export const PLATFORM_CLASS = 'flex min-w-0 items-baseline [&_[data-new-tab-arrow]]:text-faint';
/** Where a Copy ID button would be, so every platform name lines up down the column. */
export const ID_SLOT_CLASS = 'inline-block w-9 flex-none';
