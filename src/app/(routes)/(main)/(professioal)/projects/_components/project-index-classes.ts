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
 * @file The /projects Index's own layout on the shared kits: the island's root, the five
 * columns as data for the IndexTable kit (style 2, the open index) and the insides of the
 * title, Technology and Links cells. The bar, chips, tokens and empty state come from the
 * FilterBar kit; the rows, year bars and tint hover from the IndexTable kit. Server-safe (no
 * directive): the server rows import it. Palette tokens only.
 *
 * Every size answers to the shell's `page` container: Kind and Started show from a 40rem page
 * (a phone's row is one cell, a meta line and the Links), Technology from 48rem, widening at
 * 64rem so the title keeps its room on a tablet.
 */

import type { IndexColumn } from '@/components/console/index-table';

/** The island's root: the bar, the results header, then the groups. */
export const LIST_CLASS = 'flex flex-col gap-4 @min-[48rem]/page:gap-5';

/**
 * Project (the title over its summary; it takes what the others leave), Kind, Technology,
 * Started (the month: a year bar holds the year; the Featured group's "Dec 2025" must fit) and
 * Links (Code and Live).
 */
export const PROJECT_COLUMNS = [
  { id: 'project', label: 'Project' },
  { id: 'kind', label: 'Kind', priority: 1, width: 'w-[7.5rem] @min-[64rem]/page:w-[9rem]' },
  {
    id: 'tech',
    label: 'Technology',
    priority: 2,
    width: 'w-[12rem] @min-[64rem]/page:w-[17rem]',
  },
  { id: 'started', label: 'Started', align: 'end', priority: 1, width: 'w-[6.5rem]', sort: 'date' },
  {
    id: 'links',
    label: 'Links',
    align: 'end',
    width: 'w-[6.25rem] @min-[40rem]/page:w-[7.5rem]',
  },
] as const satisfies readonly IndexColumn[];

/** The title link's insides: the title truncates, never its pending spinner. */
export const TITLE_LINK_CLASS = 'inline-flex max-w-full items-center gap-2 align-bottom';
export const TITLE_TEXT_CLASS = 'min-w-0 truncate';
/** The title line: the link, which keeps the whole cell's width for its ellipsis. */
export const TITLE_LINE_CLASS = 'flex min-w-0 items-center';
/** Technology: the first three, then a faint "+N" that never truncates. */
export const TECH_LINE_CLASS = 'flex min-w-0 items-baseline gap-1.5';
export const TECH_NAMES_CLASS = 'min-w-0 truncate';
export const TECH_MORE_CLASS = 'flex-none tabular-nums text-faint';
/** Links: Code then Live, each in a fixed slot so every row's links line up. */
export const LINKS_CLASS = 'flex items-center justify-end gap-1';
/** One link's slot (and the link in it): 2.5rem, so Code and Live fit a phone's 6.25rem. */
export const LINK_SLOT_CLASS = 'inline-flex w-10 flex-none justify-center px-0';
