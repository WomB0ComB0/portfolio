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
 * @file What real-browser QA found on /media, pinned where a unit test can say it: titles wrap
 * and are never cut; the header counts what the chips count (items, also where a series is folded
 * into one row), as the sections' counts in section order; the Date column fits a date with its
 * year; in the folded alternative the parts
 * disclosure is a 24px target, opens on a part-only search and marks the part that matched; a
 * stack's still keeps its box; a failed still falls back to the kind's glyph; an open row aligns
 * to its top; the header's newest date is one short figure; a long applied token grows instead of
 * spilling. The "See also" references are in media-feed-qa-see-also.test.tsx.
 */

import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { makeTalk, makeVideo } from '@tests/fixtures/sanity-docs';
import { describe, expect, it } from 'vitest';
import {
  FEED_COLUMNS,
  type FeedColumn,
  ITEM_CLASS,
  OPEN_ROW_CELL_CLASS,
  PART_MATCH_CLASS,
  PARTS_SUMMARY_CLASS,
  SECTION_COLUMNS,
  THUMB_CLASS,
  THUMB_STACK_CLASS,
  TITLE_TEXT_CLASS,
} from '@/app/(routes)/(dev)/media/_components/feed-classes';
import {
  buildFeed,
  FEED_KINDS,
  type FeedEntry,
  type FeedSources,
} from '@/app/(routes)/(dev)/media/_lib/media-feed';
import { monthName, yearOf } from '@/app/(routes)/(dev)/media/_lib/media-format';
import { ENTRIES, noImages, post, renderFeed } from './media-feed-fixtures';

/** A feed whose kinds each have `counts[kind]` items. */
function feedOf(
  counts: Partial<Record<'post' | 'video' | 'stream' | 'talk', number>>,
): FeedEntry[] {
  const many = <T,>(count: number | undefined, make: (n: number) => T): T[] =>
    Array.from({ length: count ?? 0 }, (_, n) => make(n));
  const sources: Partial<FeedSources> = {
    posts: many(counts.post, (n) =>
      post({ title: `Post ${n}`, slug: `post-${n}`, url: `https://blog.example.dev/post-${n}` }),
    ),
    videos: [
      ...many(counts.video, (n) => makeVideo({ title: `Made video ${n}`, description: '' })),
      ...many(counts.stream, (n) =>
        makeVideo({
          title: `Stream night ${n}`,
          description: 'Broadcasted live on Twitch -- Watch live at https://www.twitch.tv/x',
        }),
      ),
    ],
    talks: many(counts.talk, (n) => makeTalk({ title: `Talk ${n}` })),
  };
  return buildFeed(sources, noImages);
}

/** The header's figures, each as "label value" (the strip writes the label first). */
const figures = (): string[] =>
  Array.from(screen.getByLabelText('Totals').querySelectorAll('dt'), (label) =>
    `${label.textContent} ${label.closest('div')?.querySelector('dd')?.textContent}`.trim(),
  );

const stream = (root: HTMLElement): HTMLDetailsElement => {
  const details = root.querySelector<HTMLDetailsElement>('details[data-feed-parts]');
  if (!details) throw new Error('no folded stream');
  return details;
};

