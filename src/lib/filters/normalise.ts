/**
 * Copyright 2026 Mike Odnis
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
 * @file The one way every filter page reads a URL value: the first of repeated values, search
 * text stripped of invisible/bidi controls and HTML/script injection payloads, single-spaced,
 * trimmed and capped, and lookups that never reach the prototype chain (CMS strings and URL
 * values are data, not keys of Object.prototype). Pure, isomorphic, and DOMPurify-free.
 */

import { stripInvisibleCharacters } from '@resq-systems/security/unicode';
import { validateUserInput } from '@/utils/security/user-input';

/** A search param as Next or a loader passes it. */
export type ParamValue = string | readonly string[] | null | undefined;

/** The longest search a filter page reads, unless its schema says otherwise. */
export const DEFAULT_QUERY_MAX_LENGTH = 100;

/** Bound applied before regex/Unicode passes so oversized ?q values stay O(maxLength). */
const QUERY_PREBOUND_FACTOR = 4;
const MIN_QUERY_PREBOUND = 256;

/** The first value of a param, or ''. */
export const firstOf = (value: ParamValue): string =>
  typeof value === 'string' ? value : (value?.[0] ?? '');

/** Every value of a param, in order. */
export const allOf = (value: ParamValue): readonly string[] =>
  typeof value === 'string' ? [value] : (value ?? []);

/**
 * Search text as a page reads it: the first value, stripped of Trojan Source bidi/zero-width
 * controls (`@resq-systems/security/unicode`), HTML tags, and nested script URL schemes
 * (`javascript:`, `data:`, `vbscript:`), single-spaced, trimmed, capped, and trimmed again so
 * normalising twice changes nothing.
 */
export function normaliseQuery(value: ParamValue, maxLength = DEFAULT_QUERY_MAX_LENGTH): string {
  const raw = firstOf(value);
  if (!raw) return '';
  const bounded = raw.slice(0, Math.max(maxLength * QUERY_PREBOUND_FACTOR, MIN_QUERY_PREBOUND));
  const visible = stripInvisibleCharacters(bounded);
  return validateUserInput(visible, maxLength, false).trimEnd();
}

/** A record's own value for `key`, never one inherited from Object.prototype. */
export const ownValue = <T>(record: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.hasOwn(record, key) ? record[key] : undefined;
