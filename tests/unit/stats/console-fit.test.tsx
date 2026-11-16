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
 * @file How the /stats console fits what it holds, where a rem or a fixed span did not:
 * - the Discord tile's room is measured in lines of its own text, so text a phone enlarges keeps
 *   the tile one height through every live state, and the status word never decides where the
 *   head row breaks;
 * - a repository's description shows whole wherever its row can grow, and a long one is shortened
 *   only under the name on a phone page;
 * - in the 12-column tier every tile is as tall as what it holds: LeetCode stands under Discord,
 *   typing and coding time under the hero, whose chart takes the height the right column adds;
 * - beside each other, typing and coding time take the same lines: typing has the larger share
 *   of a shared phone row, and a stale note stands in for 'updated' rather than adding a line.
 */

import { describe, expect, it, vi } from 'vitest';

// The tiles reuse home tile helpers, which import their loaders; nothing is loaded here.
vi.mock('@/app/_components/home/data/loaders', () => ({
  loadGitHubActivity: vi.fn(),
  loadLeetCode: vi.fn(),
  loadTyping: vi.fn(),
}));
vi.mock('@/env', () => {
  const env = { NODE_ENV: 'test', NEXT_PUBLIC_DISCORD_ID: '42' };
  return { env, default: env };
});

import {
  CODING_AGE_LINE_CLASS,
  TYPING_AGE_LINE_CLASS,
} from '@/app/(routes)/(dev)/stats/_components/console/console-layout';
import { StatsConsole } from '@/app/(routes)/(dev)/stats/_interface/stats-console/stats-console';
import type {
  AccuracyStyle,
  StatsConsoleData,
} from '@/app/(routes)/(dev)/stats/_lib/console-model';
import { WIDEST_PRESENCE_WORD } from '@/app/(routes)/(dev)/stats/_lib/discord-presence';
import {
  classOf,
  consoleFixture,
  hasClass,
  html,
  LONG_DESCRIPTION,
  NOW,
  SHORT_DESCRIPTION,
  textOf,
  tileOf,
} from './console-fixture';

const page = (data: StatsConsoleData = consoleFixture(), accuracy: AccuracyStyle = 'figures') =>
  html(<StatsConsole data={data} accuracy={accuracy} profileId="42" now={NOW} />);

interface Presence {
  readonly status?: string;
  readonly activities?: readonly {
    name: string;
    type: number;
    details?: string;
    state?: string;
  }[];
}

/** The Discord tile with Discord reporting `status` and `activities`. */
function discordWith({ status = 'online', activities = [] }: Presence): Element | null {
  const data = consoleFixture();
  if (data.discord.kind !== 'data') throw new Error('fixture must have Discord');
  const presence = { ...data.discord.data, discord_status: status, activities: [...activities] };
  return tileOf(page({ ...data, discord: { ...data.discord, data: presence } }), 'discord');
}

const CODE = { name: 'Visual Studio Code', type: 0, details: 'portfolio', state: 'Workspace' };
const TALK = { name: 'YouTube', type: 3, details: 'A talk', state: 'A channel' };
const SONG = { name: 'Spotify', type: 2, details: 'A song', state: 'An artist' };

/**
 * The room's height at each of the tile's widths, in lines (lh) of the row heading's text:
 * - words beside their art: two rows of every line they may take (4.7 lines each) and the gap;
 * - a tile under 12.5rem, where a lone row's words drop under its featured art: that row too;
 * - a tile under 11.25rem, where every row's words drop under its art: two such rows, or three
 *   of one line each, whichever is taller.
 * Each ends with the room's 1rem of padding and its 1px rule, and applies only where the browser
 * reads lh (`supports-[height:1lh]`).
 */
const ROOM_HEIGHTS = [
  'supports-[height:1lh]:min-h-[calc(47lh/5+1.75rem+1px)]',
  'supports-[height:1lh]:@min-[11.25rem]:@max-[12.5rem]:min-h-[calc(max(47lh/5+0.75rem,42lh/5+30cqi+0.5rem)+1rem+1px)]',
  'supports-[height:1lh]:@max-[11.25rem]:min-h-[calc(max(47lh/5+6.75rem,42lh/5+10.5rem)+1rem+1px)]',
] as const;
/** The same room in rem (its height at the default text size), for a browser without lh. */
const ROOM_HEIGHT_WITHOUT_LH = 'min-h-[calc(13.5rem+1px)]';

