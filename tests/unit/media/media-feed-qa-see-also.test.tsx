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
 * @file A /media row's "See also" references as real-browser QA found them, pinned where a unit
 * test can say it: a reference (the other version, the series, the project, a topic) looks like
 * a link without a hover, is a 24px target above the row's link that clears the sticky bars, is
 * never cut at any width, and its row has room for it; the words "See also" sit beside the
 * references, never alone above them, and a phone leaves them out; a reference that only filters
 * the list is followed in place.
 */

import { fireEvent, render, waitFor } from '@testing-library/react';
import { makeVideo } from '@tests/fixtures/sanity-docs';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import { describe, expect, it, vi } from 'vitest';
import {
  ITEM_CLASS,
  SEE_ALSO_CLASS,
  SEE_ITEM_CLASS,
  SEE_LEAD_CLASS,
  SEE_LINE_CLASS,
  SEE_LINK_CLASS,
  SEE_NAME_CLASS,
  SEE_PLACE_CLASS,
  SEE_TEXT_CLASS,
} from '@/app/(routes)/(dev)/media/_components/feed-classes';
import {
  cutLongSeries,
  LONG_SERIES_OVER,
  LONG_SERIES_SHOWN,
  plainSeriesRows,
  wholeSeriesIn,
} from '@/app/(routes)/(dev)/media/_components/feed-sections';
import { MediaFeedView } from '@/app/(routes)/(dev)/media/_interface/media-feed/media-feed';
import {
  buildFeed,
  type FeedEntry,
  type FeedKind,
} from '@/app/(routes)/(dev)/media/_lib/media-feed';
import { applyPairRule } from '@/app/(routes)/(dev)/media/_lib/media-pairing';
import { relateProjects } from '@/app/(routes)/(dev)/media/_lib/media-projects';
import { withTopics } from '@/app/(routes)/(dev)/media/_lib/media-topic-index';
import { ENTRIES, noImages, POST_URL, post, renderFeed } from './media-feed-fixtures';

/**
 * A search that finds two of the stream's three uploads ("(Part 1/2)" and "(Part 2/2)"): a list
 * that holds part of the series, so its rows link it. The full list holds every upload of it and
 * says each place as text (round 10).
 */
const PART = '?q=part';

