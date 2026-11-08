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
 * @file The messages API's write. There is no read here: the /guestbook page lists the messages
 * on the server (src/lib/guestbook/messages.ts).
 *
 * The caller has already verified who is posting (./poster.ts), so the name and uid come from
 * their sign-in, never from the request body. The message is checked here, whatever the browser
 * did: it goes through checkMessageText (trimmed, at most 280 characters, tags and script schemes
 * removed); a message with nothing left is an InvalidMessageError, which the route answers 400.
 * The text is stored as plain text, marked `plainText: true` so the loader never decodes it, with
 * the poster's uid, using the Admin SDK; then the page's cached list is expired, never dropped.
 */

import { adminDb } from '@/core/firebase-admin';
import { expireGuestbookMessages, MESSAGES_COLLECTION_PATH } from '@/lib/guestbook/messages';
import { checkMessageText, type MessageTextProblem } from '@/lib/guestbook/text';
import type { GuestbookMessage } from '@/lib/guestbook/types';
import type { Poster } from './poster';

const getMessageCollectionRefForWrites = () => adminDb.collection(MESSAGES_COLLECTION_PATH);

/** A posted message the guestbook cannot store: empty, too long, or only markup. */
export class InvalidMessageError extends Error {
  readonly name = 'InvalidMessageError';

  constructor(readonly problem: MessageTextProblem) {
    super(`The message cannot be stored: ${problem}`);
  }
}

/**
 * Stores `poster`'s message after checking it on the server, and answers it as stored (without
 * the uid). Rejects with an {@link InvalidMessageError} (nothing stored, cache untouched) when the
 * text is not postable.
 */
export async function createMessage(
  body: { readonly message: string },
  poster: Poster,
): Promise<GuestbookMessage> {
  const checked = checkMessageText(body.message);
  if (!checked.ok) throw new InvalidMessageError(checked.problem);

  const newMessage = {
    authorName: poster.authorName,
    message: checked.text,
    createdAt: new Date().toISOString(),
  };
  const docRef = await getMessageCollectionRefForWrites().add({
    ...newMessage,
    plainText: true,
    uid: poster.uid,
  });
  expireGuestbookMessages();

  return { id: docRef.id, ...newMessage };
}
