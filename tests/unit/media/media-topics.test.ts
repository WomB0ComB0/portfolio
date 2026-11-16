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
 * @file Topics on /media (media-topics.ts, media-topic-index.ts): a short hand-written list, an
 * optional hand-written map from an item to up to three of them, and the limits that keep a
 * "see also" from turning into keyword chips: twelve topics at most, three per item, and a topic
 * shows only once two listed items carry it. Nothing is ever read off a title or a tag, and the
 * map ships empty. Synthetic data only.
 */

import { makeVideo } from '@tests/fixtures/sanity-docs';
import { describe, expect, it } from 'vitest';
import {
  buildFeed,
  type FeedEntry,
  type FeedSources,
} from '@/app/(routes)/(dev)/media/_lib/media-feed';
import { itemKey } from '@/app/(routes)/(dev)/media/_lib/media-links';
import {
  TOPIC_LIST_MAX,
  TOPIC_MIN_ITEMS,
  TOPICS_PER_ITEM_MAX,
  type TopicRules,
  withTopics,
} from '@/app/(routes)/(dev)/media/_lib/media-topic-index';
import {
  MEDIA_ITEM_TOPICS,
  MEDIA_TOPICS,
  type MediaTopic,
  topicSlugOf,
} from '@/app/(routes)/(dev)/media/_lib/media-topics';
import type { Blog } from '@/app/api/v1/[[...route]]/blog/handlers';

const noImages = (): string | null => null;

const video = (name: string, overrides: Parameters<typeof makeVideo>[0] = {}) =>
  makeVideo({
    _id: name,
    videoId: name.padEnd(11, '0').slice(0, 11),
    title: `Video ${name}`,
    description: '',
    publishedDate: '2025-04-01T00:00:00Z',
    ...overrides,
  });

const watch = (name: string): string =>
  `https://www.youtube.com/watch?v=${name.padEnd(11, '0').slice(0, 11)}`;

const post = (slug: string, overrides: Partial<Blog> = {}): Blog => ({
  title: `Post ${slug}`,
  slug,
  publishedAt: '2025-03-01T00:00:00.000Z',
  excerpt: '',
  source: 'hashnode',
  url: `https://blog.example.dev/${slug}`,
  ...overrides,
});

const TOPICS: readonly MediaTopic[] = [
  { slug: 'portfolio', label: 'Portfolio' },
  { slug: 'machine-learning', label: 'Machine learning' },
  { slug: 'hackathons', label: 'Hackathons' },
  { slug: 'web', label: 'Web' },
];

const SOURCES: Partial<FeedSources> = {
  videos: [video('a'), video('b'), video('c')],
  posts: [post('p')],
};

/** The feed for SOURCES with the topics `rules` give it. */
const filed = (rules: TopicRules, sources: Partial<FeedSources> = SOURCES): FeedEntry[] =>
  withTopics(buildFeed(sources, noImages), rules);

/** "kind:source id" to its topic slugs, for the entries that have topics. */
const topicsOf = (entries: readonly FeedEntry[]): Record<string, string[]> =>
  Object.fromEntries(
    entries
      .filter((entry) => entry.topics.length > 0)
      .map((entry) => [entry.id, entry.topics.map((topic) => topic.slug)]),
  );

describe('the topics that ship', () => {
  it('are none: the list and the map are empty until the owner writes them', () => {
    expect(MEDIA_TOPICS).toEqual([]);
    expect(MEDIA_ITEM_TOPICS).toEqual([]);
    expect(topicsOf(filed({ topics: MEDIA_TOPICS, items: MEDIA_ITEM_TOPICS }))).toEqual({});
  });

  it(`hold ${TOPIC_LIST_MAX} topics at most, each slug once and well-formed`, () => {
    const slugs = MEDIA_TOPICS.map((topic) => topic.slug);

    expect(MEDIA_TOPICS.length).toBeLessThanOrEqual(TOPIC_LIST_MAX);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const topic of MEDIA_TOPICS) {
      expect(topicSlugOf(topic.slug)).toBe(topic.slug);
      expect(topic.label.trim()).not.toBe('');
    }
  });

  it(`file an item under ${TOPICS_PER_ITEM_MAX} listed topics at most, and name each item once`, () => {
    const listed = new Set(MEDIA_TOPICS.map((topic) => topic.slug));
    const items = MEDIA_ITEM_TOPICS.map((rule) => itemKey(rule.item));

    expect(items.every((key) => key !== null)).toBe(true);
    expect(new Set(items).size).toBe(items.length);
    for (const rule of MEDIA_ITEM_TOPICS) {
      expect(rule.topics.length).toBeLessThanOrEqual(TOPICS_PER_ITEM_MAX);
      expect(rule.topics.every((slug) => listed.has(slug))).toBe(true);
    }
  });
});

