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
 * @file One guestbook message on the wall: the text, then "author · month". Server-safe (no
 * directive, no hooks): the page renders its rows on the server, and the client island renders
 * the rows a visitor just posted with the same component.
 *
 * How it sits follows its length (noteScale, noteTreatment): a few words are a sticker, large type
 * with no box; a sentence a quiet tile; longer feedback calm body text under a hanging quote mark.
 * The note is static, not a link, so it does not lift on hover (the house rule: nothing looks
 * clickable without going anywhere).
 *
 * Text is rendered as text, exactly as given, so React escapes it exactly once, and the line
 * breaks a note was stored with are kept. A word holding a web address moves whole to the next
 * line when it fits there, and wraps only after a dot or a slash when it is wider than the line
 * (noteParts: an inline block, a <wbr> there, which adds no text); each piece's last character
 * stays with the dot, slash or bracket that closes it. The row never decodes entities: the loader
 * decodes legacy author names once (src/lib/guestbook/messages.ts), so a visitor who types
 * '&amp;' sees '&amp;', in the pending row and in the stored one.
 *
 * The signature is the name, then the dot and the month. When the month wraps under the name the
 * dot is dropped, so it never starts a line (nor ends one): see ROW_META_CLASS.
 */

import { type CSSProperties, Fragment, type ReactElement, type ReactNode } from 'react';

// The measure alone, not the barrel and its components, so the row also renders in a test's Node.
import { widestWordUnits } from '@/components/console/folio/word-measure';
import type { GuestbookMessage } from '@/lib/guestbook/types';
import { type NoteRun, noteParts } from '../_lib/breaks';
import { dayOf, monthOf } from '../_lib/format';
import { type NoteTreatment, noteScale, noteTreatment, stickerUnits } from '../_lib/wall';
import {
  NOTE_ADDRESS_CLASS,
  NOTE_HELD_CLASS,
  noteClass,
  QUOTE_MARK_CLASS,
  ROW_AUTHOR_CLASS,
  ROW_DOT_CLASS,
  ROW_META_CLASS,
  ROW_RUNS_CLASS,
  ROW_WHEN_CLASS,
  textClass,
} from './guestbook-classes';

const POSTING = 'Posting…';
/** The dot before the month: decorative, so hidden from screen readers and never copied. */
const SEPARATOR = '·';
/** The quote's hanging mark (decorative: the note is the quote). */
const QUOTE_MARK = '\u201c';

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

/**
 * "name · month" ("name · Posting…" while it is sent); just the name for an unreadable date. The
 * real space between the two keeps them apart when read aloud ('Jane Example Oct 2025') and is
 * the signature's one break: the month wraps whole, and its dot then sits clipped off the line.
 */
function Signature({ message, pending }: Required<MessageRowProps>): ReactElement {
  const hasDate = pending || monthOf(message.createdAt) !== null;
  return (
    <p className={ROW_META_CLASS}>
      <span className={ROW_RUNS_CLASS}>
        <span className={ROW_AUTHOR_CLASS}>{message.authorName}</span>
        {hasDate ? (
          <>
            {' '}
            <span className={ROW_WHEN_CLASS}>
              <span aria-hidden="true" className={ROW_DOT_CLASS}>
                {SEPARATOR}
              </span>
              {pending ? POSTING : <When createdAt={message.createdAt} />}
            </span>
          </>
        ) : null}
      </span>
    </p>
  );
}

/**
 * A word holding a web address: one inline block, whole when it fits a line, with a <wbr> where it
 * may wrap and its last character held with the bracket that closes it.
 */
function AddressWord({ runs }: { readonly runs: readonly NoteRun[] }): ReactElement {
  return (
    <span className={NOTE_ADDRESS_CLASS}>
      {runs.map((run, index) => (
        // The runs are the text in order and never change for a note, so their place is their key.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above.
        <Fragment key={index}>
          {run.breakBefore ? <wbr /> : null}
          {run.held ? <span className={NOTE_HELD_CLASS}>{run.text}</span> : run.text}
        </Fragment>
      ))}
    </span>
  );
}

/** The note's words as text, each word holding an address drawn as one AddressWord. */
function noteText(text: string): ReactNode {
  const parts = noteParts(text);
  const [only] = parts;
  if (parts.length === 1 && typeof only === 'string') return text;
  return parts.map((part, index) =>
    typeof part === 'string' ? (
      // The parts are the text in order and never change for a note, so their place is their key.
      // biome-ignore lint/suspicious/noArrayIndexKey: see above.
      <Fragment key={index}>{part}</Fragment>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: see above.
      <AddressWord key={index} runs={part} />
    ),
  );
}

/** A sticker's measures, for its width and its fitted size (guestbook-classes.ts). */
function stickerStyle(text: string, treatment: NoteTreatment): CSSProperties | undefined {
  if (treatment !== 'sticker') return undefined;
  return {
    '--note-fit': String(widestWordUnits(text)),
    '--note-units': String(stickerUnits(text)),
  } as CSSProperties;
}

/** A message on a year's wall (an <ol>). */
export function MessageRow({ message, pending = false }: MessageRowProps): ReactElement {
  const scale = noteScale(message.message);
  const treatment = noteTreatment(scale);
  return (
    <li
      data-message-row=""
      data-scale={scale}
      data-treatment={treatment}
      data-state={pending ? 'loading' : 'ready'}
      aria-busy={pending || undefined}
      className={noteClass(scale, treatment)}
      style={stickerStyle(message.message, treatment)}
    >
      {treatment === 'quote' ? (
        <span aria-hidden="true" className={QUOTE_MARK_CLASS}>
          {QUOTE_MARK}
        </span>
      ) : null}
      <p dir="auto" className={textClass(scale)}>
        {noteText(message.message)}
      </p>
      <Signature message={message} pending={pending} />
    </li>
  );
}
MessageRow.displayName = 'MessageRow';
