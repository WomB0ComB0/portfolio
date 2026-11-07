// @vitest-environment node
/**
 * Copyright 2025 Mike Odnis
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
 * @file The home tiles' date and time formatting (src/app/_components/home/data/format.ts).
 * Days and clock times are New York's, whatever the machine's time zone: the tests run under
 * America/Los_Angeles, where reading a Sanity date in local time would shift it to the day before.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  commitHeadline,
  companyName,
  firstSentence,
  formatAsOfDay,
  formatClockET,
  formatDay,
  formatDaySpan,
  formatMonthYear,
  formatRelative,
  formatYear,
  lastDayOf,
  nyToday,
  splitTitle,
} from '@/app/_components/home/data/format';

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Noon in New York (EST, UTC-5) on Thursday 2026-11-05. */
const NOW = Date.UTC(2026, 10, 5, 17, 0);
const ago = (ms: number): string => new Date(NOW - ms).toISOString();

const MACHINE_TIME_ZONE = 'America/Los_Angeles';
const originalTimeZone = process.env.TZ;

beforeAll(() => {
  process.env.TZ = MACHINE_TIME_ZONE;
  // In Los Angeles, a Sanity date read as local time falls on the day before.
  if (new Date(Date.parse('2026-03-01')).getDate() !== 28) {
    throw new Error(`TZ=${MACHINE_TIME_ZONE} did not take effect`);
  }
});