describe('Discord tile, sized in the lines it holds', () => {
  it('reserves one room for every state, measured in lines of the row text wherever lh is read', () => {
    for (const activities of [[], [CODE], [SONG, CODE], [SONG, CODE, TALK]]) {
      const discord = discordWith({ activities });
      const room = discord?.querySelector('[data-discord-room]');
      const state = `${activities.length} activities`;

      // One line of the room is one line of a row's heading (20px at the default size), which a
      // phone's text scaling grows with the text. A rem does not grow, and the tallest states
      // then outgrew a room measured in rem and moved the page.
      expect(hasClass(room, 'leading-5'), state).toBe(true);
      for (const height of ROOM_HEIGHTS) expect(hasClass(room, height), state).toBe(true);
      // A browser that does not read lh drops those and keeps the room it had in rem.
      expect(hasClass(room, ROOM_HEIGHT_WITHOUT_LH), state).toBe(true);
      expect(hasClass(room, 'flex-1'), state).toBe(true);
      expect(room?.querySelectorAll('li'), state).toHaveLength(activities.length);
      // 12px between the tile's parts, so the room costs the page as little height as it can.
      expect(hasClass(discord, 'gap-3'), state).toBe(true);
      // No tier is told apart: the room is the tile's own, whatever the grid around it.
      expect(classOf(discord), state).not.toContain('--lone-');
    }
  });

  it('holds the tile at the same height while Discord has not answered, part for part', () => {
    const data: StatsConsoleData = { ...consoleFixture(), discord: { kind: 'timeout' } };
    const held = tileOf(page(data), 'discord')?.querySelector('[data-discord-unavailable]');
    const [name, room, age] = [...(held?.children ?? [])];

    expect(textOf(held)).toBe('Discord didn’t answer in time');
    // The same three parts the answer brings, 12px apart: a stand-in for the name row (the
    // avatar's 40px or a line of the name, whichever is taller; the name under the avatar in a
    // tile too narrow for both), the room at its own height with the words in its middle, and a
    // stand-in for the age line. Each is sized as the part it stands in for, at any text size.
    expect(held?.children).toHaveLength(3);
    expect(hasClass(held, 'gap-3')).toBe(true);
    expect(hasClass(held, 'flex-1')).toBe(true);
    expect(name?.getAttribute('aria-hidden')).toBe('true');
    expect(hasClass(name, 'tile-title')).toBe(true);
    expect(hasClass(name, 'min-h-10')).toBe(true);
    expect(hasClass(name, 'supports-[height:1lh]:h-[1lh]')).toBe(true);
    expect(hasClass(name, 'supports-[height:1lh]:@max-[11.25rem]:h-[calc(3rem+1lh)]')).toBe(true);
    expect(textOf(room)).toBe('Discord didn’t answer in time');
    expect(hasClass(room, 'leading-5')).toBe(true);
    for (const height of ROOM_HEIGHTS) expect(hasClass(room, height)).toBe(true);
    expect(hasClass(room, ROOM_HEIGHT_WITHOUT_LH)).toBe(true);
    expect(hasClass(room, 'justify-center')).toBe(true);
    expect(age?.getAttribute('aria-hidden')).toBe('true');
    expect(hasClass(age, 'tile-meta')).toBe(true);
    // One line of the age: 1.125rem, or a line of the text in use where lh is read.
    expect(hasClass(age, 'h-4.5')).toBe(true);
    expect(hasClass(age, 'supports-[height:1lh]:h-[1lh]')).toBe(true);
    expect(classOf(held)).not.toContain('18.625rem');
  });

  // With text enlarged, 'Do not disturb' no longer fits beside the label where 'Idle' does: left
  // to its own width the word dropped under the label for some statuses only, and a change of
  // status moved the page by that line.
  it('lays the status word out in the room of the widest one, whatever the status', () => {
    expect(WIDEST_PRESENCE_WORD).toBe('Do not disturb');
    for (const [status, word] of [
      ['online', 'Online'],
      ['idle', 'Idle'],
      ['dnd', 'Do not disturb'],
      ['offline', 'Offline'],
    ] as const) {
      const head = discordWith({ status, activities: [CODE] })?.firstElementChild;
      const room = head?.querySelector('p');

      expect(textOf(room), status).toBe(word);
      expect(room?.getAttribute('data-widest'), status).toBe('Do not disturb');
      // Generated content, unseen, in the word's own cell: it takes the room and is no text.
      expect(hasClass(room, 'inline-grid'), status).toBe(true);
      expect(hasClass(room, 'before:invisible'), status).toBe(true);
      expect(hasClass(room, 'before:content-[attr(data-widest)]'), status).toBe(true);
      expect(hasClass(room, 'before:col-start-1'), status).toBe(true);
      expect(hasClass(room, 'before:row-start-1'), status).toBe(true);
      // The dot and its gap are not text: the widest word is padded by their width.
      expect(hasClass(room, 'before:pl-3.5'), status).toBe(true);
      // The word ends where the room does, on the tile's right edge, beside the label or under it.
      expect(hasClass(room, 'ml-auto'), status).toBe(true);
      expect(hasClass(room, 'justify-items-end'), status).toBe(true);
      const shown = room?.firstElementChild;
      expect(hasClass(shown, 'col-start-1'), status).toBe(true);
      expect(hasClass(shown, 'row-start-1'), status).toBe(true);
      expect(shown?.querySelector('[data-status-dot]'), status).not.toBeNull();
    }
  });
});