describe('titles (media-2, round 3)', () => {
  // One line cut 12 of 25 titles at 768 and 17 at 1024; two lines still cut two of them at 768,
  // and a touch tablet cannot read a title attribute. The row grows with its title instead.
  it('wrap and are never cut, at any width', () => {
    const classes = TITLE_TEXT_CLASS.split(' ');

    expect(classes).not.toContain('truncate');
    expect(classes.some((name) => name.includes('line-clamp'))).toBe(false);
    expect(classes).toContain('whitespace-normal');
    // A long unbroken word wraps inside the cell instead of pushing the page wide.
    expect(classes).toContain('wrap-break-word');
  });

  it('need no title attribute: the whole title is on the page', () => {
    const root = renderFeed();
    const text = root.querySelector('a[data-feed-title][href*="resq0000001"] > span');

    // The title's own words, then its new-tab arrow in the same run of text.
    expect(text?.firstChild?.textContent).toBe('Company overview');
    expect(text?.hasAttribute('title')).toBe(false);
  });

  // At 320px "(Part" ended one line and "2/2)" began the next: the title's own marker is one
  // piece of text that never breaks inside, while the rest of the title wraps as before.
  it('keep their own part marker on one line, the words unchanged', () => {
    const root = renderFeed('', { parts: 'each' });
    const run = root.querySelector('a[data-feed-title][href*="mara0000002"] > span');
    const marker = run?.querySelector('[data-title-marker]');

    expect(marker?.textContent).toBe('(Part 2/2)');
    expect(marker?.className.split(' ')).toContain('whitespace-nowrap');
    expect(run?.textContent?.replaceAll('⁠', '')).toBe('Coding marathon. (Part 2/2)');
    // A title without a marker is its plain words.
    const plain = root.querySelector('a[data-feed-title][href*="mara0000003"] > span');
    expect(plain?.querySelector('[data-title-marker]')).toBeNull();
  });

  // The arrow sat in a column of its own at the right, level with the first line of a wrapped
  // title: in one run with the words, glued to the last by a word joiner, it ends the last line.
  it('end with their new-tab arrow, glued to the last word', () => {
    const root = renderFeed();
    const run = root.querySelector('a[data-feed-title][href*="resq0000001"] > span');
    const arrow = run?.querySelector('[data-new-tab-arrow]');

    expect(arrow).not.toBeNull();
    expect(arrow?.textContent?.startsWith('⁠')).toBe(true);
    expect(run?.lastElementChild?.contains(arrow ?? null)).toBe(true);
  });
});

describe('counts with a series folded into one row (the lab’s "Fold parts")', () => {
  /** An element's text, single-spaced. */
  const words = (element: Element): string =>
    (element.textContent ?? '').replaceAll(/\s+/g, ' ').trim();
  /** The count as it shows: a filtered count's number also has a twin only screen readers get. */
  const shownCount = (root: HTMLElement): string => {
    const count = root.querySelector('[data-filter-part="count"]')?.cloneNode(true) as Element;
    for (const hidden of count.querySelectorAll('.sr-only')) hidden.remove();
    return words(count);
  };
  /** Everything the page says it holds: the header's figures, the chips, the count, the sections. */
  const counts = (root: HTMLElement) => ({
    figures: figures(),
    chips: Array.from(root.querySelectorAll('[data-filter-part="chip"]'), words),
    count: shownCount(root),
    sections: Array.from(root.querySelectorAll('[data-index-part="year"]'), words),
  });

  // Folded, the page said "2 videos" over the fixture's four (22 videos and 1 stream on /media's
  // own 23 and 27), while each section's length still added every upload.
  it('are of items, whether or not the rows are folded', () => {
    const each = counts(renderFeed('', { parts: 'each' }));
    cleanup();
    const root = renderFeed('', { parts: 'fold' });

    expect(root.querySelectorAll('tr[data-feed-row]')).toHaveLength(2);
    expect(counts(root)).toEqual(each);
    expect(each.figures[0]).toBe('videos 4');
    expect(each.count).toBe('4 items');
    expect(each.chips).toEqual(['All 4 items', 'Video 4 items']);
    expect(each.sections).toHaveLength(1);
    expect(each.sections[0]).toMatch(/^Video,? ?4 videos · /);
  });

  it('count the uploads a search finds inside a folded row, and add up their lengths', () => {
    const each = counts(renderFeed('?q=Part+2/2', { parts: 'each' }));
    cleanup();
    const root = renderFeed('?q=Part+2/2', { parts: 'fold' });

    // The folded row shows (its disclosure open on the one part), and it counts as that part.
    expect(root.querySelectorAll('tr[data-feed-row]')).toHaveLength(1);
    expect(counts(root)).toEqual(each);
    expect(each.count).toBe('1 of 4 items');
    expect(each.sections[0]).toMatch(/1 video · 2 h 5 min$/);
  });

  it('count a folded row as all its uploads when a search finds the row itself', () => {
    const root = renderFeed('?q=marathon', { parts: 'fold' });

    expect(root.querySelectorAll('tr[data-feed-row]')).toHaveLength(1);
    expect(counts(root).count).toBe('3 of 4 items');
  });

  // The section said "1 video · 2 h 5 min" while the one row under it still read "3 parts" and
  // its whole length: the row's own count and length follow the search as its section does.
  it('say on the folded row how many of its parts a search found, and their length', () => {
    const row = (root: HTMLElement): string =>
      words(root.querySelector('tr[data-feed-row]') as Element);

    const searched = renderFeed('?q=Part+2/2', { parts: 'fold' });
    expect(words(stream(searched).querySelector('summary') as Element)).toMatch(/^1 of 3 parts · /);
    expect(row(searched)).toContain('2 h 5 min');
    expect(row(searched)).not.toContain('22 h 32 min');
    expect(counts(searched).sections[0]).toMatch(/1 video · 2 h 5 min$/);
    cleanup();

    // The search finds the row itself: every part, and their whole length (8:32:20, 2:04:43 and
    // 11:55:01), as its section counts them.
    const whole = renderFeed('?q=marathon', { parts: 'fold' });
    expect(words(stream(whole).querySelector('summary') as Element)).toMatch(/^3 parts · /);
    expect(row(whole)).toContain('22 h 32 min');
    expect(counts(whole).sections[0]).toMatch(/3 videos · 22 h 32 min$/);
  });

  // "1 of 3 parts · Dec 29 – 30, 2025" with the Date "Dec 30, 2025", while the one part found went
  // up on Dec 29: the span and the date follow the search as the count and the length do.
  it('give the span and the date of the parts a search found', () => {
    const range = (root: HTMLElement): string =>
      words(stream(root).querySelector('summary [data-parts-range]') as Element);
    const date = (root: HTMLElement): string =>
      words(root.querySelector('tr[data-feed-row] > td:last-child') as Element);

    const searched = renderFeed('?q=Part+2/2', { parts: 'fold' });
    expect(range(searched)).toBe('Dec 29, 2025');
    expect(date(searched)).toBe('Dec 29, 2025');
    expect(
      searched.querySelector('tr[data-feed-row] > td:last-child time')?.getAttribute('datetime'),
    ).toBe('2025-12-29');
    cleanup();

    // The search finds the row itself: the whole span, and the newest part's date.
    const whole = renderFeed('?q=marathon', { parts: 'fold' });
    expect(range(whole)).toBe('Dec 29 – 30, 2025');
    expect(date(whole)).toBe('Dec 30, 2025');
    cleanup();

    // The one feed's year bar holds the year.
    const feed = renderFeed('?q=Part+2/2', { layout: 'feed', parts: 'fold' });
    expect(range(feed)).toBe('Dec 29');
    expect(date(feed)).toBe('Dec 29');
  });
});

