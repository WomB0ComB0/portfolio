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
 * @file Read-time decoding for legacy guestbook text. The page renders messages and author names
 * as text (React escapes them), so nothing is escaped before storing any more. Records written
 * while the client escaped author names may hold `&#039;` and friends; this turns the five basic
 * entities that escaping produced back into characters, once, so they render as typed.
 *
 * Only legacy records go through it: the loader (./messages.ts) skips every record the API stored
 * as plain text (`plainText: true`), so a new message that says `&amp;` keeps saying it. The
 * stored data is never changed here. The result is still rendered as text, so a decoded
 * `<script>` is shown, never run. Any other entity (`&nbsp;`, `&#x27;`, upper-case `&AMP;`) is left
 * exactly as stored.
 */

/** The entities escapeHtml produced: &amp; &lt; &gt; &quot; and &#039; (or &#39;). */
const BASIC_ENTITY = /&(amp|lt|gt|quot|#0?39);/g;

const DECODED: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#039': "'",
  '#39': "'",
};

/**
 * `text` with the five basic HTML entities decoded in one pass: `&amp;lt;` becomes `&lt;`, not
 * `<`, so text escaped twice keeps the level it was typed with.
 *
 * @example
 * decodeBasicEntities('D&#039;Angelo &amp; Co'); // "D'Angelo & Co"
 */
export function decodeBasicEntities(text: string): string {
  return text.replace(BASIC_ENTITY, (entity, name: string) => DECODED[name] ?? entity);
}