describe('Repository descriptions', () => {
  const rows = () => [...page().querySelectorAll('[data-stats-repo]')];
  const aboutColumn = (row: Element | undefined) =>
    row?.querySelectorAll('td')[2]?.firstElementChild;
  const underName = (row: Element | undefined) => row?.querySelector('[data-repo-about]');

  it('shows a description whole in its own column, where the row simply grows', () => {
    const [short, long] = rows();

    expect(textOf(aboutColumn(short))).toBe(SHORT_DESCRIPTION);
    expect(textOf(aboutColumn(long))).toBe(LONG_DESCRIPTION);
    for (const row of [short, long]) {
      expect(classOf(aboutColumn(row))).not.toContain('line-clamp');
      expect(classOf(aboutColumn(row))).not.toContain('truncate');
    }
  });

  it('never shortens a short description under the name, at any text size', () => {
    const line = underName(rows()[0]);

    expect(textOf(line)).toBe(SHORT_DESCRIPTION);
    expect(classOf(line)).not.toContain('line-clamp');
    expect(hasClass(line, '@min-[38lh]/page:hidden')).toBe(true);
  });

  // At the kit's 48rem step About was 145px on an upright tablet and a 268-character description
  // stood 14 lines, a row four times its neighbours'. From 38 lines of the page's text (988px at
  // the default size, gutters included) About has about 375px: five lines.
  it('gives the description its own column only once the page has room for it', () => {
    const root = page();
    const section = root.querySelector('section[aria-label="Top repositories"]');
    const col = root.querySelectorAll('table col')[2];
    const label = root.querySelectorAll('table th')[2];
    const cell = rows()[0]?.querySelectorAll('td')[2];

    expect(textOf(label)).toBe('About');
    for (const part of [col, cell]) {
      expect(hasClass(part, 'hidden')).toBe(true);
      expect(classOf(part)).not.toContain('48rem');
    }
    expect(hasClass(col, '@min-[38lh]/page:table-column')).toBe(true);
    expect(hasClass(cell, '@min-[38lh]/page:table-cell')).toBe(true);
    // The kit draws the labels, so the section hides the third one (About) until then.
    expect(hasClass(section, '[&_thead_th:nth-child(3)]:hidden')).toBe(true);
    expect(hasClass(section, '@min-[38lh]/page:[&_thead_th:nth-child(3)]:table-cell')).toBe(true);
  });

  it('shortens a long one under the name after three lines, six on the narrowest page, four beside the language', () => {
    const line = underName(rows()[1]);

    expect(textOf(line)).toBe(LONG_DESCRIPTION);
    expect(hasClass(line, 'line-clamp-3')).toBe(true);
    // 9.84 lines of the page's text are the 16rem the step had at the default size (256px); in
    // lines it also reaches a phone whose text is enlarged without any length changing.
    expect(hasClass(line, '@max-[9.84lh]/page:line-clamp-6')).toBe(true);
    expect(classOf(line)).not.toContain('16rem');
    // From 40rem (the language in its column) up to the About step a 268-character description
    // takes four to six lines under the name; four keep it whole from about 780px, where About
    // used to show it whole, and keep the row under twice its neighbours. Only the count changes
    // there: a second line-clamp class would set its display after the step's `hidden` and show
    // the description twice beside About.
    expect(hasClass(line, '@min-[40rem]/page:[-webkit-line-clamp:4]')).toBe(true);
    expect(classOf(line)).not.toContain('@min-[40rem]/page:line-clamp');
    expect(hasClass(line, '@min-[38lh]/page:hidden')).toBe(true);
  });
});

