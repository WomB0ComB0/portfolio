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
 * @file The guestbook's data shapes, shared by the server loader, the API and the page's client
 * island. Types only (no directive, no imports), so client code can use them.
 */

/** One guestbook message, as stored and served: plain text, never HTML-escaped. */
export interface GuestbookMessage {
  readonly id: string;
  readonly authorName: string;
  readonly message: string;
  /** ISO 8601, e.g. 2025-10-27T09:19:00.000Z. */
  readonly createdAt: string;
}

/** Every message (newest first) up to the safety cap, and whether the cap cut the list. */
export interface GuestbookMessages {
  readonly messages: readonly GuestbookMessage[];
  readonly truncated: boolean;
}

/**
 * The server list's state: loaded now, the last good list served because a reload failed, or
 * nothing to show because the first load failed. An empty list is 'ready' with no messages.
 */
export type GuestbookListState = 'ready' | 'stale' | 'error';

/** What the page renders: the list, its state, and when a stale list was loaded. */
export interface GuestbookLoad extends GuestbookMessages {
  readonly state: GuestbookListState;
  /** When a stale list was loaded (epoch ms); null otherwise. */
  readonly loadedAt: number | null;
}
