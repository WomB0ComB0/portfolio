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
 * @file One stale treatment on /stats: wherever a figure is an old answer (the GitHub hero, a stat
 * tile, the repository table), it reads the kit's way, a clock, 'Stale ·' and the age without
 * 'updated' ('⏲ Stale · 1 h ago'). The hero's note sits in the room of the fresh age, so a stale
 * hero breaks its head row wherever a fresh one does and is never a line taller.
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

import { WIDEST_AGE } from '@/app/(routes)/(dev)/stats/_components/console/age-room';
import { StatsConsole } from '@/app/(routes)/(dev)/stats/_interface/stats-console/stats-console';
import type { StatsConsoleData } from '@/app/(routes)/(dev)/stats/_lib/console-model';
import { consoleFixture, hasClass, html, NOW, textOf, tileOf } from './console-fixture';

const page = (data: StatsConsoleData) =>
  html(<StatsConsole data={data} profileId="42" now={NOW} />);

/** An age as Freshness words it by the test's own clock, without its 'updated'. */
const AGE = /(\d+ (min|h|d) ago|just now)/;

/** What went stale for real on the lab server: the GitHub totals (hero and table) and coding. */
function staleHourlySources(): StatsConsoleData {
  const data = consoleFixture();
  if (data.totals.status !== 'ok' || data.codingTime.status !== 'ok') {
    throw new Error('fixture must have totals and coding time');
  }
  return {
    ...data,
    totals: { ...data.totals, stale: true },
    codingTime: { ...data.codingTime, stale: true },
  };
}

/**
 * Every 'Stale ·' on the page, with the glyph its line starts with and the words after it: the
 * kit's note in a stat tile's meta row, or the page's own (stale-age.tsx) in the hero and table.
 */
function staleNotes(root: HTMLElement) {
  return [...root.querySelectorAll('span')]
    .filter((span) => span.textContent === 'Stale ·')
    .map((note) => ({
      glyph: note.closest('[data-stale]')?.firstElementChild ?? note.previousElementSibling,
      after: textOf(note.nextElementSibling),
      where:
        note.closest('[data-stats-tile]')?.getAttribute('data-stats-tile') ??
        (note.closest('section')?.querySelector('table') ? 'table' : 'other'),
    }));
}

/** The age's room in the hero's head row. */
const heroRoom = (root: HTMLElement) =>
  tileOf(root, 'github')?.firstElementChild?.querySelector(':scope > [data-age-room]');

/** The line under the repository table that dates it. */
const tableFooter = (root: HTMLElement) =>
  root.querySelector('section[aria-label="Top repositories"] > p');

describe('one stale treatment', () => {
  it('reads every stale figure as a clock, ‘Stale ·’ and the age, without ‘updated’', () => {
    const notes = staleNotes(page(staleHourlySources()));

    expect(notes.map((note) => note.where).sort()).toEqual(['coding', 'github', 'table']);
    for (const note of notes) {
      expect(note.glyph?.tagName.toLowerCase(), note.where).toBe('svg');
      expect(note.glyph?.getAttribute('aria-hidden'), note.where).toBe('true');
      expect(note.after, note.where).not.toContain('updated');
      expect(note.after, note.where).toMatch(new RegExp(`${AGE.source}$`));
    }
    // The stat tile keeps its own words before the age.
    expect(notes.find((note) => note.where === 'coding')?.after).toMatch(/^all time · \d/);
  });

  it('keeps ‘updated’ on the fresh figures beside them', () => {
    const root = page(staleHourlySources());

    expect(textOf(tileOf(root, 'leetcode')?.querySelector('[data-context-line]'))).toMatch(
      new RegExp(` · updated ${AGE.source}$`),
    );
    expect(textOf(tileOf(root, 'typing')?.querySelector('[data-context-line]'))).toMatch(
      new RegExp(` · updated ${AGE.source}$`),
    );
  });

  it('sets the hero’s note in the fresh age’s room, so its head breaks where a fresh one does', () => {
    const fresh = heroRoom(page(consoleFixture()));
    const stale = heroRoom(page(staleHourlySources()));

    expect(fresh?.getAttribute('data-widest')).toBe(WIDEST_AGE);
    expect(stale?.getAttribute('data-widest')).toBe(WIDEST_AGE);
    expect(stale?.getAttribute('class')).toBe(fresh?.getAttribute('class'));
    // The note asks the room for no width of its own and ends on its right edge; at its widest
    // ('Stale · 59 min ago' and the clock) it reaches into the head's gap rather than widen it.
    const cell = stale?.firstElementChild;
    for (const name of ['col-start-1', 'row-start-1', 'w-0', 'min-w-full', 'justify-end']) {
      expect(hasClass(cell, name), name).toBe(true);
    }
    expect(textOf(stale)).toMatch(new RegExp(`^Stale · ${AGE.source}$`));
  });

  it('dates the table’s stale footer the same way, with its clock', () => {
    const footer = tableFooter(page(staleHourlySources()));

    expect(textOf(footer)).toMatch(new RegExp(`^Stale · ${AGE.source}$`));
    expect(footer?.querySelector('svg')).not.toBeNull();
    expect(textOf(tableFooter(page(consoleFixture())))).toMatch(
      new RegExp(`^updated ${AGE.source}$`),
    );
  });
});
