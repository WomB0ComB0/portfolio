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
 * @file Posting a guestbook message to /api/v1/messages from the browser. Never retried after a
 * timeout, an error or any answer but a 401: the API adds an entry per POST, so a retry could post
 * it twice.
 *
 * The post carries the visitor's Firebase ID token (`Authorization: Bearer`), which the API
 * verifies; the body is only the text, since the API takes the name from the sign-in. A 401 means
 * the API stored nothing, so the post is sent once more with a token Firebase refreshes on purpose
 * (the cached one can look expired to the server when this device's clock is behind). Refused
 * again, the session is no use for posting: the visitor is signed out, so the card offers sign-in.
 * The retry and the sign-out are only for the session that sent the post: if the visitor signed
 * out, or someone else signed in (on this card or in another tab), before a 401 came back, the post
 * is not resent with another session's token and nobody is signed out; it fails as a
 * PostNotSentError, since nothing was stored.
 * When there is no token to send (nobody signed in, or the session has ended) or Firebase cannot
 * give one (offline), nothing is sent: a PostNotSentError. The answer is checked before it is shown;
 * anything but a message counts as a failure, and an answer that is not 2xx rejects with a
 * PostFailedError carrying its status (401: sign in again, 429: rate limited). isOutcomeUnknown
 * says which failures may still have stored the message (all but a 4xx or a post never sent), and
 * needsSignIn which ones ask the visitor to sign in again.
 */

import { currentSession, getIdToken, type SessionHandle, signOut } from '@/core/auth';
import { withDeadline } from '@/lib/async/deadline';
import type { GuestbookMessage } from '@/lib/guestbook/types';

const ENDPOINT = '/api/v1/messages';
/** How long the API may take before the post counts as failed (getting the token has as long). */
export const POST_TIMEOUT_MS = 10_000;
const HTTP_UNAUTHORIZED = 401;

/**
 * What the visitor posts: the checked text, which is all the API is sent, and the name the card
 * shows on the row until the API answers with the stored message (no email).
 */
export interface GuestbookDraft {
  readonly authorName: string;
  readonly message: string;
}

const isText = (value: unknown): value is string => typeof value === 'string';

/** The API's answer as a message, or null when it is not one. */
export function parsePostedMessage(value: unknown): GuestbookMessage | null {
  if (typeof value !== 'object' || value === null) return null;
  const { id, authorName, message, createdAt } = value as Record<string, unknown>;
  if (!isText(id) || !isText(authorName) || !isText(message) || !isText(createdAt)) return null;
  return { id, authorName, message, createdAt };
}

/** The API answered a post with an error status. */
export class PostFailedError extends Error {
  readonly name = 'PostFailedError';

  constructor(readonly status: number) {
    super(`The guestbook API answered ${status}`);
  }
}

/**
 * Nothing was stored, and the post was not sent (again) for want of a sign-in token: nobody is
 * signed in or the session has ended (`signedOut`), Firebase could not give one (offline, or it
 * took too long), or the post was refused and another session has signed in since (not
 * `signedOut`: the post is not resent with theirs).
 */
export class PostNotSentError extends Error {
  readonly name = 'PostNotSentError';

  constructor(
    readonly signedOut: boolean,
    options?: ErrorOptions,
  ) {
    super(
      signedOut ? 'Not signed in: nothing was stored' : 'No sign-in token: nothing was stored',
      options,
    );
  }
}

const isClientError = (status: number): boolean => status >= 400 && status < 500;

/**
 * Whether a failed post may have been stored all the same. A post never sent, and a 4xx answer
 * (invalid text, a bad body, a refused sign-in, rate limited), mean the API stored nothing. A
 * timeout or a dropped connection does not stop the server's write, and a 5xx or an unreadable 2xx
 * can follow one that went through.
 */
export function isOutcomeUnknown(error: unknown): boolean {
  if (error instanceof PostNotSentError) return false;
  return !(error instanceof PostFailedError && isClientError(error.status));
}

/** Whether a failed post needs the visitor to sign in again: no token to send, or a 401. */
export function needsSignIn(error: unknown): boolean {
  return (
    (error instanceof PostNotSentError && error.signedOut) ||
    (error instanceof PostFailedError && error.status === HTTP_UNAUTHORIZED)
  );
}

/**
 * The visitor's ID token (refreshed first with `forceRefresh`), or a PostNotSentError saying why
 * there is none.
 */
async function signInToken(forceRefresh: boolean): Promise<string> {
  let token: string | null;
  try {
    token = await withDeadline(
      getIdToken(forceRefresh),
      POST_TIMEOUT_MS,
      'guestbook sign-in token',
    );
  } catch (error) {
    throw new PostNotSentError(false, { cause: error });
  }
  if (!token) throw new PostNotSentError(true);
  return token;
}

/** Sends `draft` once with a fresh token (refreshed first with `forceRefresh`). */
async function send(draft: GuestbookDraft, forceRefresh: boolean): Promise<Response> {
  const token = await signInToken(forceRefresh);
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: draft.message }),
    signal: AbortSignal.timeout(POST_TIMEOUT_MS),
  });
}

/**
 * Gives a refused post up (a 401 stores nothing) unless `session`, the one that sent it, is still
 * signed in: a retry would go out with another session's token, and a sign-out would end theirs.
 */
function stillSignedInAs(session: SessionHandle | null): void {
  const now = currentSession();
  if (now !== session) throw new PostNotSentError(now === null);
}

/**
 * Sends `draft`, and once more with a token refreshed on purpose if the API refused the first
 * (a 401 stores nothing). A second 401 signs the visitor out before it is answered. Both only
 * while the session that sent it is still the one signed in.
 */
async function sendSignedIn(draft: GuestbookDraft): Promise<Response> {
  // Taken in the same tick as send() asks that session for its token.
  const session = currentSession();
  const first = await send(draft, false);
  if (first.status !== HTTP_UNAUTHORIZED) return first;
  stillSignedInAs(session);
  const second = await send(draft, true);
  if (second.status !== HTTP_UNAUTHORIZED) return second;
  stillSignedInAs(session);
  await signOut();
  return second;
}

/** Posts `draft` as the signed-in visitor; resolves with the stored message, or rejects. */
export async function postGuestbookMessage(draft: GuestbookDraft): Promise<GuestbookMessage> {
  const response = await sendSignedIn(draft);
  if (!response.ok) throw new PostFailedError(response.status);
  const saved = parsePostedMessage(await response.json());
  if (!saved) throw new Error('The guestbook API answered something other than a message');
  return saved;
}
