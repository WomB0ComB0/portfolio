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
 * @file One guestbook message as a dense row: the text, then "author · month". Server-safe (no
 * directive, no hooks): the page renders its rows on the server, and the client island renders
 * the rows a visitor just posted with the same component.
 *
 * Text is rendered as text, exactly as given, so React escapes it exactly once. The row never
 * decodes entities: the loader decodes legacy author names once (src/lib/guestbook/messages.ts),
 * so a visitor who types '&amp;' sees '&amp;', in the pending row and in the stored one.
 */

import type { ReactElement } from 'react';

import type { GuestbookMessage } from '@/lib/guestbook/types';
import { dayOf, monthOf } from '../_lib/format';
import { ROW_AUTHOR_CLASS, ROW_CLASS, ROW_META_CLASS, ROW_TEXT_CLASS } from './guestbook-classes';

const POSTING = 'Posting…';

export interface MessageRowProps {
  readonly message: GuestbookMessage;
  /** A message the visitor just sent that the API has not confirmed yet. */
  readonly pending?: boolean;
}

/** The month as a <time> with the day as its machine value, or null for an unreadable date. */
function When({ createdAt }: { readonly createdAt: string }): ReactElement | null {
  const month = monthOf(createdAt);
  const day = dayOf(createdAt);
  return month && day ? <time dateTime={day}>{month}</time> : null;
}

/** A message row inside the guestbook's <ol>. */
export function MessageRow({ message, pending = false }: MessageRowProps): ReactElement {
  const hasDate = pending || monthOf(message.createdAt) !== null;
  return (
    <li
      data-message-row=""
      data-state={pending ? 'loading' : 'ready'}
      aria-busy={pending || undefined}
      className={ROW_CLASS}
    >
      <p className={ROW_TEXT_CLASS}>{message.message}</p>
      <p className={ROW_META_CLASS}>
        <span className={ROW_AUTHOR_CLASS}>{message.authorName}</span>
        {hasDate && <span aria-hidden="true"> · </span>}
        {pending ? <span>{POSTING}</span> : <When createdAt={message.createdAt} />}
      </p>
    </li>
  );
}
MessageRow.displayName = 'MessageRow';