describe('header figures (media-3, cross-6)', () => {
  it('count what the chips count: every upload, folded into a row or not', () => {
    renderFeed();
    const strip = within(screen.getByLabelText('Totals'));

    expect(strip.getByText('videos').closest('div')?.textContent).toBe('videos4');
  });

  it('show the newest date as one short figure, the month in its label', () => {
    renderFeed();
    const strip = screen.getByLabelText('Totals');

    expect(strip.textContent).toContain('latest, May2026');
    expect(strip.textContent).not.toContain('May 2026');
  });

  it('formats the month and the year on their own', () => {
    expect(monthName('2026-05-05T01:33:15Z')).toBe('May');
    expect(yearOf('2026-05-05T01:33:15Z')).toBe('2026');
    expect(yearOf('2025-12-31T23:59:59Z')).toBe('2025');
  });

  it('are the section counts in section order when three kinds have items', () => {
    renderFeed('', { entries: feedOf({ stream: 3, video: 2, post: 1 }), parts: 'each' });

    expect(figures()).toEqual(['post 1', 'videos 2', 'streams 3']);
  });

  it('keep the three largest kinds, still in section order, when more have items', () => {
    renderFeed('', { entries: feedOf({ post: 1, video: 4, stream: 3, talk: 2 }), parts: 'each' });

    expect(figures()).toEqual(['videos 4', 'streams 3', 'talks 2']);
  });

  it('fill the last place with the newest date when fewer than three kinds have items', () => {
    renderFeed('', { entries: feedOf({ post: 2, video: 1 }), parts: 'each' });

    expect(figures().slice(0, 2)).toEqual(['posts 2', 'video 1']);
    expect(figures()).toHaveLength(3);
    expect(figures()[2]).toMatch(/^latest, [A-Z][a-z]{2} \d{4}$/);
  });
});

