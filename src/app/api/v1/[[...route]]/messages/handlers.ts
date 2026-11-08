/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @file The messages API's reads and writes. Reads go through the guestbook's shared server
 * cache (src/lib/guestbook/messages.ts), so this route and the /guestbook page make one Firestore
 * read per TTL per instance and list the same messages.
 *
 * Writes are checked here, whatever the browser did: the message goes through checkMessageText
 * (trimmed, at most 280 characters, tags and script schemes removed) and the author name through
 * checkAuthorName (at most 80, or 'Anonymous'); a message with nothing left is an
 * InvalidMessageError, which the route answers 400. The text is stored as plain text, marked
 * `plainText: true` so the loader never decodes it, with the Admin SDK; then the cached list is
 * expired, never dropped.
 */

import { Schema } from 'effect';
import { adminDb } from '@/core/firebase-admin';
import {
  expireGuestbookMessages,
  MESSAGES_COLLECTION_PATH,
  readGuestbookMessages,
} from '@/lib/guestbook/messages';
import { checkAuthorName, checkMessageText, type MessageTextProblem } from '@/lib/guestbook/text';

const getMessageCollectionRefForWrites = () => adminDb.collection(MESSAGES_COLLECTION_PATH);

export const MessageDataSchema = Schema.Struct({
  authorName: Schema.String,
  message: Schema.String,
  createdAt: Schema.String,
});

export const MessageSchema = Schema.extend(
  MessageDataSchema,
  Schema.Struct({
    id: Schema.String,
  }),
);

export const MessagesResponseSchema = Schema.Struct({
  json: Schema.Array(MessageSchema),
});

export type MessageData = Schema.Schema.Type<typeof MessageDataSchema>;
export type Message = Schema.Schema.Type<typeof MessageSchema>;
export type MessagesResponse = Schema.Schema.Type<typeof MessagesResponseSchema>;

/**
 * Every message, newest first (up to the guestbook's safety cap), from the shared cache: the last
 * good list when a reload fails. Rejects only when nothing could ever be loaded.
 */
export async function fetchMessages(): Promise<MessagesResponse> {
  const { data } = await readGuestbookMessages();
  return { json: data.messages };
}

/** A posted message the guestbook cannot store: empty, too long, or only markup. */
export class InvalidMessageError extends Error {
  readonly name = 'InvalidMessageError';

  constructor(readonly problem: MessageTextProblem) {
    super(`The message cannot be stored: ${problem}`);
  }
}

/**
 * Stores a message after checking it on the server, and answers it as stored. Rejects with an
 * {@link InvalidMessageError} (nothing stored, cache untouched) when the text is not postable.
 */
export async function createMessage(data: {
  readonly authorName: string;
  readonly message: string;
}): Promise<Message> {
  const checked = checkMessageText(data.message);
  if (!checked.ok) throw new InvalidMessageError(checked.problem);

  const newMessage = {
    authorName: checkAuthorName(data.authorName),
    message: checked.text,
    createdAt: new Date().toISOString(),
  };
  const docRef = await getMessageCollectionRefForWrites().add({ ...newMessage, plainText: true });
  expireGuestbookMessages();

  return { id: docRef.id, ...newMessage };
}