describe('12-column tier: every tile as tall as what it holds', () => {
  const spanOf = (root: HTMLElement, name: string) =>
    classOf(tileOf(root, name))
      .split(/\s+/)
      .filter((token) => token.startsWith('@[70rem]/tiles:'))
      .sort()
      .join(' ');

  for (const accuracy of ['figures', 'gauge'] as const) {
    it(`stands LeetCode under Discord and typing and coding under the hero (${accuracy})`, () => {
      const root = page(consoleFixture(), accuracy);
      const grid = root.querySelector('[aria-label="Activity and development stats"]');

      // Two rows for the hero beside Discord, a row that takes whatever LeetCode is taller than
      // the two tiles beside it, then their row. The hero spans the first three and ends where
      // typing and coding start; Discord spans two and LeetCode the next two, under it.
      expect(hasClass(grid, '@[70rem]/tiles:grid-rows-[auto_auto_1fr_auto]')).toBe(true);
      expect(spanOf(root, 'github')).toBe('@[70rem]/tiles:col-span-8 @[70rem]/tiles:row-span-3');
      expect(spanOf(root, 'discord')).toBe('@[70rem]/tiles:col-span-4 @[70rem]/tiles:row-span-2');
      expect(spanOf(root, 'leetcode')).toBe('@[70rem]/tiles:col-span-4 @[70rem]/tiles:row-span-2');
      // Typing is the wider of the two under the hero, so its context line stays on one line and
      // both are as tall as their one figure.
      expect(spanOf(root, 'typing')).toBe('@[70rem]/tiles:col-span-5');
      expect(spanOf(root, 'coding')).toBe('@[70rem]/tiles:col-span-3');
      // The tiles are placed by the grid in the order they are written, so the tab order is the
      // order drawn: the hero, Discord, LeetCode under it, then typing and coding.
      expect(
        [...root.querySelectorAll('[data-stats-tile]')].map((tile) =>
          tile.getAttribute('data-stats-tile'),
        ),
      ).toEqual(['github', 'discord', 'leetcode', 'typing', 'coding']);
      expect(classOf(grid)).not.toContain('grid-flow-row-dense');
    });
  }

  it('gives the height the right column adds to the hero’s chart, not to a gap', () => {
    const hero = tileOf(page(), 'github');
    const chart = hero?.querySelector('[data-sparkline]');
    const column = chart?.parentElement;
    const activity = column?.parentElement;

    // The row of the figure and the chart takes the tile's spare height; the chart's column
    // stands the full height of that row and the chart takes what is left over its labels. Where
    // the hero is as tall as its own content (every other tier) nothing is spare.
    expect(hasClass(activity, 'grow')).toBe(true);
    expect(hasClass(column, 'flex')).toBe(true);
    expect(hasClass(column, 'flex-col')).toBe(true);
    expect(hasClass(column, '@[36rem]:self-stretch')).toBe(true);
    expect(hasClass(chart, 'grow')).toBe(true);
    // Its 112px beside the figure is where it starts from, and a short screen still lowers it.
    expect(hasClass(chart, '@[36rem]:h-28')).toBe(true);
    expect(hasClass(chart, '@max-[70rem]/tiles:[@media(max-height:30rem)]:h-20!')).toBe(true);
  });
});