describe('columns (round 2)', () => {
  it('gives every section a Date column wide enough for a date with its year', () => {
    for (const kind of FEED_KINDS) {
      const columns: readonly FeedColumn[] = SECTION_COLUMNS[kind];
      const date = columns.at(-1);

      expect(date).toMatchObject({ id: 'date', width: 'w-[8rem]', align: 'end' });
      expect(columns.some((column) => column.id === 'kind')).toBe(false);
    }
  });

  it('keeps the one feed its five columns and its short date', () => {
    expect(FEED_COLUMNS.map((column) => column.id)).toEqual([
      'item',
      'kind',
      'where',
      'length',
      'date',
    ]);
    const feedColumns: readonly FeedColumn[] = FEED_COLUMNS;
    expect(feedColumns.at(-1)?.width).toBe('w-[5rem]');
    const root = renderFeed('', { layout: 'feed', parts: 'each' });

    expect(
      Array.from(root.querySelectorAll('tr[data-feed-row] time'), (time) => time.textContent),
    ).toEqual(['May 5', 'Dec 30', 'Dec 29', 'Dec 29']);
    expect(root.querySelector('[data-feed-meta]')?.textContent).toBe('Video · 11:34 · May 5');
  });
});

describe('the parts disclosure (media-4, media-9, lab-5)', () => {
  it('is at least a 24px target and clears the sticky bars when focused', () => {
    const root = renderFeed();
    const summary = stream(root).querySelector('summary');

    expect(PARTS_SUMMARY_CLASS.split(' ')).toContain('min-h-6');
    // The kit's row gives a focused summary its scroll margin, as it does links and buttons.
    expect(summary?.closest('tr')?.className).toContain('[&_:is(a,button,summary)]:scroll-mt-[');
  });

  it('keeps the date range whole, so a narrow line breaks before it rather than cutting it', () => {
    const root = renderFeed();
    const range = stream(root).querySelector('summary [data-parts-range]');

    // A section has no year bar, so the range carries its year (a phone's row has no date cell).
    expect(range?.textContent).toBe('Dec 29 – 30, 2025');
    expect(range?.className).toContain('whitespace-nowrap');
  });

  it('leaves the year to the year bar in the one feed', () => {
    const root = renderFeed('', { layout: 'feed' });

    expect(stream(root).querySelector('summary [data-parts-range]')?.textContent).toBe(
      'Dec 29 – 30',
    );
  });
});

describe('a search that matches one part (media-5)', () => {
  it('stays closed and unmarked without a search', () => {
    const details = stream(renderFeed());

    expect(details.open).toBe(false);
    expect(details.querySelectorAll('li[data-match]')).toHaveLength(0);
  });

  it('opens the parts and marks the one that matched', () => {
    const details = stream(renderFeed('?q=Part+2/2'));

    expect(details.open).toBe(true);
    const marked = details.querySelectorAll('li[data-match]');
    expect(marked).toHaveLength(1);
    expect(marked[0]?.querySelector('a')?.getAttribute('href')).toContain('mara0000002');
    expect(marked[0]?.className).toContain(PART_MATCH_CLASS);
  });

  it('closes the parts again when the search that opened them is cleared', () => {
    const root = renderFeed('?q=Part+2/2');
    const search = root.querySelector<HTMLInputElement>('input[type="search"]');
    if (!search) throw new Error('no search field');
    expect(stream(root).open).toBe(true);

    fireEvent.change(search, { target: { value: '' } });

    expect(stream(root).open).toBe(false);
    expect(stream(root).querySelectorAll('li[data-match]')).toHaveLength(0);
  });

  it('keeps the parts open after the search is cleared when the visitor opened them', () => {
    const root = renderFeed();
    const search = root.querySelector<HTMLInputElement>('input[type="search"]');
    if (!search) throw new Error('no search field');
    const details = stream(root);
    details.open = true;
    fireEvent(details, new Event('toggle'));

    fireEvent.change(search, { target: { value: 'Part 2/2' } });
    expect(stream(root).open).toBe(true);
    fireEvent.change(search, { target: { value: '' } });

    expect(stream(root).open).toBe(true);
  });

  it('marks nothing when every part matches (the stream itself matched)', () => {
    const details = stream(renderFeed('?q=marathon'));

    expect(details.open).toBe(false);
    expect(details.querySelectorAll('li[data-match]')).toHaveLength(0);
  });

  it('names each part by its own title on hover', () => {
    const details = stream(renderFeed());
    const titles = Array.from(details.querySelectorAll('a[data-feed-part]'), (link) =>
      link.getAttribute('title'),
    );

    expect(titles).toEqual([
      'Coding marathon. (Part 1/2)',
      'Coding marathon. (Part 2/2)',
      'Coding marathon.',
    ]);
  });
});

