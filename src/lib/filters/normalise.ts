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
 * text single-spaced, trimmed and capped, and lookups that never reach the prototype chain (CMS
 * strings and URL values are data, not keys of Object.prototype). Pure and server-safe.
 */

/** A search param as Next or a loader passes it. */
export type ParamValue = string | readonly string[] | null | undefined;

/** The longest search a filter page reads, unless its schema says otherwise. */
export const DEFAULT_QUERY_MAX_LENGTH = 100;

/** The first value of a param, or ''. */
export const firstOf = (value: ParamValue): string =>
  typeof value === 'string' ? value : (value?.[0] ?? '');

/** Every value of a param, in order. */
export const allOf = (value: ParamValue): readonly string[] =>
  typeof value === 'string' ? [value] : (value ?? []);

/**
 * Search text as a page reads it: the first value, single-spaced, trimmed, capped, and trimmed
 * again so a cap that lands just after a space leaves none (normalising twice changes nothing).
 */
export function normaliseQuery(value: ParamValue, maxLength = DEFAULT_QUERY_MAX_LENGTH): string {
  return firstOf(value).replaceAll(/\s+/g, ' ').trim().slice(0, maxLength).trimEnd();
}

/** A record's own value for `key`, never one inherited from Object.prototype. */
export const ownValue = <T>(record: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.hasOwn(record, key) ? record[key] : undefined;