describe('withTopics', () => {
  it('files items under the topics the map gives them, named by address or video id', () => {
    const entries = filed({
      topics: TOPICS,
      items: [
        { item: watch('a'), topics: ['portfolio'] },
        { item: 'https://www.blog.example.dev/p/', topics: ['portfolio', 'web'] },
        { item: 'b0000000000', topics: ['web'] },
      ],
    });

    expect(topicsOf(entries)).toEqual({
      'video:a': ['portfolio'],
      'post:https://blog.example.dev/p': ['portfolio', 'web'],
      'video:b': ['web'],
    });
    expect(entries.find((entry) => entry.id === 'video:a')?.topics).toEqual([
      { slug: 'portfolio', label: 'Portfolio' },
    ]);
  });

  it(`shows a topic only once ${TOPIC_MIN_ITEMS} listed items carry it`, () => {
    const entries = filed({
      topics: TOPICS,
      items: [
        { item: watch('a'), topics: ['portfolio', 'hackathons'] },
        { item: watch('b'), topics: ['portfolio'] },
        // Not in the feed, so it does not count towards "hackathons".
        { item: watch('gone'), topics: ['hackathons'] },
      ],
    });

    expect(topicsOf(entries)).toEqual({ 'video:a': ['portfolio'], 'video:b': ['portfolio'] });
  });

  it(`keeps the first ${TOPICS_PER_ITEM_MAX} listed topics of an item, each once, in its order`, () => {
    const rule = ['web', 'nope', 'web', 'hackathons', 'portfolio', 'machine-learning'];
    const entries = filed({
      topics: TOPICS,
      items: [
        { item: watch('a'), topics: rule },
        { item: watch('b'), topics: rule },
      ],
    });

    expect(topicsOf(entries)['video:a']).toEqual(['web', 'hackathons', 'portfolio']);
  });

  it(`reads the first ${TOPIC_LIST_MAX} topics of the list and no more`, () => {
    const many = Array.from({ length: TOPIC_LIST_MAX + 1 }, (_, n) => ({
      slug: `topic-${n}`,
      label: `Topic ${n}`,
    }));
    const last = `topic-${TOPIC_LIST_MAX}`;
    const entries = filed({
      topics: many,
      items: [
        { item: watch('a'), topics: [last, 'topic-0'] },
        { item: watch('b'), topics: [last, 'topic-0'] },
      ],
    });

    expect(topicsOf(entries)).toEqual({ 'video:a': ['topic-0'], 'video:b': ['topic-0'] });
  });

  it('drops a topic with a malformed slug or no label, and a rule it cannot read', () => {
    const entries = filed({
      topics: [
        { slug: 'Not A Slug', label: 'Broken' },
        { slug: 'empty', label: '  ' },
        { slug: 'web', label: 'Web' },
      ],
      items: [
        { item: watch('a'), topics: ['Not A Slug', 'empty', 'web'] },
        { item: watch('b'), topics: ['web'] },
        { item: 'not an address', topics: ['web'] },
      ],
    });

    expect(topicsOf(entries)).toEqual({ 'video:a': ['web'], 'video:b': ['web'] });
  });

  it('takes the first rule when the map names an item twice', () => {
    const entries = filed({
      topics: TOPICS,
      items: [
        { item: watch('a'), topics: ['web'] },
        { item: 'a0000000000', topics: ['portfolio'] },
        { item: watch('b'), topics: ['web', 'portfolio'] },
      ],
    });

    expect(topicsOf(entries)).toEqual({ 'video:a': ['web'], 'video:b': ['web'] });
  });

  it('never reads a topic off a title, a description or a tag', () => {
    const entries = filed(
      { topics: TOPICS, items: [] },
      {
        videos: [
          video('a', { title: 'Portfolio and web hackathons', tags: ['portfolio', 'web'] }),
          video('b', { title: 'Portfolio, again', description: 'machine learning for the web' }),
        ],
      },
    );

    expect(topicsOf(entries)).toEqual({});
  });

  it('adds the topics to what a search reads, and leaves its input as it was', () => {
    const feed = buildFeed(SOURCES, noImages);
    const before = JSON.stringify(feed);
    const entries = withTopics(feed, {
      topics: TOPICS,
      items: [
        { item: watch('a'), topics: ['machine-learning'] },
        { item: watch('b'), topics: ['machine-learning'] },
      ],
    });

    expect(JSON.stringify(feed)).toBe(before);
    expect(entries.find((entry) => entry.id === 'video:a')?.haystack).toContain('Machine learning');
    expect(entries.find((entry) => entry.id === 'video:c')?.haystack).not.toContain('Machine');
  });
});

describe('topicSlugOf', () => {
  it.each([['web'], ['machine-learning'], ['topic-12'], [' web ']])('reads %j', (raw) => {
    expect(topicSlugOf(raw)).toBe(raw.trim());
  });

  it.each([
    ['Web'],
    ['machine learning'],
    ['web--dev'],
    ['-web'],
    ['../web'],
    ['<script>'],
    ['a'.repeat(41)],
    [''],
  ])('reads %j as no topic', (raw) => {
    expect(topicSlugOf(raw)).toBeNull();
  });
});
