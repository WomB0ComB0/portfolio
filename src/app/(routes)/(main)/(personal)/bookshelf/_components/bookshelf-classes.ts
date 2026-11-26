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
 * @file The bookshelf's repeated Tailwind classes: the header actions of the stage, the book
 * detail and the free library (free/_components/free-books-explorer.tsx), and the shelf cards'
 * arrow. Tailwind reads class names from source, so each one is written out whole. Pure and
 * isomorphic; guarded by tests/unit/bookshelf/palette-only.test.ts.
 */

/** A header action's start: an inline row at least 40 px tall. */
const HEADER_ACTION_HEAD = 'inline-flex min-h-10 items-center';
/** The gap beside a 16 px icon ('wide') or a 14 px one ('tight'). */
const HEADER_ACTION_GAP = { wide: 'gap-2', tight: 'gap-1.5' } as const;
/** A header action's box and type: a hairline pill on --surface-1. */
const HEADER_ACTION_BOX =
  'rounded-md border border-hairline bg-surface-1 px-3 tile-label text-muted-foreground';
/** A header action's hover and focus. */
const HEADER_ACTION_STATES =
  'transition-colors hover:border-hairline-strong hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus';

/** A page header's action (PageShell actions); a link also drops its underline. */
export const headerActionClass = (gap: keyof typeof HEADER_ACTION_GAP, isLink: boolean): string =>
  `${HEADER_ACTION_HEAD} ${HEADER_ACTION_GAP[gap]} ${HEADER_ACTION_BOX}${isLink ? ' no-underline' : ''} ${HEADER_ACTION_STATES}`;

/** A shelf card's arrow, which nudges up and to the right as the card is hovered. */
export const ARROW_ICON_CLASS =
  'size-4 text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-ink';
