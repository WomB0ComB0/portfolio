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
 * @file The /guestbook page, rendered on the server: a PageShell header with two figures, then
 * the client island (compose card and list) holding every message as a server-rendered row. A
 * visitor without JavaScript, and a crawler, read the whole guestbook in the HTML.
 */

import type { JSX } from 'react';

import {
  type BoardListState,
  GUESTBOOK_DESCRIPTION,
  GUESTBOOK_TITLE,
  GuestbookBoard,
  GuestbookStatStrip,
  ListNotice,
  MessageRow,
} from '@/app/(routes)/(main)/(personal)/guestbook/_components';
import { guestbookStats } from '@/app/(routes)/(main)/(personal)/guestbook/_lib/format';
import { PageShell } from '@/components/console';
import type { GuestbookLoad } from '@/lib/guestbook/types';

export interface GuestbookProps {
  readonly load: GuestbookLoad;
}

/**
 * The list's state as shown: a fresh empty list is its own state; a stale or failed load keeps
 * its own, so an empty last good list still carries the stale warning.
 */
const listStateOf = (load: GuestbookLoad): BoardListState => {
  if (load.state !== 'ready') return load.state;
  return load.messages.length === 0 ? 'empty' : 'ready';
};

/**
 * The guestbook: every message, newest first, beside the card to sign it.
 *
 * @returns {JSX.Element} The guestbook view.
 */
export const Guestbook = ({ load }: GuestbookProps): JSX.Element => {
  const listState = listStateOf(load);
  return (
    <PageShell
      title={GUESTBOOK_TITLE}
      description={GUESTBOOK_DESCRIPTION}
      stats={
        <GuestbookStatStrip
          stats={guestbookStats(load.messages, load.truncated)}
          available={load.state !== 'error'}
        />
      }
    >
      <GuestbookBoard
        knownIds={load.messages.map((message) => message.id)}
        listState={listState}
        notice={<ListNotice load={load} listState={listState} />}
      >
        {load.messages.map((message) => (
          <MessageRow key={message.id} message={message} />
        ))}
      </GuestbookBoard>
    </PageShell>
  );
};
Guestbook.displayName = 'Guestbook';
export default Guestbook;
