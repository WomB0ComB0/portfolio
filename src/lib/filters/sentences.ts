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
 * @file What a filter page says: the status line screen readers hear after a change, and the
 * empty state's sentence naming what removed everything (the Ledger's wording, made generic over
 * the noun and the facets). Pure and server-safe.
 */

import type { Noun } from './types';

/** "in Tools or Apps": how a facet without its own wording names its chosen values. */
export const defaultScope = (labels: readonly string[]): string => `in ${labels.join(' or ')}`;

export interface StatusWords {
  readonly noun: Noun;
  /** Whether any filter narrows the list. */
  readonly filtered: boolean;
  readonly shown: number;
  readonly total: number;
  /** Whether the visitor changed a filter here; a first load stays quiet. */
  readonly touched: boolean;
}

/** "Showing 6 of 64 certificates", "Showing all 64 certificates" once cleared, or nothing yet. */
export function statusSentence({ noun, filtered, shown, total, touched }: StatusWords): string {
  if (filtered) return `Showing ${shown} of ${total} ${noun.many}`;
  return touched ? `Showing all ${total} ${noun.many}` : '';
}

/**
 * The empty state's sentence: 'Nothing matches “quantum” from Google.' with a search, 'No
 * certificates from Google with SQL.' without one, 'No certificates match.' with neither.
 */
export function noMatchSentence(noun: Noun, query: string, scopes: readonly string[]): string {
  const scope = scopes.join(' ');
  if (query) return `Nothing matches “${query}”${scope ? ` ${scope}` : ''}.`;
  return scope ? `No ${noun.many} ${scope}.` : `No ${noun.many} match.`;
}
