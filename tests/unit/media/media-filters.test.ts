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
 * @file The /media URL contract on the shared filter schema: ?kind= is one kind at a time (a
 * slug, a plural, a section's name or an old tab name, any case) and only kinds that have items
 * count, ?q= is normalised, chips are offered for those kinds alone, named as their sections
 * are, with their counts; ?series= is one series of uploads, by the slug its rows carry (an
 * unknown one is no filter); ?topic= is one hand-written topic, handled the same way; and an old
 * ?tab= link maps to the ?kind= URL it now means.
 */

import { describe, expect, it } from 'vitest';
import {
  legacyTabHref,
  type MediaFilterItem,
  type MediaTopicOption,
  mediaFilters,
  SERIES_VALUE_MAX_LENGTH,
  seriesSlugOf,
  topicsIn,
} from '@/app/(routes)/(dev)/media/_lib/media-filters';

const MARATHON = { slug: 'coding-marathon', name: 'Coding marathon.' };

/** A row as the page files it: its topics carry the labels topicsIn reads. */
type FiledItem = MediaFilterItem & { readonly topics?: readonly MediaTopicOption[] };

const ITEMS: readonly FiledItem[] = [
  { kind: 'stream', haystack: 'Coding marathon. Stream YouTube', series: MARATHON },
  { kind: 'stream', haystack: 'Coding marathon. (Part 2/2) Stream YouTube', series: MARATHON },
  { kind: 'video', haystack: 'Cloud demo Video YouTube', series: null },
  { kind: 'post', haystack: 'Building a chat app Post Hashnode', series: null },
];

const schema = mediaFilters<MediaFilterItem>(['post', 'video', 'stream'], '/media', [MARATHON]);

describe('mediaFilters: parsing the URL', () => {
  it.each([
    ['?kind=video', ['video']],
    ['?kind=Videos', ['video']],
    ['?kind=blog', ['post']],
    ['?kind=posts', ['post']],
    ['?kind=video&kind=post', ['video']],
    ['?kind=writing', ['post']],
    ['?kind=Writing', ['post']],
    ['?kind=stream', ['stream']],
    ['?kind=Streams', ['stream']],
    ['?kind=talk', []],
    ['?kind=all', []],
    ['?kind=%20', []],
    [`?kind=${'v'.repeat(101)}`, []],
  ])('reads %s as %j', (search, kind) => {
    expect(schema.parse(search).kind).toEqual(kind);
  });

  it('normalises the search: single spaces, trimmed, capped', () => {
    expect(schema.parse('?q=%20%20coding%20%20%20marathon%20').q).toBe('coding marathon');
    expect(schema.parse(`?q=${'a'.repeat(150)}`).q).toHaveLength(100);
  });

  it("never reads Object.prototype's keys as kinds", () => {
    expect(schema.parse('?kind=constructor').kind).toEqual([]);
    expect(schema.parse('?kind=__proto__').kind).toEqual([]);
  });
});

describe('mediaFilters: chips and results', () => {
  it('offers a chip for each kind with items, named as its section, in section order', () => {
    const { kind } = schema.options(ITEMS, schema.empty());

    expect(kind.all).toBe(4);
    expect(kind.options.map((option) => [option.slug, option.label, option.count])).toEqual([
      ['post', 'Writing', 1],
      ['video', 'Video', 1],
      ['stream', 'Streams', 2],
    ]);
  });

  it('keeps the kind chosen, and the search across title, kind and where', () => {
    expect(schema.filter(ITEMS, schema.parse('?kind=stream'))).toHaveLength(2);
    expect(schema.filter(ITEMS, schema.parse('?kind=video'))).toEqual([ITEMS[2]]);
    expect(schema.filter(ITEMS, schema.parse('?q=hashnode'))).toEqual([ITEMS[3]]);
    expect(schema.filter(ITEMS, schema.parse('?kind=post&q=marathon'))).toEqual([]);
  });

  it('writes links on its own path, slug first, empty values left out', () => {
    expect(schema.hrefFor(schema.empty(), { kind: 'video' })).toBe('/media?kind=video');
    expect(mediaFilters(['video'], '/lab/routes').hrefFor(schema.empty(), { q: 'cloud' })).toBe(
      '/lab/routes?q=cloud',
    );
  });

  it('says what removed everything, in plain words', () => {
    expect(schema.noMatchSentence(schema.parse('?q=zzz'))).toBe('Nothing matches “zzz”.');
    expect(schema.noMatchSentence(schema.parse('?kind=stream&q=zzz'))).toBe(
      'Nothing matches “zzz” in Streams.',
    );
  });
});

describe('mediaFilters: one series', () => {
  it('reads a known series and keeps only its uploads', () => {
    const state = schema.parse('?series=coding-marathon');

    expect(state.series).toEqual(['coding-marathon']);
    expect(schema.filter(ITEMS, state)).toEqual([ITEMS[0], ITEMS[1]]);
    expect(schema.isFiltered(state)).toBe(true);
  });

  it.each([
    ['?series=another-show'],
    ['?series=Coding-Marathon'],
    ['?series=coding%20marathon'],
    ['?series=constructor'],
    ['?series=__proto__'],
    ['?series='],
    [`?series=${'a'.repeat(SERIES_VALUE_MAX_LENGTH + 1)}`],
  ])('reads %s as no filter', (search) => {
    const state = schema.parse(search);

    expect(state.series).toEqual([]);
    expect(schema.filter(ITEMS, state)).toHaveLength(ITEMS.length);
  });

  it('reads one series at a time: the first value', () => {
    const two = mediaFilters<MediaFilterItem>(['stream'], '/media', [
      MARATHON,
      { slug: 'other-show', name: 'Other show' },
    ]);

    expect(two.parse('?series=other-show&series=coding-marathon').series).toEqual(['other-show']);
  });

  it('offers no series when the rows carry none', () => {
    expect(mediaFilters(['video']).parse('?series=coding-marathon').series).toEqual([]);
  });

  it('writes the series link, and keeps it beside a kind and a search', () => {
    expect(schema.hrefFor(schema.empty(), { series: 'coding-marathon' })).toBe(
      '/media?series=coding-marathon',
    );
    expect(schema.serialize(schema.parse('?q=part&series=coding-marathon&kind=streams'))).toBe(
      '/media?kind=stream&series=coding-marathon&q=part',
    );
  });

  it('names the series by its title, in the token and in the empty sentence', () => {
    const state = schema.parse('?series=coding-marathon&q=zzz');
    const { series } = schema.options(ITEMS, state);

    expect(schema.facets.series.label).toBe('Series');
    expect(series.options.find((option) => option.current)?.label).toBe('Coding marathon.');
    // The series' own title ends with a full stop; the sentence ends with one, not two.
    expect(schema.noMatchSentence(state)).toBe(
      'Nothing matches “zzz” in the series Coding marathon.',
    );
    expect(schema.noMatchSentence(schema.parse('?series=coding-marathon&kind=post'))).toBe(
      'No items in Writing in the series Coding marathon.',
    );
  });

  it.each([
    ['Is it live?', 'No items in the series Is it live.'],
    ['Wait...', 'No items in the series Wait.'],
    ['Plain title', 'No items in the series Plain title.'],
  ])('ends the empty sentence for the series %j with one full stop', (name, sentence) => {
    const titled = mediaFilters<MediaFilterItem>(['stream'], '/media', [{ slug: 'show', name }]);

    expect(titled.noMatchSentence(titled.parse('?series=show'))).toBe(sentence);
  });
});

describe('mediaFilters: one topic', () => {
  const WEB = { slug: 'web', label: 'Web' };
  const ML = { slug: 'machine-learning', label: 'Machine learning' };
  const FILED: readonly FiledItem[] = [
    { kind: 'video', haystack: 'Cloud demo Video YouTube Web', topics: [WEB] },
    { kind: 'post', haystack: 'Building a chat app Post Hashnode Web', topics: [WEB, ML] },
    { kind: 'video', haystack: 'Churn model Video YouTube Machine learning', topics: [ML] },
    { kind: 'stream', haystack: 'Coding marathon. Stream YouTube', series: MARATHON },
  ];
  const topical = mediaFilters<MediaFilterItem>(
    ['post', 'video', 'stream'],
    '/media',
    [MARATHON],
    [WEB, ML],
  );

  it('reads a known topic and keeps only what is filed under it, whatever its kind', () => {
    const state = topical.parse('?topic=web');

    expect(state.topic).toEqual(['web']);
    expect(topical.filter(FILED, state)).toEqual([FILED[0], FILED[1]]);
    expect(topical.isFiltered(state)).toBe(true);
  });

  it.each([
    ['?topic=cooking'],
    ['?topic=Web'],
    ['?topic=machine%20learning'],
    ['?topic=constructor'],
    ['?topic=__proto__'],
    ['?topic='],
    [`?topic=${'a'.repeat(41)}`],
  ])('reads %s as no filter', (search) => {
    const state = topical.parse(search);

    expect(state.topic).toEqual([]);
    expect(topical.filter(FILED, state)).toHaveLength(FILED.length);
  });

  it('reads one topic at a time, and offers none when the rows carry none', () => {
    expect(topical.parse('?topic=machine-learning&topic=web').topic).toEqual(['machine-learning']);
    expect(schema.parse('?topic=web').topic).toEqual([]);
  });

  it('writes the topic link on the page itself, beside a kind and a search', () => {
    expect(topical.hrefFor(topical.empty(), { topic: 'web' })).toBe('/media?topic=web');
    expect(topical.serialize(topical.parse('?q=chat&topic=web&kind=writing'))).toBe(
      '/media?kind=post&topic=web&q=chat',
    );
  });

  it('names the topic by its label, in the token and in the empty sentence', () => {
    const state = topical.parse('?topic=machine-learning&kind=stream');
    const { topic } = topical.options(FILED, state);

    expect(topical.facets.topic.label).toBe('Topic');
    expect(topic.options.find((option) => option.current)?.label).toBe('Machine learning');
    expect(topical.noMatchSentence(state)).toBe('No items in Streams about Machine learning.');
  });

  it('lists the topics rows carry, each once, in the rows’ order', () => {
    expect(topicsIn(FILED)).toEqual([WEB, ML]);
    expect(topicsIn(ITEMS)).toEqual([]);
  });
});

describe('seriesSlugOf', () => {
  it.each([
    ['coding-marathon', 'coding-marathon'],
    ['  coding-marathon  ', 'coding-marathon'],
    [
      'headstarter-accelerator-project-2-discord-clone',
      'headstarter-accelerator-project-2-discord-clone',
    ],
    ['a1', 'a1'],
  ])('takes %j as %j', (raw, slug) => {
    expect(seriesSlugOf(raw)).toBe(slug);
  });

  it.each([
    [''],
    ['Coding-Marathon'],
    ['coding marathon'],
    ['coding--marathon'],
    ['-coding'],
    ['coding-'],
    ['coding_marathon'],
    ['<script>'],
    ['a'.repeat(SERIES_VALUE_MAX_LENGTH + 1)],
  ])('drops %j', (raw) => {
    expect(seriesSlugOf(raw)).toBeNull();
  });
});

describe('legacyTabHref', () => {
  it.each([
    [{ tab: 'videos' }, '/media?kind=video'],
    [{ tab: 'blog' }, '/media?kind=post'],
    [{ tab: 'presentations' }, '/media?kind=presentation'],
    [{ tab: 'talks' }, '/media?kind=talk'],
    [{ tab: 'articles' }, '/media?kind=article'],
    [{ tab: 'videos', q: 'cloud' }, '/media?kind=video&q=cloud'],
    [{ tab: 'nonsense' }, '/media'],
    [{ tab: ['videos', 'blog'] }, '/media?kind=video'],
  ])('maps %j to %s', (params, href) => {
    expect(legacyTabHref(params)).toBe(href);
  });

  it('leaves a URL without ?tab= alone, and lets ?kind= win over ?tab=', () => {
    expect(legacyTabHref({})).toBeNull();
    expect(legacyTabHref({ kind: 'post' })).toBeNull();
    expect(legacyTabHref({ tab: 'videos', kind: 'post' })).toBe('/media?kind=post');
  });
});
