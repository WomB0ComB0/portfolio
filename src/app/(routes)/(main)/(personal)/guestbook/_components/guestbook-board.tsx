'use client';

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
 * @file The guestbook's client island: the wall, a Folio chapter per year, newest first, with
 * the dashed "Your note here" compose tile as the first tile of the first year.
 *
 * The rows themselves are server-rendered and arrive per chapter, so every message is in the
 * page's HTML and nothing here fetches, paginates, measures or animates. The island only adds
 * what a visitor posts on this page (from PostedMessagesProvider, which the header's count reads
 * too), after the compose tile in the first chapter, and drops a posted row once the refreshed
 * server list (`knownIds`) includes it.
 *
 * The first chapter always exists and always has the same key (planChapters), so the compose card
 * is never remounted: a post still being sent, the box's text, its "Posted" line and focus all
 * survive the first post into an empty guestbook, a post in a new year, or a refresh. With no
 * notes to show, that chapter says the empty or error state in its own heading, right over the
 * compose tile. Each chapter (WallChapter) sets its year by the chapter system, with the count on
 * the rule beside it.
 *
 * `data-state` on the notes region follows the site's contract: ready, stale (the last good list
 * after a failed reload), empty or error; the first message posted into an empty guestbook makes
 * it ready.
 */

import { type ReactElement, type ReactNode, useMemo } from 'react';

import { planChapters, yearOf } from '../_lib/wall';
import { ComposeCard } from './compose-card';
import { LIST_SECTION_CLASS } from './guestbook-classes';
import {
  EMPTY_STATE,
  ERROR_STATE,
  NOTES_LABEL,
  STALE_EMPTY_STATE,
  type StateWords,
} from './guestbook-header';
import { usePostedMessagesContext } from './posted-messages';
import { unlisted } from './use-posted-messages';
import { WallChapter } from './wall-chapter';

/** The server list's state as the page shows it. */
export type BoardListState = 'ready' | 'stale' | 'empty' | 'error';

/** One year of the server list, its rows rendered on the server. */
export interface BoardChapter {
  /** The UTC year; null only when no message has a readable date. */
  readonly year: number | null;
  /** How many messages it holds. */
  readonly count: number;
  /** Its rows (MessageRow), newest first. */
  readonly rows: ReactNode;
}

export interface GuestbookBoardProps {
  /** The ids of the server-rendered rows, newest first. */
  readonly knownIds: readonly string[];
  readonly listState: BoardListState;
  /** Server-rendered words above the wall: the stale or capped note. */
  readonly notice?: ReactNode;
  /** The server list cut into years, newest first (groupByYear); none when there is no message. */
  readonly chapters?: readonly BoardChapter[];
}

/**
 * The words the first chapter says when there is no note to show, or null when it is a year.
 * The first post into an empty guestbook turns it into that post's year; the error state keeps
 * its words over any post (the list itself still could not load).
 */
function stateWordsOf(
  listState: BoardListState,
  hasServerChapters: boolean,
  hasPosted: boolean,
): StateWords | null {
  if (hasServerChapters) return null;
  if (listState === 'error') return ERROR_STATE;
  if (listState === 'stale') return STALE_EMPTY_STATE;
  return hasPosted ? null : EMPTY_STATE;
}

/** The wall of notes, by year; renders inside PostedMessagesProvider. */
export function GuestbookBoard({
  knownIds,
  listState,
  notice,
  chapters = [],
}: GuestbookBoardProps): ReactElement {
  const { rows, post } = usePostedMessagesContext();
  const known = useMemo(() => new Set(knownIds), [knownIds]);
  const posted = unlisted(rows, known);
  const firstPost = listState === 'empty' && posted.length > 0;
  const newestPosted = posted[0] ? yearOf(posted[0].message.createdAt) : null;
  const plans = planChapters(
    chapters.map((chapter) => chapter.year),
    newestPosted,
  );
  const state = stateWordsOf(listState, chapters.length > 0, posted.length > 0);

  return (
    <section
      aria-label={NOTES_LABEL}
      data-guestbook-notes=""
      data-state={firstPost ? 'ready' : listState}
      className={LIST_SECTION_CLASS}
    >
      {!firstPost && notice}
      {plans.map((plan, index) => {
        const server = plan.server === null ? undefined : chapters[plan.server];
        return (
          <WallChapter
            key={plan.key}
            plan={plan}
            index={index}
            serverCount={server?.count ?? 0}
            serverRows={server?.rows}
            state={index === 0 ? state : null}
            posted={index === 0 ? posted : []}
            compose={index === 0 ? <ComposeCard onPost={post} /> : null}
          />
        );
      })}
    </section>
  );
}
GuestbookBoard.displayName = 'GuestbookBoard';
