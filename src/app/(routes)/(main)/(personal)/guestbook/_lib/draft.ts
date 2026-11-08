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
 * @file What a guestbook post sends, checked as the server checks it (src/lib/guestbook/text.ts):
 * the draft is trimmed, refused when empty or over 280 characters, and goes through
 * validateUserInput (tags stripped, whitespace collapsed, script-like prefixes removed); the author
 * is the visitor's display name, checked the same way, or 'Anonymous'. Both are plain text:
 * nothing is HTML-escaped before it is stored, because every page renders it as text.
 *
 * When the check removes more than whitespace, the card shows what will be posted before it sends
 * (rewriteNotice), so nothing the visitor typed disappears without them seeing it.
 */

import type { SessionUser } from '@/core/auth.types';
import { ANONYMOUS_AUTHOR, MESSAGE_MAX_LENGTH } from '@/lib/guestbook/limits';
import { checkAuthorName, checkMessageText, type MessageTextProblem } from '@/lib/guestbook/text';

export { ANONYMOUS_AUTHOR, MESSAGE_MAX_LENGTH };

export const DRAFT_EMPTY = 'Write a message first.';
export const DRAFT_TOO_LONG = `Keep it to ${MESSAGE_MAX_LENGTH} characters.`;
export const DRAFT_ONLY_TAGS =
  "That message is only HTML tags, which aren't shown. Write some text instead.";
/** Read out once when the draft goes past the limit (the counter says by how much). */
export const DRAFT_OVER_LIMIT = `Over the ${MESSAGE_MAX_LENGTH}-character limit.`;

const PROBLEMS: Readonly<Record<MessageTextProblem, string>> = {
  empty: DRAFT_EMPTY,
  'too-long': DRAFT_TOO_LONG,
  'only-tags': DRAFT_ONLY_TAGS,
};

export type DraftCheck =
  | {
      readonly ok: true;
      /** What is sent and stored. */
      readonly text: string;
      /** Whether the check removed markup or a script prefix (more than whitespace). */
      readonly changed: boolean;
    }
  | { readonly ok: false; readonly error: string };

/** The text to post, or why the draft cannot be posted. */
export function checkDraft(draft: string): DraftCheck {
  const checked = checkMessageText(draft);
  return checked.ok ? checked : { ok: false, error: PROBLEMS[checked.problem] };
}

/** What the card says before posting a draft the check changed, with the text it will post. */
export function rewriteNotice(text: string): string {
  return `Text inside < > and the javascript:, data: and vbscript: prefixes are removed, so it will post as “${text}”. Press Post message again to send it.`;
}

/** The name a message is posted under: the visitor's display name, checked, or 'Anonymous'. */
export function authorNameOf(user: Pick<SessionUser, 'displayName'> | null): string {
  return checkAuthorName(user?.displayName);
}
