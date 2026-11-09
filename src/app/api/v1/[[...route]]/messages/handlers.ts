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
 * The text is stored as plain text, marked `plainText: true` so the loader never decodes it, using
 * the Admin SDK; then the page's cached list is expired, never dropped.
 *
 * The message collection is public (the page reads it with the client SDK, and Firestore rules
 * cannot hide one field), so the poster's uid is not on the message: it goes to a server-only
 * document with the same id under {@link POSTERS_COLLECTION_PATH}, outside `public/`, where the
 * rules deny clients everything (the Admin SDK ignores rules). Both are written in one batch, so
 * neither lands without the other.
 *
 * A post is stored once, however often it is sent. Both documents are written with create(), which
 * fails with ALREADY_EXISTS when its document is there, and then the stored message is answered:
 * - With a requestId (the browser's id for one draft, sent again with the same text after an
 *   outcome it couldn't confirm), the id is {@link messageIdFor} the verified uid and that
 *   requestId, so a repeat lands on the same documents. Another poster's same requestId gives
 *   another id, so nobody can address or be answered someone else's message.
 * - Without one (a page loaded before requestId existed), the id is automatic, as before; only
 *   the Admin SDK's own retry of a commit whose answer was lost finds it.
 * A requestId already used for other text, or whose message has since been removed (its poster
 * record stays), is a {@link ConflictingPostError}, which the route answers 409.
 */

import { createHash } from 'node:crypto';
import type { DocumentReference } from 'firebase-admin/firestore';
import { config } from '@/config';
import { adminDb } from '@/core/firebase-admin';
import {
  expireGuestbookMessages,
  MESSAGES_COLLECTION_PATH,
  toGuestbookMessage,
} from '@/lib/guestbook/messages';
import { checkMessageText, type MessageTextProblem } from '@/lib/guestbook/text';
import type { GuestbookMessage } from '@/lib/guestbook/types';
import type { Poster } from './poster';

/** Who posted each message (their uid), keyed by the message's id. Server-only, for moderation. */
const POSTERS_COLLECTION_PATH = `artifacts/${config.firebase.appId}/private/data/messagePoster`;

/** Firestore's (gRPC) ALREADY_EXISTS: a create() found its document, so the batch wrote nothing. */
const ALREADY_EXISTS = 6;

/** A posted message the guestbook cannot store: empty, too long, or only markup. */
export class InvalidMessageError extends Error {
  readonly name = 'InvalidMessageError';

  constructor(readonly problem: MessageTextProblem) {
    super(`The message cannot be stored: ${problem}`);
  }
}

/**
 * A post's requestId was already used for other text, or its message has since been removed:
 * nothing is stored, and the browser posts again with a new requestId.
 */
export class ConflictingPostError extends Error {
  readonly name = 'ConflictingPostError';

  constructor() {
    super('The requestId was already used for another message, or its message was removed');
  }
}

/**
 * The message id for `uid`'s post `requestId`: the same every time they send it, another for
 * anyone else. A hex SHA-256, so the public id never shows the uid and is always a plain Firestore
 * id (no slash, nothing reserved).
 */
function messageIdFor(uid: string, requestId: string): string {
  return createHash('sha256').update(`${uid}\u0000${requestId}`).digest('hex');
}

/** Whether a failed commit is create()'s ALREADY_EXISTS: the documents were there before it. */
const isAlreadyExists = (error: unknown): boolean =>
  (error as { code?: unknown } | null)?.code === ALREADY_EXISTS;

/**
 * The message stored at `ref` when it holds `text`, after expiring the cached list (the write that
 * stored it may have been answered by an instance that never got that far); a
 * {@link ConflictingPostError} when the message is not there or holds other text. The text is
 * compared as stored, not as listed: toGuestbookMessage clips it for the page.
 */
async function storedPost(ref: DocumentReference, text: string): Promise<GuestbookMessage> {
  const snapshot = await ref.get();
  const data = snapshot.exists ? snapshot.data() : undefined;
  const stored = data?.message === text ? toGuestbookMessage(snapshot.id, data) : null;
  if (!stored) throw new ConflictingPostError();
  expireGuestbookMessages();
  return stored;
}

/**
 * Stores `poster`'s message after checking it on the server, with their uid in a server-only
 * document, and answers it as stored (without the uid). Sent again (the same `requestId`, or the
 * Admin SDK retrying a commit whose answer was lost), it answers the message already stored and
 * writes nothing. Rejects with an {@link InvalidMessageError} (nothing stored, cache untouched)
 * when the text is not postable, a {@link ConflictingPostError} when `requestId` was used for
 * other text or its message was removed, or Firestore's error (cache untouched) when the write
 * fails.
 */
export async function createMessage(
  body: { readonly message: string; readonly requestId?: string },
  poster: Poster,
): Promise<GuestbookMessage> {
  const checked = checkMessageText(body.message);
  if (!checked.ok) throw new InvalidMessageError(checked.problem);

  const newMessage = {
    authorName: poster.authorName,
    message: checked.text,
    createdAt: new Date().toISOString(),
  };
  const messages = adminDb.collection(MESSAGES_COLLECTION_PATH);
  const messageRef =
    body.requestId === undefined
      ? messages.doc()
      : messages.doc(messageIdFor(poster.uid, body.requestId));
  const posterRef = adminDb.collection(POSTERS_COLLECTION_PATH).doc(messageRef.id);
  try {
    await adminDb
      .batch()
      .create(messageRef, { ...newMessage, plainText: true })
      .create(posterRef, { uid: poster.uid, createdAt: newMessage.createdAt })
      .commit();
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
    return storedPost(messageRef, checked.text);
  }
  expireGuestbookMessages();

  return { id: messageRef.id, ...newMessage };
}