describe('Stat tiles beside each other: no line more for one than the other', () => {
  // Typing's context is three facts and an age, coding time's one and an age: in equal halves
  // typing took three lines and coding time one, and coding time was stretched to typing's height
  // (172px against 126 of content at a 480px window). So typing takes the larger share of a
  // shared row (three fifths, then two thirds, console-layout.ts), and in the 6-column tier both
  // ages take a line of their own up to one step, so both lines switch at one width. That the two
  // take the same lines is held where it can be seen, in the browser: stats-tiles.spec.ts walks
  // every 2px from a 464 to an 870px window. What is left here is how the tiles are written.
  it('writes typing first in a shared row, the larger share, and every other tile across it', () => {
    const root = page();
    const order = [...root.querySelectorAll('[data-stats-tile]')].map((tile) =>
      tile.getAttribute('data-stats-tile'),
    );
    expect(order.indexOf('typing')).toBe(order.indexOf('coding') - 1);
    for (const name of ['discord', 'leetcode']) {
      expect(hasClass(tileOf(root, name), 'col-span-2'), name).toBe(true);
    }
  });

  // A stale coding time's line already stands under the kit's note (its tile is too narrow for
  // the 8rem beside it), so it is two lines; with its age on a line of its own as well it took
  // three, 17 to 22px taller than fresh across the 6-column tier.
  it('puts both ages on a line of their own, but leaves a stale coding time’s line as it falls', () => {
    const data = consoleFixture();
    if (data.codingTime.status !== 'ok') throw new Error('fixture must have coding time');
    const stale = page({ ...data, codingTime: { ...data.codingTime, stale: true } });
    const tokens = (classes: string) => classes.split(/\s+/);

    for (const token of tokens(TYPING_AGE_LINE_CLASS)) {
      expect(hasClass(tileOf(stale, 'typing'), token)).toBe(true);
    }
    for (const token of tokens(CODING_AGE_LINE_CLASS)) {
      expect(hasClass(tileOf(stale, 'coding'), token)).toBe(true);
    }
    // The rule reads the tile's own state: coding time's skips a stale tile, typing's does not.
    expect(tileOf(stale, 'coding')?.getAttribute('data-state')).toBe('stale');
    expect(CODING_AGE_LINE_CLASS).toContain(':not([data-state=stale])');
    expect(TYPING_AGE_LINE_CLASS).not.toContain('data-state');
  });

  // The kit's stale note ('Stale ·' and its clock) leads the line, and a line that was one line
  // fresh took two beside it, stretching the tile beside it too. The note stands in for
  // 'updated', so the line is no longer than it was by that word's width.
  it('lets the stale note stand in for “updated”, in a room of the shorter wording', () => {
    const data = consoleFixture();
    if (data.typing.status !== 'ok' || data.codingTime.status !== 'ok') {
      throw new Error('fixture must have typing and coding time');
    }
    const root = page({
      ...data,
      typing: { ...data.typing, stale: true },
      codingTime: { ...data.codingTime, stale: true },
    });

    for (const name of ['typing', 'coding']) {
      const line = tileOf(root, name)?.querySelector('[data-context-line]');
      // The note and the line are side by side in the kit's row (its gap, not a space, between).
      expect(textOf(line?.parentElement), name).toMatch(/^Stale ·/);
      expect(textOf(line), name).toMatch(/(\d+ (min|h|d) ago|just now)$/);
      expect(textOf(line), name).not.toContain('updated');
      expect(line?.querySelector('[data-age-room]')?.getAttribute('data-widest'), name).toBe(
        '59 min ago',
      );
    }
    expect(textOf(tileOf(root, 'coding')?.querySelector('[data-context-line]'))).toMatch(
      /^all time · \d/,
    );
    // A fresh tile beside them keeps its word.
    expect(textOf(tileOf(root, 'leetcode')?.querySelector('[data-context-line]'))).toMatch(
      / · updated /,
    );
  });
});