describe('stills (media-6, media-12, media-15)', () => {
  it('are blocks, so a stack keeps the same box as a plain still', () => {
    expect(THUMB_CLASS.split(' ')).toContain('block');
    expect(THUMB_STACK_CLASS.split(' ')).toContain('block');
  });

  it('show the kind glyph in place of an image that failed', () => {
    const root = renderFeed();
    const thumb = root.querySelector('tr [data-feed-thumb]');
    const image = thumb?.querySelector('img');
    expect(image).not.toBeNull();
    expect(thumb?.querySelector('svg')).toBeNull();

    if (image) fireEvent.error(image);

    expect(thumb?.querySelector('img')).toBeNull();
    expect(thumb?.querySelector('svg')).not.toBeNull();
  });

  it('turn their edge to brand ink with the row, never the translucent brand edge', () => {
    expect(THUMB_CLASS).toContain(
      'group-hover/row:after:shadow-[inset_0_0_0_1px_var(--brand-ink)]',
    );
    expect(THUMB_CLASS).not.toContain('--brand-edge');
  });
});

describe('row layout (media-7, media-13)', () => {
  it('gives the Length column room for a long total', () => {
    const length = FEED_COLUMNS.find((column) => column.id === 'length');

    expect(length?.width).toBe('w-[7.5rem]');
  });

  it('aligns a row with open parts to its top', () => {
    expect(ITEM_CLASS.split(' ')).toContain('has-[details[open]]:items-start');
    expect(OPEN_ROW_CELL_CLASS).toContain('[tr:has(details[open])_&]:align-top');
    const root = renderFeed();
    for (const cell of root.querySelectorAll('tr[data-feed-row] > td')) {
      expect(cell.className).toContain('[tr:has(details[open])_&]:align-top');
    }
  });
});

describe('the search field (media-8)', () => {
  it('uses a placeholder that fits the field', () => {
    renderFeed();

    expect(screen.getByRole('searchbox').getAttribute('placeholder')).toBe('Search');
  });
});

describe('the applied token on a phone (round 4)', () => {
  it('grows with a name longer than the screen instead of spilling out of its pill', () => {
    const root = renderFeed('?series=coding-marathon', { entries: ENTRIES, parts: 'each' });
    const token = root.querySelector('a[data-filter-part="token"]');
    const classes = (token?.getAttribute('class') ?? '').split(/\s+/);

    expect(token?.textContent).toContain('Series: Coding marathon.');
    // The kit's own pill now: at least one 28px line and as tall as its words, never a fixed
    // height (this page's fix moved into the FilterBar kit, so no class of the page reaches in).
    expect(classes).toContain('min-h-7');
    expect(classes).not.toContain('h-7');
    // 14px corners: the full pill at one line, a rounded box at two.
    expect(classes).toContain('rounded-[0.875rem]');
    expect(root.querySelector('[class*="data-filter-part=token"]')).toBeNull();
  });
});

describe('the phone Filters button (round 4)', () => {
  const filtersButton = (root: HTMLElement): HTMLElement | null =>
    root.querySelector('button[popovertarget]');

  it('does not count a series, which its sheet does not hold', () => {
    const root = renderFeed('?series=coding-marathon', { entries: ENTRIES, parts: 'each' });
    const button = filtersButton(root);

    // The sheet holds the Kind chips only; the series is the token under the search.
    expect(button?.textContent).toBe('Filters');
    expect(button?.hasAttribute('data-active')).toBe(false);
  });

  it('counts a chosen kind', () => {
    const kind = filtersButton(renderFeed('?kind=video', { entries: ENTRIES, parts: 'each' }));
    expect(kind?.textContent).toBe('Filters 1 applied');
    expect(kind?.hasAttribute('data-active')).toBe(true);
  });
});
