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
 * @file The guestbook's client island: the compose card beside the list.
 *
 * The rows themselves are server-rendered and arrive as `children`, so every message is in the
 * page's HTML and nothing here fetches, paginates or animates. The island only adds what a
 * visitor posts on this page, at the top of the same <ol>, and drops a posted row once the
 * refreshed server list (`knownIds`) includes it.
 *
 * `data-state` on the list follows the site's contract: ready, stale (the last good list after a
 * failed reload), empty or error; the first message posted into an empty guestbook makes it ready.
 */

import { type ReactElement, type ReactNode, useMemo } from 'react';

import { ComposeCard } from './compose-card';
import {
  BOARD_CLASS,
  COMPOSE_SLOT_CLASS,
  LIST_CLASS,
  LIST_HEAD_CLASS,
  LIST_NOTE_CLASS,
  LIST_SECTION_CLASS,
  LIST_TITLE_CLASS,
} from './guestbook-classes';
import { MessageRow } from './message-row';
import { usePostedMessages } from './use-posted-messages';

/** The server list's state as the page shows it. */
export type BoardListState = 'ready' | 'stale' | 'empty' | 'error';

export interface GuestbookBoardProps {
  /** The ids of the server-rendered rows, newest first. */
  readonly knownIds: readonly string[];
  readonly listState: BoardListState;
  /** Server-rendered words above the rows: the empty, error or stale state, or the cap note. */
  readonly notice?: ReactNode;
  /** The server-rendered rows (MessageRow), newest first. */
  readonly children?: ReactNode;
}

/** The compose card and the list of messages. */
export function GuestbookBoard({
  knownIds,
  listState,
  notice,
  children,
}: GuestbookBoardProps): ReactElement {
  const { rows, post } = usePostedMessages();
  const known = useMemo(() => new Set(knownIds), [knownIds]);
  const posted = rows.filter((row) => !known.has(row.message.id));
  const firstPost = listState === 'empty' && posted.length > 0;
  const hasRows = posted.length > 0 || knownIds.length > 0;

  return (
    <div className={BOARD_CLASS}>
      <div className={COMPOSE_SLOT_CLASS}>
        <ComposeCard onPost={post} />
      </div>
      <section
        aria-labelledby="guestbook-messages"
        data-state={firstPost ? 'ready' : listState}
        className={LIST_SECTION_CLASS}
      >
        <div className={LIST_HEAD_CLASS}>
          <h2 id="guestbook-messages" className={LIST_TITLE_CLASS}>
            Messages
          </h2>
          {hasRows && <p className={LIST_NOTE_CLASS}>Newest first</p>}
        </div>
        {!firstPost && notice}
        {hasRows && (
          <ol className={LIST_CLASS}>
            {posted.map((row) => (
              <MessageRow key={row.key} message={row.message} pending={row.pending} />
            ))}
            {children}
          </ol>
        )}
      </section>
    </div>
  );
}
GuestbookBoard.displayName = 'GuestbookBoard';
