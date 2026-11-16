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
 * @file The room an age is laid out in (age-room.tsx) and the GitHub hero's use of it. An age is
 * re-read while the page is open; in the room of its widest wording, where a row breaks never
 * depends on the clock, so a growing age cannot add a line to a tile and move the page under it.
 * The stat tiles' use of the same room is held in console-html.test.tsx.
 */

import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The hero reuses home tile helpers, which import their loaders; nothing is loaded here.
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
  AGE_CELL_CLASS,
  AgeRoom,
  WIDEST_AGE,
} from '@/app/(routes)/(dev)/stats/_components/console/age-room';
import { GitHubHero } from '@/app/(routes)/(dev)/stats/_components/console/github-hero';
import type { HeroModel } from '@/app/(routes)/(dev)/stats/_lib/console-model';

const AS_OF = '2026-11-10T15:00:00Z';
const NOW = Date.parse('2026-11-10T15:03:00Z');

const HERO: HeroModel = {
  state: 'ready',
  activity: {
    total: 4321,
    weeks: [{ start: '2026-11-01', count: 4321 }],
    latestCommit: null,
    fetchedAt: AS_OF,
  },
  totals: { repos: 324, stars: 87, languages: ['TypeScript'] },
  missing: [],
  asOf: AS_OF,
};

/** Parses server markup without hydrating it or running any effects. */
function html(node: ReactElement): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = renderToString(node);
  return root;
}

const textOf = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
/** True when `name` is one of the element's own classes (not a prefix of a longer one). */
const hasClass = (element: Element | null | undefined, name: string) =>
  (element?.getAttribute('class') ?? '').split(/\s+/).includes(name);

/** The hero's head row: its label, then its age. */
const headOf = (hero: HeroModel) =>
  html(<GitHubHero hero={hero} now={NOW} />).querySelector('[data-stats-tile="github"]')
    ?.firstElementChild;

describe('AgeRoom', () => {
  it('lays the widest age out, unseen, in the cell of what it holds', () => {
    const room = html(
      <AgeRoom>
        <span className={AGE_CELL_CLASS}>updated 3 min ago</span>
      </AgeRoom>,
    ).firstElementChild;

    // Two digits and the longest unit: no age reads wider.
    expect(WIDEST_AGE).toBe('updated 59 min ago');
    expect(room?.getAttribute('data-widest')).toBe(WIDEST_AGE);
    // Generated content, so it takes room and wraps as the age would, and is no text of the page.
    expect(hasClass(room, 'inline-grid')).toBe(true);
    expect(hasClass(room, 'before:invisible')).toBe(true);
    expect(hasClass(room, 'before:content-[attr(data-widest)]')).toBe(true);
    expect(hasClass(room, 'before:col-start-1')).toBe(true);
    expect(hasClass(room, 'before:row-start-1')).toBe(true);
    expect(AGE_CELL_CLASS).toBe('col-start-1 row-start-1');
    expect(textOf(room)).toBe('updated 3 min ago');
  });

  // Hinted text (Linux) sets 29 of the 59 minute wordings 1 to 2px wider than '59 min' at 13px
  // ('updated 22 min ago' is 122px against 120px), so a tile's height followed the minute shown
  // at about twenty window widths. A fifth of an em more than the widest wording holds them all.
  it('reserves a little more than the widest wording, for hinted text', () => {
    const room = html(
      <AgeRoom>
        <span className={AGE_CELL_CLASS}>updated 22 min ago</span>
      </AgeRoom>,
    ).firstElementChild;

    expect(hasClass(room, 'before:pr-[0.2em]')).toBe(true);
  });

  it('takes a wider wording and the caller’s classes', () => {
    const room = html(
      <AgeRoom widest="Stale · updated 59 min ago" className="ml-auto">
        <span className={AGE_CELL_CLASS}>Stale · updated 3 h ago</span>
      </AgeRoom>,
    ).firstElementChild;

    expect(room?.getAttribute('data-widest')).toBe('Stale · updated 59 min ago');
    expect(hasClass(room, 'ml-auto')).toBe(true);
    expect(hasClass(room, 'inline-grid')).toBe(true);
  });
});

describe('GitHub hero age', () => {
  // In a 280px window 'updated 9 min ago' fits beside the hero's label and 'updated 10 min ago'
  // does not: left to its own width the age dropped under the label as it grew, and every tile
  // below moved by that line.
  it('sits in the room of its widest wording, so the head never re-wraps as it grows', () => {
    const head = headOf(HERO);
    const room = head?.querySelector('[data-age-room]');
    const age = room?.querySelector('time');

    expect(room?.parentElement).toBe(head);
    expect(room?.getAttribute('data-widest')).toBe('updated 59 min ago');
    expect(hasClass(age, 'col-start-1')).toBe(true);
    expect(hasClass(age, 'row-start-1')).toBe(true);
    expect(textOf(room)).toMatch(/^updated \d+ (min|h|d) ago$|^updated just now$/);
    expect(textOf(head)).not.toContain('59 min');
  });

  it('rests on the tile’s right edge, beside the label or on the row under it', () => {
    const room = headOf(HERO)?.querySelector('[data-age-room]');

    // The room takes the row's spare width on its left; the age ends where the room does.
    expect(hasClass(room, 'ml-auto')).toBe(true);
    expect(hasClass(room, 'justify-items-end')).toBe(true);
  });

  // In a room of its own widest wording ('Stale · updated 59 min ago' and its clock) the stale
  // note dropped under the label at 260 to 340px where the fresh age did not, a line taller.
  it('holds a stale note in the fresh age’s room, so the head breaks where a fresh one does', () => {
    const head = headOf({ ...HERO, state: 'stale' });
    const room = head?.querySelector('[data-age-room]');
    const note = room?.querySelector('[data-stale]');

    expect(room?.parentElement).toBe(head);
    expect(room?.getAttribute('data-widest')).toBe(WIDEST_AGE);
    expect(hasClass(room, 'ml-auto')).toBe(true);
    expect(hasClass(room, 'justify-items-end')).toBe(true);
    // The note sits in the room's one cell, beside the fresh wording laid out there; the cell asks
    // for no width (so the room is the fresh age's) and ends on the room's right edge.
    const cell = note?.parentElement;
    expect(cell?.parentElement).toBe(room);
    for (const token of AGE_CELL_CLASS.split(' ')) expect(hasClass(cell, token)).toBe(true);
    expect(hasClass(cell, 'w-0') && hasClass(cell, 'min-w-full')).toBe(true);
    expect(hasClass(cell, 'justify-end')).toBe(true);
    // The page's one stale treatment: a clock, 'Stale ·' and the age without 'updated'.
    expect(note?.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect(textOf(note)).toMatch(/^Stale · (\d+ (min|h|d) ago|just now)$/);
    expect(note?.querySelector('time')).not.toBeNull();
  });

  it('shows no age, and no room for one, when no source says when it was read', () => {
    const { asOf: _asOf, ...undated } = HERO;
    const head = headOf(undated);

    expect(head?.querySelector('[data-age-room]')).toBeNull();
    expect(head?.querySelector('time')).toBeNull();
  });
});
