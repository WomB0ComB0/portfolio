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
 * @file The guestbook's text limits, shared by the compose box, the API's body schema and its
 * server-side check, and the loader's clip, and how long the server caches its list, which the
 * page's client waits out after a post it could not confirm. Constants only (no directive, no
 * imports), so any side may use them.
 */

/** The most characters a message may have: the compose box's counter and the API's check. */
export const MESSAGE_MAX_LENGTH = 280;
/** The most characters of an author name that are stored and shown. */
export const AUTHOR_MAX_LENGTH = 80;
/** The name a message is posted and shown under when there is none (a guest's post). */
export const ANONYMOUS_AUTHOR = 'Anonymous';
/**
 * How long a loaded list is served before Firestore is asked again (the API's old 60 s). Each
 * server instance keeps its own copy, so a list may be this old on any of them.
 */
export const GUESTBOOK_TTL_MS = 60_000;
