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
 * @file Uploads that are not part of the series their title puts them in, beside the pairs map
 * (media-pairs.ts). A series is two or more uploads of one kind that share a base title
 * (media-parts.ts), which is right for a broadcast cut into parts and for a weekly stream, and
 * wrong for two unrelated uploads that happen to share one ("Demo" in 2024 and in 2026), which
 * would each read "Upload 1 of 2".
 *
 * Add a line for each upload that stands alone: it then has no series, and an upload its title
 * leaves on its own has none either. It also never folds into a row with the others (the lab's
 * Fold view). Empty today. Pure and server-safe.
 *
 * @example
 * // An upload by its YouTube link or its 11-character id (placeholder id):
 * // { video: 'https://www.youtube.com/watch?v=VIDEO_ID_11' },
 */

import { videoKey } from './media-links';

/** An upload that stands alone, by its YouTube link or id. */
export interface MediaSeriesRule {
  readonly video: string;
}

/** Uploads that are never part of a series, whatever their titles share. */
export const MEDIA_NOT_SERIES: readonly MediaSeriesRule[] = [];

/** The rules as video keys ('yt:<id>'); a rule the page cannot read is dropped. */
export function standaloneKeys(rules: readonly MediaSeriesRule[]): ReadonlySet<string> {
  return new Set(rules.flatMap((rule) => videoKey(rule.video) ?? []));
}

/** Whether an entry is an upload one of the rules (as keys) names. */
export const standsAlone = (
  entry: { readonly videoId: string | null },
  keys: ReadonlySet<string>,
): boolean => entry.videoId !== null && keys.has(`yt:${entry.videoId}`);
