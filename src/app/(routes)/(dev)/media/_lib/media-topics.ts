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
 * @file The topics of /media: a short hand-written list, and which item is filed under which.
 * A row then says "Topics: <topic>" under its title, each topic a link to /media?topic=<slug>,
 * which lists everything filed under it.
 *
 * Both lists ship empty and the page works without them. Topics are only ever what is written
 * here: the page never reads one off a title, a description or a tag.
 *
 * The limits (media-topic-index.ts enforces them, so a slip here costs nothing):
 * - twelve topics at most; only the first twelve are read;
 * - three topics an item at most; only its first three are read;
 * - a topic shows only once two listed items carry it, so no topic links to a list of one.
 *
 * A rule names the item by the address its row links to: a post's URL, or a video's YouTube URL
 * or 11-character id. Pure and server-safe.
 *
 * @example
 * // A topic, and two items filed under it (placeholder values):
 * // MEDIA_TOPICS:      { slug: 'web-performance', label: 'Web performance' },
 * // MEDIA_ITEM_TOPICS: { item: 'https://www.youtube.com/watch?v=VIDEO_ID_11', topics: ['web-performance'] },
 * //                    { item: 'https://blog.example.dev/my-post', topics: ['web-performance'] },
 */

/** One topic. */
export interface MediaTopic {
  /** The topic in a URL (?topic=): lower-case letters and digits, in runs joined by single hyphens. */
  readonly slug: string;
  /** The topic as a row writes it: "Web performance". */
  readonly label: string;
}

/** An item and the topics it is filed under. */
export interface MediaTopicRule {
  /** The item, as its row links it: a post's URL, or a video's YouTube URL or 11-character id. */
  readonly item: string;
  /** Up to three slugs from MEDIA_TOPICS. */
  readonly topics: readonly string[];
}

/** The longest topic slug. */
export const TOPIC_SLUG_MAX = 40;
/** A topic slug's shape: lower-case letters and digits in runs joined by single hyphens. */
const TOPIC_SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A value shaped like a topic slug (trimmed), or null. A shape check only. */
export function topicSlugOf(raw: string): string | null {
  const slug = raw.trim();
  return slug.length <= TOPIC_SLUG_MAX && TOPIC_SLUG_SHAPE.test(slug) ? slug : null;
}

/** Every topic, twelve at most. */
export const MEDIA_TOPICS: readonly MediaTopic[] = [];

/** Which item is filed under which topics. */
export const MEDIA_ITEM_TOPICS: readonly MediaTopicRule[] = [];
