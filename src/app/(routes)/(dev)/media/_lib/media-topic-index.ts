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
 * @file Files /media's entries under the hand-written topics (media-topics.ts) and keeps the
 * limits that stop a "see also" from becoming keyword chips. Pure; the server calls it
 * (load-feed.ts) and the lab applies its sample through it. The island never imports it.
 *
 * - The first TOPIC_LIST_MAX topics of the list are read; one with a malformed slug or no label
 *   is dropped.
 * - An item keeps the first TOPICS_PER_ITEM_MAX listed topics its rule names, each once; the
 *   first rule that names an item wins.
 * - A topic shows only once TOPIC_MIN_ITEMS entries of the feed carry it: a topic's link leads
 *   to a list, never to the one row it was clicked on.
 * Nothing here looks at a title, a description or a tag.
 */

import type { FeedEntry, FeedTopic } from './media-feed';
import { entryKey, itemKey } from './media-links';
import { type MediaTopic, type MediaTopicRule, topicSlugOf } from './media-topics';

/** The most topics the list may hold. */
export const TOPIC_LIST_MAX = 12;
/** The most topics one item shows. */
export const TOPICS_PER_ITEM_MAX = 3;
/** The fewest items a topic needs before it shows. */
export const TOPIC_MIN_ITEMS = 2;

/** The topic list and the item map. */
export interface TopicRules {
  readonly topics: readonly MediaTopic[];
  readonly items: readonly MediaTopicRule[];
}

/** The topics that can be used, by slug: the first twelve, well-formed, each slug once. */
function listedTopics(topics: readonly MediaTopic[]): Map<string, FeedTopic> {
  const listed = new Map<string, FeedTopic>();
  for (const topic of topics.slice(0, TOPIC_LIST_MAX)) {
    const slug = topicSlugOf(topic.slug);
    const label = topic.label.trim();
    if (slug !== null && label !== '' && !listed.has(slug)) listed.set(slug, { slug, label });
  }
  return listed;
}

/** Each named item's listed topics, three at most, in its rule's order; the first rule wins. */
function topicsByItem(
  rules: readonly MediaTopicRule[],
  listed: ReadonlyMap<string, FeedTopic>,
): Map<string, readonly string[]> {
  const byItem = new Map<string, readonly string[]>();
  for (const rule of rules) {
    const key = itemKey(rule.item);
    if (key === null || byItem.has(key)) continue;
    const slugs = [...new Set(rule.topics.map((slug) => slug.trim()))].filter((slug) =>
      listed.has(slug),
    );
    byItem.set(key, slugs.slice(0, TOPICS_PER_ITEM_MAX));
  }
  return byItem;
}

/**
 * The entries, each with the topics the map files it under (see the file comment for the
 * limits), which a search then reads too. Returns new entries in the same order; the input is
 * not modified.
 */
export function withTopics(entries: readonly FeedEntry[], rules: TopicRules): FeedEntry[] {
  const listed = listedTopics(rules.topics);
  const byItem = topicsByItem(rules.items, listed);
  const slugsOf = (entry: FeedEntry): readonly string[] => {
    const key = entryKey(entry);
    return key === null ? [] : (byItem.get(key) ?? []);
  };
  const uses = new Map<string, number>();
  for (const entry of entries) {
    for (const slug of slugsOf(entry)) uses.set(slug, (uses.get(slug) ?? 0) + 1);
  }
  return entries.map((entry) => {
    const topics = slugsOf(entry)
      .filter((slug) => (uses.get(slug) ?? 0) >= TOPIC_MIN_ITEMS)
      .flatMap((slug) => listed.get(slug) ?? []);
    if (topics.length === 0) return { ...entry, topics: [] };
    const labels = topics.map((topic) => topic.label).join(' ');
    return { ...entry, topics, haystack: `${entry.haystack} ${labels}` };
  });
}
