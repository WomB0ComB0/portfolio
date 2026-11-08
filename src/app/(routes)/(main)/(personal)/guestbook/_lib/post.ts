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
 * @file Posting a guestbook message to /api/v1/messages from the browser. Sent once, never
 * retried: the API adds an entry per POST, so a retry after a timeout could post it twice. The
 * answer is checked before it is shown; anything but a message counts as a failure, and an
 * answer that is not 2xx rejects with a PostFailedError carrying its status (429: rate limited).
 * isOutcomeUnknown says which failures may still have stored the message (all but a 4xx).
 */

import type { GuestbookMessage } from '@/lib/guestbook/types';

const ENDPOINT = '/api/v1/messages';
/** How long the API may take before the post counts as failed. */
export const POST_TIMEOUT_MS = 10_000;

/** What the visitor sends: their name and the checked text, nothing else (no email). */
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

const isClientError = (status: number): boolean => status >= 400 && status < 500;

/**
 * Whether a failed post may have been stored all the same. Only a 4xx answer (invalid text, a bad
 * body, rate limited) means the API stored nothing. A timeout or a dropped connection does not stop
 * the server's write, and a 5xx or an unreadable 2xx can follow one that went through.
 */
export function isOutcomeUnknown(error: unknown): boolean {
  return !(error instanceof PostFailedError && isClientError(error.status));
}

/** Posts `draft`; resolves with the stored message, or rejects. */
export async function postGuestbookMessage(draft: GuestbookDraft): Promise<GuestbookMessage> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ authorName: draft.authorName, message: draft.message }),
    signal: AbortSignal.timeout(POST_TIMEOUT_MS),
  });
  if (!response.ok) throw new PostFailedError(response.status);
  const saved = parsePostedMessage(await response.json());
  if (!saved) throw new Error('The guestbook API answered something other than a message');
  return saved;
}