describe('the "See also" line (round 3)', () => {
  const SERIES = { entries: ENTRIES, parts: 'each' } as const;

  /** A post and the video of it, the video also about a project and both filed under a topic. */
  const related = (): FeedEntry[] => {
    const sources = {
      posts: [post()],
      videos: [makeVideo({ title: 'Company overview', videoId: 'resq0000001' })],
    };
    const paired = applyPairRule(buildFeed(sources, noImages), {
      written: POST_URL,
      video: 'resq0000001',
    });
    const about = relateProjects(paired, [], [{ id: 'company', title: 'The Company - Site' }], {
      links: [{ item: 'resq0000001', project: 'company' }],
      notLinks: [],
    });
    return withTopics(about, {
      topics: [
        { slug: 'web', label: 'Web' },
        { slug: 'startups', label: 'Startups' },
      ],
      items: [
        { item: 'resq0000001', topics: ['web', 'startups'] },
        { item: POST_URL, topics: ['web', 'startups'] },
      ],
    });
  };
  const rowFor = (root: HTMLElement, href: string): HTMLTableRowElement | null =>
    root.querySelector(`a[data-feed-title][href="${href}"]`)?.closest('tr') ?? null;
  /** A reference's words as they show: its text without what only a screen reader gets. */
  const shown = (link: Element): string =>
    Array.from(link.firstElementChild?.childNodes ?? [])
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join('');

  it('makes a reference a 24px target above the row link, clear of the sticky bars', () => {
    // Two of the stream's three uploads: the list holds part of the series, so each links it.
    const root = renderFeed(PART, SERIES);
    const links = root.querySelectorAll('a[data-feed-series]');
    const classes = SEE_LINK_CLASS.split(' ');

    expect(links).toHaveLength(2);
    expect(classes).toContain('min-h-6');
    expect(classes).toContain('relative');
    expect(classes).toContain('z-[1]');
    for (const link of links) {
      expect(link.className).toBe(SEE_LINK_CLASS);
      // The kit's row gives every link inside it the scroll margin that clears the bars.
      expect(link.closest('tr')?.className).toContain('[&_:is(a,button,summary)]:scroll-mt-[');
      // It is not the row's stretched link, and sits outside it.
      expect(link.hasAttribute('data-index-link')).toBe(false);
      expect(link.closest('[data-index-link]')).toBeNull();
    }
  });

  it('makes a reference look like a link without a hover: brand ink and an underline', () => {
    const link = SEE_LINK_CLASS.split(' ');
    const text = SEE_TEXT_CLASS.split(' ');

    // Last round's reference was grey like the summary and only changed colour when pointed at.
    expect(link).toContain('text-brand-ink');
    expect(link.some((name) => name.startsWith('hover:text-'))).toBe(false);
    expect(text).toContain('underline');
    expect(text).toContain('decoration-(--brand-rim)');
    expect(text).toContain('group-hover/see:decoration-current');
    expect(text).toContain('group-focus-visible/see:decoration-current');
    expect(`${SEE_LINK_CLASS} ${SEE_TEXT_CLASS}`).not.toMatch(/text-muted-foreground|text-faint/);
  });

  it('reaches past its text on a touch screen without changing the layout', () => {
    expect(SEE_LINK_CLASS).toContain('pointer-coarse:after:absolute');
    // 4px above and below (a 32px target), not more: the title's last line sits right above it.
    expect(SEE_LINK_CLASS).toContain('pointer-coarse:after:-inset-y-1');
    expect(SEE_LINK_CLASS).toContain('pointer-coarse:after:-inset-x-2');
    expect(`${SEE_LINK_CLASS} ${SEE_TEXT_CLASS}`).not.toMatch(/scale|translate/);
  });

  it('wraps at every width, and a row with one has room at every width', () => {
    const cell = ITEM_CLASS.split(' ');

    expect(SEE_ALSO_CLASS.split(' ')).toContain('flex-wrap');
    expect(SEE_LINK_CLASS.split(' ')).toContain('max-w-full');
    // A long reference wraps instead of ending in an ellipsis: on a phone, and on a tablet too.
    expect(SEE_TEXT_CLASS.split(' ')).toContain('whitespace-normal');
    expect(SEE_TEXT_CLASS.split(' ')).toContain('wrap-break-word');
    expect(SEE_TEXT_CLASS.split(' ').some((name) => name.endsWith('truncate'))).toBe(false);
    // At 768 a two-line title over a reference filled the whole fixed 64px row: 0px to spare.
    expect(cell).toContain('py-2');
    // 9.5px: the 45px still, and one title line over one reference, both keep the kit's 64px row.
    expect(cell).toContain('@min-[40rem]/page:py-[0.59375rem]');
    expect(cell.some((name) => name.startsWith('@max-[40rem]/page:py-'))).toBe(false);
  });

  it('writes "Part n of m" when the titles number themselves, "Upload n of m" otherwise', () => {
    const numbered = buildFeed(
      {
        videos: [
          makeVideo({ title: 'Company overview', publishedDate: '2024-12-01T00:00:00Z' }),
          makeVideo({ title: 'Clone (part 2) - Chat', publishedDate: '2024-11-07T00:00:00Z' }),
          makeVideo({ title: 'Clone (part 1) - Chat', publishedDate: '2024-10-24T00:00:00Z' }),
        ],
      },
      noImages,
    );
    const places = (root: HTMLElement): string[] =>
      Array.from(root.querySelectorAll('[data-feed-series-place]'), (el) => el.textContent ?? '');
    const links = (root: HTMLElement): string[] =>
      Array.from(root.querySelectorAll('a[data-feed-series]'), shown);

    // The full list holds both series whole, so each row says its place as text (round 10).
    expect(places(renderFeed('', { entries: numbered, parts: 'each' }))).toEqual([
      'Part 2 of 2',
      'Part 1 of 2',
    ]);
    // "(Part 1/2)" is the first of three uploads: never "Part 1 of 3" beside a title's "1/2".
    expect(places(renderFeed('', SERIES))).toEqual([
      'Upload 3 of 3',
      'Upload 2 of 3',
      'Upload 1 of 3',
    ]);
    // A search that finds part of a series links it, in the same words.
    expect(links(renderFeed('?q=part 1', { entries: numbered, parts: 'each' }))).toEqual([
      'Series: Part 1 of 2',
    ]);
    expect(links(renderFeed(PART, SERIES))).toEqual([
      'Series: Upload 2 of 3',
      'Series: Upload 1 of 3',
    ]);
  });

  it('keeps the words "See also" beside the references, never alone above them', () => {
    const root = renderFeed('', { entries: related(), parts: 'each' });
    const list = rowFor(root, POST_URL)?.querySelector('ul[data-feed-see-also]');
    const lead = list?.previousElementSibling;

    expect(lead?.textContent).toBe('See also');
    expect(lead?.className).toBe(SEE_LEAD_CLASS);
    expect(list?.parentElement?.className).toBe(SEE_LINE_CLASS);
    expect(list?.parentElement?.children).toHaveLength(2);
    // One line of two boxes that does not wrap: the words keep their width, and the references
    // wrap inside the rest. As one wrapping list, a reference too long for the line moved under
    // the words and left them alone on a line.
    expect(SEE_LINE_CLASS.split(' ')).toContain('flex');
    expect(SEE_LINE_CLASS.split(' ')).not.toContain('flex-wrap');
    expect(SEE_LEAD_CLASS.split(' ')).toContain('flex-none');
    expect(SEE_ALSO_CLASS.split(' ')).toEqual(
      expect.arrayContaining(['min-w-0', 'flex-1', 'flex-wrap']),
    );
    // None of them is a layer over the row's link: only the references take a click.
    expect(`${SEE_LINE_CLASS} ${SEE_LEAD_CLASS} ${SEE_ALSO_CLASS}`).not.toMatch(/relative|z-\[/);
  });

  it('leaves the words out on a phone, where every reference names itself', () => {
    const root = renderFeed('', { entries: related(), parts: 'each' });
    const list = rowFor(root, POST_URL)?.querySelector('ul[data-feed-see-also]');

    // Under a 40rem page the text column is about 200px: the words cost a line of every row.
    expect(SEE_LEAD_CLASS.split(' ')).toContain('@max-[40rem]/page:hidden');
    // The list keeps its name for a screen reader, and each link opens with its own label.
    expect(list?.getAttribute('aria-label')).toBe('See also');
    expect(
      Array.from(list?.querySelectorAll('a') ?? [], (link) => link.textContent?.split(':')[0]),
    ).toEqual(['Video version', 'Topic', 'Topic']);
  });

  it('keeps the summary on its own line, above the references', () => {
    const root = renderFeed('', { entries: related(), parts: 'each' });
    const row = rowFor(root, POST_URL);
    const summary = row?.querySelector('[data-feed-summary]');
    const line = row?.querySelector('[data-feed-see-also]');

    expect(summary?.textContent).toBe('The same tour, in words.');
    expect(line?.className).toBe(SEE_ALSO_CLASS);
    expect(line?.querySelector('a[data-feed-pair]')?.className).toBe(SEE_LINK_CLASS);
    expect(
      summary && line
        ? summary.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING
        : 0,
    ).toBeTruthy();
    expect(line?.contains(summary ?? null)).toBe(false);
  });

  it('names the other piece in the link, shown from a 40rem page and spoken on a phone', () => {
    const root = renderFeed('', { entries: related(), parts: 'each' });
    const toVideo = rowFor(root, POST_URL)?.querySelector('a[data-feed-pair="video"]');
    const name = toVideo?.querySelector(`.${CSS.escape(SEE_NAME_CLASS)}`);

    expect(toVideo?.textContent).toContain('Video version: Company overview');
    expect(name?.textContent).toBe(': Company overview');
    // sr-only keeps it in the accessible name; display: none would drop it.
    expect(SEE_NAME_CLASS).toBe('@max-[40rem]/page:sr-only');
    expect(toVideo?.querySelector('[data-new-tab-arrow]')).not.toBeNull();
  });

  // As a box of its own beside the words, the arrow was centred against all the lines of a title
  // that wraps, at the far edge. In the words' own run it is glued to the last one.
  it('keeps a pair link’s new-tab arrow in the run of its words, so it follows the last one', () => {
    const root = renderFeed('', { entries: related(), parts: 'each' });
    const toVideo = rowFor(root, POST_URL)?.querySelector('a[data-feed-pair="video"]');
    const arrow = toVideo?.querySelector('[data-new-tab-arrow]');

    expect(arrow?.parentElement?.className).toBe(SEE_TEXT_CLASS);
    expect(arrow?.parentElement?.lastElementChild).toBe(arrow);
    expect(arrow?.parentElement?.parentElement).toBe(toVideo);
  });

  it('never cuts a reference, the name of a pair included', () => {
    const root = renderFeed('', { entries: related(), parts: 'each' });
    const video = rowFor(root, 'https://www.youtube.com/watch?v=resq0000001');
    const textOf = (selector: string): Element | null | undefined =>
      video?.querySelector(selector)?.querySelector('span:not(.sr-only)');

    // A touch tablet has no hover to read a cut name with, and these links carry no title.
    expect(textOf('a[data-feed-project]')?.className).toBe(SEE_TEXT_CLASS);
    expect(video?.querySelector('a[data-feed-project]')?.hasAttribute('title')).toBe(false);
    for (const topic of video?.querySelectorAll('a[data-feed-topic]') ?? []) {
      expect(topic.querySelector('span:not(.sr-only)')?.className).toBe(SEE_TEXT_CLASS);
    }
    const series = renderFeed(PART, SERIES).querySelectorAll('a[data-feed-series]');
    expect(series).toHaveLength(2);
    for (const link of series) {
      expect(link.querySelector('span')?.className).toBe(SEE_TEXT_CLASS);
    }
    // The pair's link names another piece by its whole title. On a tablet it ended in an
    // ellipsis ("Written version: Beyond Static: Creating a Dynamic Developer Portfolio…"),
    // which a touch screen cannot open; it wraps as the other references do.
    const pair = video?.querySelector('a[data-feed-pair]');
    expect(pair?.querySelector('span')?.className).toBe(SEE_TEXT_CLASS);
    expect(pair?.getAttribute('title')).toBe('Company overview, written up');
    expect(SEE_TEXT_CLASS.split(' ').some((name) => name.endsWith('truncate'))).toBe(false);
  });

  it('keeps stacked references from taking each other’s taps on a touch screen', () => {
    // Each link reaches 4px past its box; 8px between two lines lets the two areas meet.
    expect(SEE_LINK_CLASS).toContain('pointer-coarse:after:-inset-y-1');
    expect(SEE_ALSO_CLASS.split(' ')).toContain('pointer-coarse:gap-y-2');
    expect(SEE_ITEM_CLASS.split(' ')).toContain('pointer-coarse:gap-y-2');
  });

  // With a mouse two references that wrapped under each other had no gap at all: one underlined
  // block, told apart only by their label words.
  it('keeps a gap between references that wrap under each other, for every pointer', () => {
    for (const list of [SEE_ALSO_CLASS, SEE_ITEM_CLASS]) {
      expect(list.split(' ')).toContain('gap-y-1');
      // Touch keeps its wider gap: the variant comes after the base utility.
      expect(list.split(' ')).toContain('pointer-coarse:gap-y-2');
    }
  });

  // The base ring (2px, 2px away) reached 4px above the 24px link: 3px into the summary or meta
  // line right above it.
  it('keeps a reference’s focus ring clear of the line above it, without growing the row', () => {
    const link = SEE_LINK_CLASS.split(' ');
    // The link draws no ring of its own: a box laid over it does, as tall as the link's 24px
    // (which already clears its words by 3px) and 2px wider either side, as the base ring is.
    expect(link).toContain('focus-visible:outline-none');
    expect(link).toEqual(
      expect.arrayContaining([
        'before:absolute',
        'before:inset-y-0',
        'before:-inset-x-0.5',
        'before:pointer-events-none',
        'focus-visible:before:outline-2',
        'focus-visible:before:outline-(--focus)',
      ]),
    );
    // The line starts 2px lower and gives the 2px back below it, so the row keeps its height.
    expect(SEE_LINE_CLASS.split(' ')).toEqual(expect.arrayContaining(['mt-0.5', '-mb-0.5']));
    expect(ITEM_CLASS.split(' ')).toEqual(
      expect.arrayContaining(['py-2', '@min-[40rem]/page:py-[0.59375rem]']),
    );
  });

  it('says a place inside a series as quiet text on the references’ own line height', () => {
    const root = renderFeed('?series=coding-marathon', SERIES);
    const places = root.querySelectorAll('[data-feed-series-place]');

    expect(places).toHaveLength(3);
    expect(root.querySelector('a[data-feed-series]')).toBeNull();
    for (const place of places) {
      expect(place.className).toBe(SEE_PLACE_CLASS);
      expect(place.closest('a')).toBeNull();
    }
    // The same 24px as a reference, so a row is as tall in the series as on the full list.
    expect(SEE_PLACE_CLASS.split(' ')).toContain('min-h-6');
    expect(SEE_PLACE_CLASS).not.toMatch(/underline|text-brand-ink/);
  });

  it('holds one of each relation at most, in one order, then the topics', () => {
    const root = renderFeed('', { entries: related(), parts: 'each' });
    const video = rowFor(root, 'https://www.youtube.com/watch?v=resq0000001');
    const items = Array.from(
      video?.querySelectorAll('[data-feed-see-also] > li:not([aria-hidden])') ?? [],
    );
    const project = video?.querySelector('a[data-feed-project]');

    expect(video?.querySelectorAll('ul[aria-label="See also"]')).toHaveLength(1);
    expect(items.map((item) => item.querySelectorAll('a').length)).toEqual([1, 1, 2]);
    expect(items[0]?.querySelector('a[data-feed-pair="post"]')).not.toBeNull();
    expect(project?.textContent).toBe('Project: The Company - Site');
    expect(project?.getAttribute('href')).toBe('/projects/company');
    expect(project?.hasAttribute('target')).toBe(false);
  });

  it('names each topic for a screen reader and links it to its list on the page', () => {
    const root = renderFeed('', { entries: related(), parts: 'each' });
    const topics = Array.from(rowFor(root, POST_URL)?.querySelectorAll('a[data-feed-topic]') ?? []);

    expect(topics.map((link) => link.textContent)).toEqual(['Topic: Web', 'Topic: Startups']);
    expect(topics.map((link) => link.getAttribute('href'))).toEqual([
      '/media?topic=web',
      '/media?topic=startups',
    ]);
    expect(topics[0]?.querySelector('.sr-only')?.textContent).toBe('Topic: ');
    expect(topics[0]?.previousElementSibling?.textContent).toBe('Topics:');
    expect(topics[0]?.previousElementSibling?.getAttribute('aria-hidden')).toBe('true');
  });

  it('lists only what is filed under a topic for ?topic=, with its token', () => {
    const root = renderFeed('?topic=web', { entries: [...related(), ...ENTRIES], parts: 'each' });

    expect(root.querySelectorAll('tr[data-feed-row]')).toHaveLength(2);
    expect(root.querySelector('a[data-filter-part="token"]')?.textContent).toContain('Topic: Web');
  });

  it('opens a "Video version" in the in-page player with the embed option, not a new tab', () => {
    const paired = applyPairRule(
      buildFeed(
        {
          posts: [post()],
          videos: [makeVideo({ title: 'Company overview', videoId: 'resq0000001' })],
        },
        noImages,
      ),
      { written: POST_URL, video: 'resq0000001' },
    );
    const root = renderFeed('', { entries: paired, parts: 'each', play: 'embed' });
    const toVideo = root.querySelector('a[data-feed-pair="video"]');
    const toPost = root.querySelector('a[data-feed-pair="post"]');

    expect(toVideo?.getAttribute('data-play')).toBe('resq0000001');
    expect(toVideo?.getAttribute('data-play-title')).toBe('Company overview');
    expect(toVideo?.getAttribute('aria-haspopup')).toBe('dialog');
    expect(toVideo?.hasAttribute('target')).toBe(false);
    // Without JavaScript it still goes to YouTube.
    expect(toVideo?.getAttribute('href')).toBe('https://www.youtube.com/watch?v=resq0000001');
    // A written version is not a video: it keeps its new tab.
    expect(toPost?.getAttribute('target')).toBe('_blank');
    expect(toPost?.hasAttribute('data-play')).toBe(false);
  });
});

describe('references that filter the list (round 4)', () => {
  /** Twelve uploads of one stream: a long series, cut to its newest five on the full list. */
  const LONG: readonly FeedEntry[] = buildFeed(
    {
      videos: Array.from({ length: 12 }, (_, n) =>
        makeVideo({
          _id: `long${n}`,
          title: 'Long marathon.',
          description: 'Broadcasted live on Twitch -- Watch live at https://www.twitch.tv/x',
          videoId: `long00000${String(n).padStart(2, '0')}`,
          publishedDate: `2025-06-${String(n + 1).padStart(2, '0')}T08:00:00Z`,
        }),
      ),
    },
    noImages,
  );
  const TOPICS = {
    topics: [{ slug: 'web', label: 'Web' }],
    items: [
      { item: 'resq0000001', topics: ['web'] },
      { item: 'mara0000003', topics: ['web'] },
    ],
  };

  /** The view with a URL that remembers its changes, and what each change wrote to it. */
  function renderLive(entries: readonly FeedEntry[], search = '') {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const { container } = render(
      <NuqsTestingAdapter searchParams={search} onUrlUpdate={onUrlUpdate} hasMemory>
        <MediaFeedView
          feed={{ entries, missing: [] }}
          layout="sections"
          parts="each"
          play="link"
          path="/media"
        />
      </NuqsTestingAdapter>,
    );
    const rows = (): number => container.querySelectorAll('tr[data-feed-row]').length;
    const link = (selector: string): HTMLAnchorElement => {
      const found = container.querySelector<HTMLAnchorElement>(selector);
      if (!found) throw new Error(`no ${selector}`);
      return found;
    };
    return { container, onUrlUpdate, rows, link };
  }

  it('follows a series link in place on a plain click, as one new history entry', async () => {
    const { container, onUrlUpdate, rows, link } = renderLive([...ENTRIES, ...LONG], PART);
    expect(rows()).toBe(2);

    // fireEvent returns false when the click was taken (preventDefault): no page load follows.
    expect(fireEvent.click(link('tr[data-series="coding-marathon"] a[data-feed-series]'))).toBe(
      false,
    );

    // The rows change with the click, before the URL is written: no wait on the server.
    expect(rows()).toBe(3);
    expect(container.querySelector('a[data-feed-series]')).toBeNull();
    expect(container.querySelector('a[data-filter-part="token"]')?.textContent).toContain(
      'Series: Coding marathon.',
    );
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalledTimes(1));
    const update = onUrlUpdate.mock.calls[0]?.[0];
    expect(update?.queryString).toBe('?series=coding-marathon');
    // Back returns to the list the visitor left; the server is not asked again.
    expect(update?.options.history).toBe('push');
    expect(update?.options.shallow).toBe(true);
  });

  it('follows "Show all" and a topic link the same way', async () => {
    const all = renderLive([...ENTRIES, ...LONG]);
    expect(fireEvent.click(all.link('a[data-feed-more-link]'))).toBe(false);
    expect(all.rows()).toBe(12);
    await waitFor(() => expect(all.onUrlUpdate).toHaveBeenCalledTimes(1));
    expect(all.onUrlUpdate.mock.calls[0]?.[0].queryString).toBe('?series=long-marathon');
    expect(all.onUrlUpdate.mock.calls[0]?.[0].options.history).toBe('push');

    const filed = renderLive(withTopics(ENTRIES, TOPICS));
    expect(fireEvent.click(filed.link('a[data-feed-topic="web"]'))).toBe(false);
    expect(filed.rows()).toBe(2);
    await waitFor(() => expect(filed.onUrlUpdate).toHaveBeenCalledTimes(1));
    expect(filed.onUrlUpdate.mock.calls[0]?.[0].queryString).toBe('?topic=web');
    expect(filed.onUrlUpdate.mock.calls[0]?.[0].options.history).toBe('push');
  });

  it('goes where the link says: a series link drops a search it was found under', async () => {
    const { onUrlUpdate, rows, link } = renderLive(ENTRIES, '?q=part');
    expect(rows()).toBe(2);

    fireEvent.click(link('a[data-feed-series]'));

    expect(rows()).toBe(3);
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toBe('?series=coding-marathon');
  });

  it('moves focus to the first row of the list it opened', () => {
    const { container, link } = renderLive([...ENTRIES, ...LONG], PART);
    const clicked = link('tr[data-series="coding-marathon"] a[data-feed-series]');
    clicked.focus();

    fireEvent.click(clicked);

    // The link is gone (inside the series the place is text); focus must not fall to the page.
    expect(clicked.isConnected).toBe(false);
    expect(document.activeElement).toBe(
      container.querySelector('tr[data-feed-row] a[data-feed-title]'),
    );
  });

  it('waits for a cleared search before focusing a series whose first upload was filtered out', async () => {
    const entries = buildFeed(
      {
        videos: [
          makeVideo({
            _id: 'first',
            title: 'A marathon.',
            videoId: 'focus000001',
            publishedDate: '2025-06-01T08:00:00Z',
          }),
          makeVideo({
            _id: 'second',
            title: 'A marathon. (Part 1/2)',
            videoId: 'focus000002',
            publishedDate: '2025-06-02T08:00:00Z',
          }),
          makeVideo({
            _id: 'third',
            title: 'A marathon. (Part 2/2)',
            videoId: 'focus000003',
            publishedDate: '2025-06-03T08:00:00Z',
          }),
        ],
      },
      noImages,
    );
    const { container, link } = renderLive(entries, PART);
    expect(
      container.querySelector('a[href="https://www.youtube.com/watch?v=focus000001"]'),
    ).toBeNull();
    const clicked = link('a[data-feed-series]');
    clicked.focus();

    fireEvent.click(clicked);

    await waitFor(() => {
      const first = container.querySelector('tr[data-feed-row] a[data-feed-title]');
      expect(first).toHaveAttribute('href', 'https://www.youtube.com/watch?v=focus000001');
      expect(document.activeElement).toBe(first);
    });
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
    ['Shift', { shiftKey: true }],
    ['the middle button', { button: 1 }],
  ])('leaves a click with %s to the browser', (_what, init) => {
    const { onUrlUpdate, rows, link } = renderLive(ENTRIES, PART);

    fireEvent.click(link('a[data-feed-series]'), init);

    expect(rows()).toBe(2);
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('keeps every such link a real link, for a visit without JavaScript', () => {
    const { link } = renderLive(withTopics([...ENTRIES, ...LONG], TOPICS));
    const found = renderLive([...ENTRIES, ...LONG], PART);

    expect(found.link('a[data-feed-series]').getAttribute('href')).toBe(
      '/media?series=coding-marathon',
    );
    expect(link('a[data-feed-more-link]').getAttribute('href')).toBe('/media?series=long-marathon');
    expect(link('a[data-feed-topic]').getAttribute('href')).toBe('/media?topic=web');
  });
});

describe('which rows link their series (plainSeriesRows)', () => {
  const MARATHON = { slug: 'marathon', name: 'Marathon.' };
  const DUO = { slug: 'duo', name: 'Duo' };
  /** `count` uploads of one series in one section, newest first: "stream:marathon:9", ... */
  const uploads = (kind: FeedKind, series: typeof MARATHON, count: number) =>
    Array.from({ length: count }, (_, n) => ({
      id: `${kind}:${series.slug}:${count - n}`,
      kind,
      series,
      seconds: null,
      row: null,
    }));
  const lone = { id: 'video:lone', kind: 'video', series: null, seconds: null, row: null } as const;
  const long = uploads('stream', MARATHON, LONG_SERIES_OVER + 1);
  const short = uploads('video', DUO, 2);
  const rows = [lone, ...short, ...long];
  const ids = (found: ReadonlySet<string>): string[] => [...found].sort();

  it('says the place as text on every row inside the series itself', () => {
    expect(ids(plainSeriesRows(long, { inSeries: true, cut: false }))).toEqual(
      ids(new Set(long.map((row) => row.id))),
    );
  });

  it('links a long series that is cut from its closing line only, and a short one from every row', () => {
    const plain = plainSeriesRows(rows, { inSeries: false, cut: true });
    const listed = cutLongSeries(long).flatMap((line) => (line.row ? [line.row.id] : []));

    expect(listed).toHaveLength(LONG_SERIES_SHOWN);
    // Every row the section lists says its place as text: the line under them is the one link.
    for (const id of listed) expect(plain.has(id)).toBe(true);
    for (const row of [lone, ...short]) expect(plain.has(row.id)).toBe(false);
  });

  it('keeps the links of a series no section cuts, however long it is in all', () => {
    // Five videos and four streams of one series: nine in all, but neither section is cut, so
    // neither has a closing line to carry the link.
    const split = [...uploads('video', MARATHON, 5), ...uploads('stream', MARATHON, 4)];

    expect(cutLongSeries(split.filter((row) => row.kind === 'video'))).toHaveLength(5);
    expect(ids(plainSeriesRows(split, { inSeries: false, cut: true }))).toEqual([]);
  });

  it('links a long series listed whole once, on its first row', () => {
    const plain = plainSeriesRows(rows, { inSeries: false, cut: false });

    expect(ids(plain)).toEqual(ids(new Set(long.slice(1).map((row) => row.id))));
  });
});

describe('a series the list holds whole says its place as text (round 10)', () => {
  const DUO = { slug: 'duo', name: 'Duo' };
  const LONG_ONE = { slug: 'marathon', name: 'Marathon.' };
  const upload = (id: string, series: typeof DUO | null, kind: FeedKind = 'video') =>
    ({ id, kind, series, seconds: null, row: null }) as const;
  const post = upload('post', null, 'post');
  const duoTwo = upload('duo:2', DUO);
  const duo = [duoTwo, upload('duo:1', DUO)];
  const long = Array.from({ length: LONG_SERIES_OVER + 1 }, (_, n) =>
    upload(`marathon:${LONG_SERIES_OVER + 1 - n}`, LONG_ONE, 'stream'),
  );
  /** Every row of the page, unfiltered. */
  const all = [post, ...duo, ...long];
  const ids = (found: ReadonlySet<string>): string[] => [...found].sort();
  const plainFor = (listed: typeof all, cut = false): string[] =>
    ids(plainSeriesRows(listed, { inSeries: false, cut, whole: wholeSeriesIn(listed, all) }));

  it('finds the series every upload of which is in the list', () => {
    expect([...wholeSeriesIn([post, ...duo], all)]).toEqual(['duo']);
    expect([...wholeSeriesIn([post, duoTwo], all)]).toEqual([]);
    expect([...wholeSeriesIn(all, all)].sort()).toEqual(['duo', 'marathon']);
  });

  it('says it as text beside other rows (?q=discord: a post and both parts)', () => {
    expect(plainFor([post, ...duo])).toEqual(['duo:1', 'duo:2']);
  });

  it('keeps the link where the list holds only part of the series', () => {
    expect(plainFor([post, duoTwo])).toEqual([]);
    // Two uploads of the long series: the link opens the other seven.
    expect(plainFor(long.slice(0, 2))).toEqual([]);
  });

  it('says every row of a long series listed whole as text, its first row too', () => {
    expect(plainFor(all)).toEqual(ids(new Set([...duo, ...long].map((row) => row.id))));
  });

  it('says a short series as text on the full list, where a long one is cut', () => {
    const plain = plainFor(all, true);

    expect(plain).toEqual(expect.arrayContaining(['duo:1', 'duo:2']));
    expect(plain).not.toContain('post');
  });

  it('counts the uploads a folded row stands for, so a row kept in part is part of its series', () => {
    const folded = { ...upload('fold', LONG_ONE, 'stream'), folded: [{}, {}, {}] };

    expect([...wholeSeriesIn([{ ...folded, count: 1 }], [folded])]).toEqual([]);
    expect([...wholeSeriesIn([{ ...folded, count: 3 }], [folded])]).toEqual(['marathon']);
  });

  it('says the place as text on the page wherever the list holds the whole series', () => {
    const each = { entries: ENTRIES, parts: 'each' } as const;
    const whole = renderFeed('', each);
    const beside = renderFeed('?q=co', each);
    const part = renderFeed('?q=part', each);
    const places = (root: HTMLElement): string[] =>
      Array.from(root.querySelectorAll('[data-feed-series-place]'), (el) => el.textContent ?? '');

    // The full list and a search that lists the series beside another row: text, no link.
    for (const root of [whole, beside]) {
      expect(root.querySelectorAll('tr[data-feed-row]')).toHaveLength(4);
      expect(root.querySelector('a[data-feed-series]')).toBeNull();
      expect(places(root).sort()).toEqual(['Upload 1 of 3', 'Upload 2 of 3', 'Upload 3 of 3']);
    }
    // Two of its three uploads: each still links the series, which holds one more.
    expect(part.querySelectorAll('a[data-feed-series]')).toHaveLength(2);
    expect(places(part)).toEqual([]);
  });
});