afterAll(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

describe('nyToday', () => {
  it("gives New York's date, not UTC's, late in the evening", () => {
    expect(nyToday(new Date('2026-11-06T03:30:00Z'))).toBe('2026-11-05');
  });

  it('accepts epoch milliseconds', () => {
    // 11:30 PM on Nov 5 in New York.
    expect(nyToday(Date.UTC(2026, 10, 6, 4, 30))).toBe('2026-11-05');
  });
});

describe('formatMonthYear', () => {
  it('prints a Sanity date as written, without shifting to the month before', () => {
    expect(formatMonthYear('2026-03-01')).toBe('Mar 2026');
    expect(formatMonthYear('2024-01')).toBe('Jan 2024');
  });

  it('prints a timestamp in New York time', () => {
    expect(formatMonthYear('2026-03-01T03:00:00Z')).toBe('Feb 2026');
  });

  it('prints nothing for a value that is not a real date', () => {
    expect(formatMonthYear('soon')).toBe('');
    expect(formatMonthYear('2026-02-30')).toBe('');
  });

  it('prints nothing for a timestamp on a day that does not exist, never the day it rolls to', () => {
    // Date.parse reads this as March 2.
    expect(formatMonthYear('2026-02-30T12:00:00Z')).toBe('');
    expect(formatMonthYear('2026-04-31T09:00:00-04:00')).toBe('');
  });

  it('checks the day as written, before the offset moves it to the next day', () => {
    // 11:30 PM on Feb 28 at UTC-5 is Mar 1 in UTC, and still Feb 28 in New York.
    expect(formatMonthYear('2026-02-28T23:30:00-05:00')).toBe('Feb 2026');
  });
});

describe('formatDay', () => {
  it('prints a Sanity date as written', () => {
    expect(formatDay('2026-10-30')).toBe('Oct 30');
  });

  it('prints a timestamp on its New York day', () => {
    expect(formatDay('2026-10-31T02:00:00Z')).toBe('Oct 30');
  });

  it('adds the year only when the day is in another year than now', () => {
    expect(formatDay('2025-10-30', NOW)).toBe('Oct 30, 2025');
    expect(formatDay('2026-10-30', NOW)).toBe('Oct 30');
  });

  it('prints nothing for a value that is not a date', () => {
    expect(formatDay('')).toBe('');
    expect(formatDay('2026-02-30T12:00:00Z', NOW)).toBe('');
  });
});

describe('formatAsOfDay', () => {
  it('says which New York day stale data was loaded, with the year once it differs', () => {
    // 11:02 PM on Nov 4 in New York.
    expect(formatAsOfDay('2026-11-05T04:02:00Z', NOW)).toBe('as of Nov 4');
    expect(formatAsOfDay('2025-12-31T17:00:00Z', NOW)).toBe('as of Dec 31, 2025');
  });

  it('says nothing without a load time it can read', () => {
    expect(formatAsOfDay(undefined, NOW)).toBe('');
    expect(formatAsOfDay('soon', NOW)).toBe('');
    expect(formatAsOfDay('2026-02-30T12:00:00Z', NOW)).toBe('');
  });
});

describe('formatRelative', () => {
  it('counts seconds, minutes and hours within a day', () => {
    expect(formatRelative(ago(30 * SECOND_MS), NOW)).toBe('just now');
    expect(formatRelative(ago(59 * MINUTE_MS), NOW)).toBe('59 min ago');
    expect(formatRelative(ago(HOUR_MS), NOW)).toBe('1 h ago');
    expect(formatRelative(ago(DAY_MS - MINUTE_MS), NOW)).toBe('23 h ago');
  });

  it('says hours, not yesterday, for last night when it is under a day ago', () => {
    // 11 PM in New York on Nov 4.
    expect(formatRelative('2026-11-05T04:00:00Z', NOW)).toBe('13 h ago');
  });

  it('says yesterday a day or more ago on the previous New York day', () => {
    expect(formatRelative(ago(DAY_MS), NOW)).toBe('yesterday');
  });

  it('counts New York calendar days, not 24-hour periods, past a day', () => {
    // 1 AM on Nov 5 in New York; 11 PM on Nov 3 is 26 h earlier but two calendar days back.
    const earlyMorning = Date.UTC(2026, 10, 5, 6, 0);
    expect(formatRelative('2026-11-04T04:00:00Z', earlyMorning)).toBe('2 d ago');
  });

  it('counts days up to 13, then prints the date, with the year when it differs', () => {
    expect(formatRelative(ago(13 * DAY_MS), NOW)).toBe('13 d ago');
    expect(formatRelative(ago(14 * DAY_MS), NOW)).toBe('Oct 22');
    expect(formatRelative('2025-10-01T16:00:00Z', NOW)).toBe('Oct 1, 2025');
  });

  it('counts whole days for a Sanity date, whatever the hour', () => {
    expect(formatRelative('2026-11-05', NOW)).toBe('today');
    expect(formatRelative('2026-11-04', NOW)).toBe('yesterday');
    expect(formatRelative('2026-11-02', NOW)).toBe('3 d ago');
    expect(formatRelative('2026-10-01', NOW)).toBe('Oct 1');
  });

  it('prints nothing for a future moment or a value that is not a date', () => {
    expect(formatRelative('2026-11-06', NOW)).toBe('');
    expect(formatRelative(new Date(NOW + 5 * MINUTE_MS).toISOString(), NOW)).toBe('');
    expect(formatRelative('not a date', NOW)).toBe('');
    expect(formatRelative('2026-02-30T12:00:00Z', NOW)).toBe('');
  });
});

describe('formatClockET', () => {
  it('prints the New York time with AM/PM and ET, in winter and in summer', () => {
    expect(formatClockET(Date.UTC(2026, 10, 5, 16, 2))).toBe('11:02 AM ET');
    expect(formatClockET(Date.UTC(2026, 6, 1, 19, 5))).toBe('3:05 PM ET');
  });

  it('prints a plain space where ICU puts a narrow no-break space, so server and browser match', () => {
    // Newer ICU versions put U+202F before 'AM'; whether one does depends on the runtime.
    const icuClock = `11:02${String.fromCodePoint(0x202f)}AM`;
    const prototype = Intl.DateTimeFormat.prototype as unknown as { format: unknown };
    const format = vi.spyOn(prototype, 'format', 'get').mockReturnValue(() => icuClock);
    try {
      expect(formatClockET(Date.UTC(2026, 10, 5, 16, 2))).toBe('11:02 AM ET');
    } finally {
      format.mockRestore();
    }
  });

  it('prints nothing for a value that is not a moment', () => {
    expect(formatClockET(Number.NaN)).toBe('');
  });
});

describe('lastDayOf', () => {
  it('is the one day of a single-day place', () => {
    expect(lastDayOf({ startDate: '2026-08-21' })).toBe('2026-08-21');
    expect(lastDayOf({ startDate: '2026-08-21', endDate: null })).toBe('2026-08-21');
  });

  // Corgi NYC's visits were Jul 29 and Sep 15, stored as one range.
  it('is the end of a range, whether or not that day has come', () => {
    expect(lastDayOf({ startDate: '2026-07-29', endDate: '2026-09-15' })).toBe('2026-09-15');
    expect(lastDayOf({ startDate: '2026-11-04', endDate: '2026-12-31' })).toBe('2026-12-31');
  });

  it('is the start when the end is before it (bad data) or the same day', () => {
    expect(lastDayOf({ startDate: '2026-10-20', endDate: '2026-10-02' })).toBe('2026-10-20');
    expect(lastDayOf({ startDate: '2026-10-20', endDate: '2026-10-20' })).toBe('2026-10-20');
  });

  it('compares and answers the date parts of timestamps', () => {
    expect(lastDayOf({ startDate: '2026-11-04T22:00:00Z', endDate: '2026-11-05T02:00:00Z' })).toBe(
      '2026-11-05',
    );
    expect(lastDayOf({ startDate: '2026-11-04T22:00:00Z', endDate: '2026-11-04T23:00:00Z' })).toBe(
      '2026-11-04',
    );
  });

  it('is null without a start date', () => {
    expect(lastDayOf({ startDate: null, endDate: '2026-10-01' })).toBe(null);
    expect(lastDayOf({ startDate: '' })).toBe(null);
    expect(lastDayOf({})).toBe(null);
  });
});

describe('formatDaySpan', () => {
  it('splits a range in this year into its first and last day, without the year', () => {
    expect(formatDaySpan({ startDate: '2026-07-29', endDate: '2026-09-15' }, NOW)).toEqual({
      start: 'Jul 29',
      end: 'Sep 15',
    });
  });

  it('names the month once for a range within one month, as /places does', () => {
    expect(formatDaySpan({ startDate: '2026-11-03', endDate: '2026-11-07' }, NOW)).toEqual({
      start: 'Nov 3',
      end: '7',
    });
    expect(formatDaySpan({ startDate: '2025-05-19', endDate: '2025-05-20' }, NOW)).toEqual({
      start: 'May 19',
      end: '20, 2025',
    });
  });

  it('prints the year once, at the end, for a range in another year than now', () => {
    expect(formatDaySpan({ startDate: '2025-07-29', endDate: '2025-09-15' }, NOW)).toEqual({
      start: 'Jul 29',
      end: 'Sep 15, 2025',
    });
  });

  it('prints both years for a range that crosses a year', () => {
    expect(formatDaySpan({ startDate: '2025-12-28', endDate: '2026-01-03' }, NOW)).toEqual({
      start: 'Dec 28, 2025',
      end: 'Jan 3, 2026',
    });
  });

  it('gives a single day no end, printed as formatDay does, as for an end not after the start', () => {
    expect(formatDaySpan({ startDate: '2026-10-30' }, NOW)).toEqual({ start: 'Oct 30' });
    expect(formatDaySpan({ startDate: '2025-10-30', endDate: null }, NOW)).toEqual({
      start: 'Oct 30, 2025',
    });
    expect(formatDaySpan({ startDate: '2026-10-30', endDate: '2026-10-30' }, NOW)).toEqual({
      start: 'Oct 30',
    });
    expect(formatDaySpan({ startDate: '2026-10-30', endDate: '2026-10-02' }, NOW)).toEqual({
      start: 'Oct 30',
    });
  });

  it('gives the start alone when the end is not a date, and null without a start', () => {
    expect(formatDaySpan({ startDate: '2026-10-30', endDate: '2026-02-30' }, NOW)).toEqual({
      start: 'Oct 30',
    });
    expect(formatDaySpan({ startDate: null, endDate: '2026-10-30' }, NOW)).toBe(null);
    expect(formatDaySpan({ startDate: 'soon' }, NOW)).toBe(null);
  });
});

describe('formatYear', () => {
  // 'since Jan 2023' became 'since 2023' on the roles tile: the month added nothing there.
  it('gives the year of a Sanity date as written, never the year before', () => {
    expect(formatYear('2023-01-01')).toBe('2023');
    expect(formatYear('2024-06')).toBe('2024');
  });

  it('gives the New York year of a timestamp, and nothing for what is not a date', () => {
    // 2:00 AM UTC on Jan 1 is still Dec 31 in New York.
    expect(formatYear('2026-01-01T02:00:00Z')).toBe('2025');
    expect(formatYear('2026-02-30')).toBe('');
    expect(formatYear('')).toBe('');
  });
});

describe('commitHeadline', () => {
  it.each([
    ['feat(home): the Live Console home bento (HOME) (#604)', 'The Live Console home bento (HOME)'],
    ['fix: last place by the last visit', 'Last place by the last visit'],
    ['refactor(api)!: drop the v0 routes', 'Drop the v0 routes'],
    [
      'chore(deps): update dependency @biomejs/biome to v2.6.6 (#605)',
      'Update dependency @biomejs/biome to v2.6.6',
    ],
  ])('reads %j as %j', (headline, shown) => {
    expect(commitHeadline(headline)).toBe(shown);
  });

  it('keeps a headline without a prefix as written, capitalised', () => {
    expect(commitHeadline('Merge branch main into feat/home')).toBe(
      'Merge branch main into feat/home',
    );
    expect(commitHeadline('add the Spotify tile')).toBe('Add the Spotify tile');
  });

  it('keeps a pull request number that is not at the end, and a headline that would be empty', () => {
    expect(commitHeadline('fix: (#12) regression in the rail')).toBe(
      '(#12) regression in the rail',
    );
    // A type with nothing after it is a type, not a word to capitalise.
    expect(commitHeadline('feat:')).toBe('feat:');
    expect(commitHeadline('fix(home)!:')).toBe('fix(home)!:');
    expect(commitHeadline('feat: (#12)')).toBe('feat: (#12)');
  });

  it.each([
    'feat',
    'fix',
    'chore',
    'docs',
    'refactor',
    'perf',
    'test',
    'tests',
    'build',
    'ci',
    'style',
    'revert',
    'wip',
    'deps',
  ])('strips the conventional type %j, with or without a scope and a !', (type) => {
    expect(commitHeadline(`${type}: tidy the rail`)).toBe('Tidy the rail');
    expect(commitHeadline(`${type}(home): tidy the rail`)).toBe('Tidy the rail');
    expect(commitHeadline(`${type}(home)!: tidy the rail`)).toBe('Tidy the rail');
    expect(commitHeadline(`${type}!: tidy the rail`)).toBe('Tidy the rail');
  });

  // Conventional Commits types are not case sensitive.
  it('strips a type written in capitals', () => {
    expect(commitHeadline('Fix: the rail')).toBe('The rail');
  });

  // Review findings WF-PRIV-3 and commit-headline-capitalise-mangles: any word and colon used to
  // count as a type, and the first letter was always upper-cased.
  it.each([
    ['https://example.com is down', 'https://example.com is down'],
    ['fix: https://example.com is down', 'https://example.com is down'],
    ['useEffect(fn): fix cleanup', 'useEffect(fn): fix cleanup'],
    ['README: fix typo', 'README: fix typo'],
    ['fix: iOS Safari scroll', 'iOS Safari scroll'],
    ['fix(ios): iOS safe-area inset (#611)', 'iOS safe-area inset'],
    ['docs: macOS setup', 'macOS setup'],
    ['feat: iPhone layout', 'iPhone layout'],
    ['feat: eBay listings', 'eBay listings'],
    ['chore: npm audit fix', 'npm audit fix'],
    ['fix(scope): npm audit', 'npm audit'],
    ['chore: pnpm dedupe', 'pnpm dedupe'],
    ['chore: bun update', 'bun update'],
    ['chore: yarn install', 'yarn install'],
    ['chore: git hooks', 'git hooks'],
    ['chore: eslint rules', 'eslint rules'],
    ['build: vite 7', 'vite 7'],
    ['ci build failures on master', 'ci build failures on master'],
  ])(
    'reads %j as %j: only a known type is stripped, and no name is re-cased',
    (headline, shown) => {
      expect(commitHeadline(headline)).toBe(shown);
    },
  );

  it('needs a space after the colon, so a word glued to a colon is not a type', () => {
    expect(commitHeadline('fix:the rail')).toBe('fix:the rail');
    // Not a known type, so nothing is stripped; its letters, before the colon, are a plain
    // lower-case word, so it is capitalised like any first word.
    expect(commitHeadline('feature: the rail')).toBe('Feature: the rail');
  });

  it('upper-cases only a first word of lower-case ASCII letters', () => {
    expect(commitHeadline('feat: add the Spotify tile')).toBe('Add the Spotify tile');
    expect(commitHeadline('feat: v2 of the rail')).toBe('v2 of the rail');
    expect(commitHeadline('feat: react-query 5')).toBe('react-query 5');
    expect(commitHeadline('feat: été')).toBe('été');
    expect(commitHeadline('feat: 🎉 launch')).toBe('🎉 launch');
  });

  // Review finding WF2-D3-first-word-punct: the first word was everything up to a space, so its
  // trailing comma, period or apostrophe kept a plain word lower-case ('fix, just had…').
  it.each([
    ['fix(stripe): fix, just had to reset cache', 'Fix, just had to reset cache'],
    ["fix: don't show a place before noon", "Don't show a place before noon"],
    ['fix: it’s the rail', 'It’s the rail'],
    ['feat: add.', 'Add.'],
    ['feat: done; tidy up', 'Done; tidy up'],
    ['fix: why? the rail', 'Why? the rail'],
    ['feat: wait!', 'Wait!'],
    ["fix: don't, ever", "Don't, ever"],
  ])(
    'reads %j as %j: a plain word before its trailing punctuation or contraction',
    (headline, shown) => {
      expect(commitHeadline(headline)).toBe(shown);
    },
  );

  it.each([
    ['chore: npm, bump the lockfile', 'npm, bump the lockfile'],
    ["chore: npm's cache", "npm's cache"],
    ['chore: follow-ups from the dependency batch (#568)', 'follow-ups from the dependency batch'],
    ['fix: iOS, the safe area', 'iOS, the safe area'],
    ['fix: v2, again', 'v2, again'],
    ['docs: https://example.com, the docs', 'https://example.com, the docs'],
    ['docs: example.com is down', 'example.com is down'],
    ["fix: rock'n'roll mode", "rock'n'roll mode"],
    ['fix: e.g. the rail', 'e.g. the rail'],
  ])(
    'reads %j as %j: names, inner capitals, digits, hyphens and URLs stay as written',
    (headline, shown) => {
      expect(commitHeadline(headline)).toBe(shown);
    },
  );
});

describe('companyName', () => {
  it.each([
    ['ResQ Systems, Inc.', 'ResQ Systems'],
    ['ResQ Systems Inc.', 'ResQ Systems'],
    ['ResQ Systems, Inc', 'ResQ Systems'],
    ['Acme, LLC', 'Acme'],
    ['  Elysium  ', 'Elysium'],
    ['Farmingdale State College', 'Farmingdale State College'],
  ])('says %j as %j', (company, name) => {
    expect(companyName(company)).toBe(name);
  });

  it('keeps a name that is only a legal form, and an Inc inside a name', () => {
    expect(companyName('Inc.')).toBe('Inc.');
    expect(companyName('Incubator Labs')).toBe('Incubator Labs');
  });
});

describe('splitTitle', () => {
  it.each([
    [
      'Fraud Guard - AI-Powered Transaction Monitoring',
      'Fraud Guard',
      'AI-Powered Transaction Monitoring',
    ],
    [
      'Fraud Guard — AI-Powered Transaction Monitoring',
      'Fraud Guard',
      'AI-Powered Transaction Monitoring',
    ],
    [
      'Fraud Guard – AI-Powered Transaction Monitoring',
      'Fraud Guard',
      'AI-Powered Transaction Monitoring',
    ],
    ['grepo: search your GitHub stars', 'grepo', 'search your GitHub stars'],
  ])('splits %j at its first separator', (full, title, subtitle) => {
    expect(splitTitle(full)).toEqual({ title, subtitle });
  });

  it('splits at the first separator only, keeping the description as written', () => {
    expect(splitTitle('Atlas: maps - and more')).toEqual({
      title: 'Atlas',
      subtitle: 'maps - and more',
    });
  });

  it('keeps a title with no separator whole: a hyphen in a word or a colon in a time is none', () => {
    expect(splitTitle('AI-Powered Fraud Guard')).toEqual({
      title: 'AI-Powered Fraud Guard',
      subtitle: '',
    });
    expect(splitTitle('Standup at 10:30')).toEqual({ title: 'Standup at 10:30', subtitle: '' });
    expect(splitTitle('  grepo  ')).toEqual({ title: 'grepo', subtitle: '' });
  });
});

describe('firstSentence', () => {
  it.each([
    [
      'its one sentence, as written',
      'Open-source command-line tool (@elysiumoss/grepo) that writes READMEs and repo descriptions with AI (TypeScript, Gemini).',
      'Open-source command-line tool (@elysiumoss/grepo) that writes READMEs and repo descriptions with AI (TypeScript, Gemini).',
    ],
    [
      'the first of two sentences',
      'Trained a classifier on 7,023 MRI scans. Benchmarked it against a 3D U-Net.',
      'Trained a classifier on 7,023 MRI scans.',
    ],
    [
      'a question or an exclamation as the first sentence',
      'Ever lost a receipt? Never again!',
      'Ever lost a receipt?',
    ],
    ['the first line', 'A first line\nand a second.', 'A first line'],
    [
      'the first line with words',
      '\n\n  A line after blank ones.  \nMore.',
      'A line after blank ones.',
    ],
    ['a sentence with no stop', 'A tool for maps', 'A tool for maps'],
  ])('is %s', (_case, text, sentence) => {
    expect(firstSentence(text)).toBe(sentence);
  });

  // Dots inside a word, a version, a domain or a URL end no sentence: only one before a space.
  it('keeps Node.js, v2.0, elysium.tools and a URL inside the sentence', () => {
    expect(
      firstSentence(
        'Built on Node.js and v2.0 of its API, at elysium.tools (https://elysium.tools/docs). Then more.',
      ),
    ).toBe('Built on Node.js and v2.0 of its API, at elysium.tools (https://elysium.tools/docs).');
  });

  // Review finding F8: an abbreviation's dot is no sentence end, or the one description line
  // would read 'Built for the U.S.' or 'Tools, e.g.'.
  it.each([
    [
      'U.S.',
      'Built for the U.S. market with Next.js. Then more.',
      'Built for the U.S. market with Next.js.',
    ],
    ['e.g.', 'Tools, e.g. scrapers and CLIs. More.', 'Tools, e.g. scrapers and CLIs.'],
    ['i.e.', 'One store, i.e. Postgres. More.', 'One store, i.e. Postgres.'],
    ['vs.', 'React vs. Vue, measured. More.', 'React vs. Vue, measured.'],
    // CodeRabbit on #612: an opening quote or bracket before the abbreviation.
    [
      '“U.S.” in quotes',
      'Built for the “U.S.” market. Supports regional deployments.',
      'Built for the “U.S.” market.',
    ],
    ['"e.g." in straight quotes', 'Tools ("e.g." CLIs) ship. More.', 'Tools ("e.g." CLIs) ship.'],
    [
      '(i.e.) in brackets',
      'One store [i.e. Postgres] only. More.',
      'One store [i.e. Postgres] only.',
    ],
  ])('reads past %s', (_abbreviation, text, sentence) => {
    expect(firstSentence(text)).toBe(sentence);
  });

  it.each([[''], ['   '], ['\n \n']])('is empty for %j', (text) => {
    expect(firstSentence(text)).toBe('');
  });
});
