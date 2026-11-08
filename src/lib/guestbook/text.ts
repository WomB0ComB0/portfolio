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
 * @file How the guestbook checks typed text, the same in the compose box and on the server.
 *
 * A message is trimmed, refused when empty or over {@link MESSAGE_MAX_LENGTH}, then goes through
 * validateUserInput (tags stripped, whitespace collapsed, javascript:/data:/vbscript: removed) and
 * has the spaces that removal leaves collapsed. An author name goes through the same check, clipped
 * to {@link AUTHOR_MAX_LENGTH}, or is 'Anonymous'. The result is plain text: nothing is
 * HTML-escaped, because every page renders it as text.
 *
 * Isomorphic: user-input has no dependencies, so the client island ships none of DOMPurify.
 */

import { validateUserInput } from '@/utils/security/user-input';
import { ANONYMOUS_AUTHOR, AUTHOR_MAX_LENGTH, MESSAGE_MAX_LENGTH } from './limits';

/** Why typed text cannot be posted. */
export type MessageTextProblem = 'empty' | 'too-long' | 'only-tags';

export type MessageTextCheck =
  | {
      readonly ok: true;
      /** What is stored and shown. */
      readonly text: string;
      /** Whether the check removed more than whitespace (tags or a script scheme). */
      readonly changed: boolean;
    }
  | { readonly ok: false; readonly problem: MessageTextProblem };

const collapse = (text: string): string => text.replaceAll(/\s+/g, ' ').trim();

/** The message to store for `typed`, or why it cannot be posted. */
export function checkMessageText(typed: string): MessageTextCheck {
  const trimmed = typed.trim();
  if (trimmed === '') return { ok: false, problem: 'empty' };
  if (trimmed.length > MESSAGE_MAX_LENGTH) return { ok: false, problem: 'too-long' };
  const text = collapse(validateUserInput(trimmed, MESSAGE_MAX_LENGTH, false));
  if (text === '') return { ok: false, problem: 'only-tags' };
  return { ok: true, text, changed: text !== collapse(trimmed) };
}

/** The author name to store: the checked name, clipped, or 'Anonymous' when nothing is left. */
export function checkAuthorName(name: string | null | undefined): string {
  return collapse(validateUserInput(name ?? '', AUTHOR_MAX_LENGTH, false)) || ANONYMOUS_AUTHOR;
}
