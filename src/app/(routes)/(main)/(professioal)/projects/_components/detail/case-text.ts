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
 * @file The words of a project page (the case study), pure and server-safe. Everything here is
 * read from what Studio holds; nothing is written for the owner:
 * - the title split into its name and subtitle ('SparkMind' / 'AI-Driven Personalized Learning
 *   Hub'), with the name's widest word for the display size's fit;
 * - When ('Jun – Sep 2024') and Length ('3 months', '2 days') from the dates as written, read by
 *   their calendar day, never through a time zone;
 * - the status in sentence case, with the ongoing dot only for work in progress;
 * - the live site's host and the links, kept only when they are real web addresses (the one rule
 *   in _lib/project-links.ts, re-exported here), and the address cut where it may wrap (after a
 *   dot or a slash), as are long addresses and paths inside Studio's prose, each kept as one run
 *   so the page can keep it whole whenever it fits a line;
 * - the breadcrumb's step: 'Featured' (to the project's own story) for a Featured project, else
 *   its year;
 * - the long description as paragraphs, or as a list when Studio wrote it as bullets.
 */

import { chapterId, shortName, widestWordUnits } from '@/components/console/folio';
import type { StatusTone } from '@/components/console/status-dot';
import { FEATURED_GROUP, groupLabel } from '../../_lib/project-order';
// What an ongoing range ends with ('Apr 2026 – now'): /projects' own word, so the two never differ.
import { PRESENT_LABEL } from '../../_lib/project-words';
import { webUrl } from './safe-href';

export { safeHref } from './safe-href';

/** The name, set at display size, and the subtitle under it ('' when the title has none). */
export interface CaseTitle {
  readonly name: string;
  readonly subtitle: string;
  /** The name's widest word in word-measure units, for --folio-fit. */
  readonly fit: number;
}

/** A project's status as shown: sentence-case words, and a tone only for work in progress. */
export interface CaseStatus {
  readonly text: string;
  readonly tone?: StatusTone;
}

/** The long description: paragraphs, or the bullet list Studio wrote. */
export interface CaseBody {
  readonly kind: 'paragraphs' | 'list';
  readonly items: readonly string[];
}

/** A paragraph's first sentence, set larger, and the rest of it. */
export interface LeadSplit {
  readonly lead: string;
  readonly rest: string;
}

/** The breadcrumb's second step: what it says and where on /projects it leads. */
export interface CaseCrumb {
  /** 'Featured' or the year, '2024'. */
  readonly label: string;
  /** '/projects#story-proj-grepo' (a Featured project's own story), '/projects#y2024'. */
  readonly href: string;
}

/**
 * A run of Studio's prose as the page sets it: plain words (a string), or one long address or
 * path cut after its dots and slashes (its parts, in order), which the page keeps whole whenever
 * it fits a line and lets wrap at those cuts only when it is wider than the line.
 */
export type ProseRun = string | readonly string[];

/** A calendar day as Studio wrote it. */
export interface CalendarDay {
  readonly year: number;
  /** 0 to 11. */
  readonly month: number;
  /** Days since the epoch, in UTC. */
  readonly day: number;
}

const RANGE_SEPARATOR = ' – ';
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const DAY_MS = 86_400_000;
/** The mean month, so Jun 12 to Sep 10 reads '3 months'. */
const DAYS_PER_MONTH = 30.44;
const MONTHS_PER_YEAR = 12;
/** Up to this many days a length is counted in days ('2 days'), as a hackathon is. */
const MAX_DAYS = 31;

/** A Sanity date's leading calendar day: '2024-06-12', '2024-06-12T00:00:00Z'. */
const SANITY_DAY = /^(\d{4})-(\d{2})-(\d{2})(?!\d)/u;
/** What may sit between a short name and its subtitle: a dash, colon or bar and its spaces. */
const SUBTITLE_LEAD = /^\s*[-–—|:]?\s*/u;
/** A subtitle wholly in brackets: '(CNN/U-Net)'. */
const BRACKETED = /^[([](.*)[)\]]$/u;
/** A line Studio wrote as a bullet: '• Built …', '- Built …', '* Built …'. */
const BULLET = /^[•\-*–]\s+/u;
/** Work still going on, which earns the ongoing dot. */
const ONGOING = /\b(?:in progress|ongoing|building|wip)\b/iu;
/**
 * A word in title case ('Active', '(Research', 'Phase)'), which sentence case lowers; 'API',
 * 'iOS' and 'MVP' stay.
 */
const TITLE_CASE_WORD = /^[([{"'“]?\p{Lu}\p{Ll}+[)\]}"'”.,;:!?]*$/u;
/** A paragraph's first sentence: up to a stop followed by a capital, a figure or a quote. */
const FIRST_SENTENCE = /^(.+?[.!?])\s+(?=[\p{Lu}\p{Nd}"'“(])/u;
/** The longest first sentence still set as a lead; a longer one reads as a block. */
const MAX_LEAD_LENGTH = 220;
/** The places an address or code name may wrap: just after a dot, a slash or an underscore. */
const AFTER_DOT_OR_SLASH = /(?<=[./_])/u;
/** From this many characters a word with a dot or slash inside is read as an address or a path. */
const LONG_WORD = 13;
/**
 * A long address or path in prose, captured: a whole word (between spaces or the ends) of
 * LONG_WORD characters or more with a dot or slash inside it, not only at its end.
 */
const LONG_ADDRESS = new RegExp(String.raw`(?<!\S)((?=\S*[./]\S)\S{${LONG_WORD},})(?!\S)`, 'u');
/**
 * A Featured project's story on /projects: its id there is story-<id> (storyAnchor in
 * ../story-parts.tsx), with a scroll margin that clears the pinned filter bar.
 */
const STORY_ANCHOR = 'story-';

const tidy = (text: string | null | undefined): string => (text ?? '').replace(/\s+/gu, ' ').trim();

/** The title as a name and a subtitle: 'Brain Tumor … (CNN/U-Net)' is '…' / 'CNN/U-Net'. */
export function caseTitle(title: string): CaseTitle {
  const whole = tidy(title);
  const name = shortName(whole);
  const after = whole.startsWith(name) ? whole.slice(name.length) : '';
  const trimmed = after.replace(SUBTITLE_LEAD, '').trim();
  const subtitle = (BRACKETED.exec(trimmed)?.[1] ?? trimmed).trim();
  return { name, subtitle, fit: widestWordUnits(name) };
}

/** A Sanity date as its calendar day, or null when it is missing or not a real date. */
export function calendarDay(value: string | null | undefined): CalendarDay | null {
  const match = SANITY_DAY.exec(tidy(value));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const date = Number(match[3]);
  const time = Date.UTC(year, month, date);
  const check = new Date(time);
  if (check.getUTCMonth() !== month || check.getUTCDate() !== date) return null;
  return { year, month, day: Math.round(time / DAY_MS) };
}

/** 'Jun 2024'. */
export const monthLabel = ({ year, month }: CalendarDay): string => `${MONTHS[month]} ${year}`;

/**
 * When the work ran, by month: 'Sep 2024' within a month, 'Jun – Sep 2024' within a year, 'Mar
 * 2025 – Jul 2026' across years, 'Nov 2024 – now' while it goes on. Null without a start.
 */
export function whenText(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  ongoing: boolean,
): string | null {
  const start = calendarDay(startDate);
  if (!start) return null;
  const end = calendarDay(endDate);
  if (!end || end.day < start.day) {
    return ongoing ? `${monthLabel(start)}${RANGE_SEPARATOR}${PRESENT_LABEL}` : monthLabel(start);
  }
  if (end.year !== start.year) return `${monthLabel(start)}${RANGE_SEPARATOR}${monthLabel(end)}`;
  if (end.month === start.month) return monthLabel(start);
  return `${MONTHS[start.month]}${RANGE_SEPARATOR}${monthLabel(end)}`;
}

const plural = (count: number, one: string): string => `${count} ${one}${count === 1 ? '' : 's'}`;

/**
 * How long it took, both days counted: '1 day', '2 days' up to a month, then '3 months', then
 * '1 year 5 months'. Null without both dates, or when the end comes first.
 */
export function lengthText(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string | null {
  const start = calendarDay(startDate);
  const end = calendarDay(endDate);
  if (!start || !end || end.day < start.day) return null;
  const days = end.day - start.day + 1;
  if (days <= MAX_DAYS) return plural(days, 'day');
  const months = Math.max(1, Math.round(days / DAYS_PER_MONTH));
  if (months < MONTHS_PER_YEAR) return plural(months, 'month');
  const years = Math.floor(months / MONTHS_PER_YEAR);
  const rest = months % MONTHS_PER_YEAR;
  return rest === 0 ? plural(years, 'year') : `${plural(years, 'year')} ${plural(rest, 'month')}`;
}

/** Whether the status says the work is still going on. */
export const isOngoing = (status: string): boolean => ONGOING.test(status);

/**
 * The status in sentence case ('Completed / active maintenance', 'In progress'), with the ongoing
 * tone for work in progress. Words in capitals ('MVP') keep them. Null when it is blank.
 */
export function caseStatus(status: string): CaseStatus | null {
  const words = tidy(status).split(' ');
  const text = words
    .map((word, index) => (index > 0 && TITLE_CASE_WORD.test(word) ? word.toLowerCase() : word))
    .join(' ');
  if (text === '') return null;
  const sentence = `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
  return isOngoing(sentence) ? { text: sentence, tone: 'ongoing' } : { text: sentence };
}

/** A live site's address as shown: 'sparkmind.vercel.app', without 'www.'. */
export function siteHost(value: string | null | undefined): string | null {
  const url = webUrl(value);
  return url ? url.hostname.replace(/^www\./u, '') : null;
}

/**
 * An address cut after each dot, slash or underscore, the only places it may wrap (the page sets a <wbr>
 * between the parts), so enlarged text never breaks 'vercel' or 'mikeodnis' mid-word:
 * 'sparkmind.vercel.app' is 'sparkmind.' / 'vercel.' / 'app'.
 */
export const addressParts = (address: string): string[] =>
  address.split(AFTER_DOT_OR_SLASH).filter((part) => part !== '');

/**
 * Studio's prose as runs: plain words, and each long address or path in it (a word of LONG_WORD
 * characters or more with a dot or slash inside: '(@elysiumoss/grepo)', 'links.example.dev') as
 * its own run, cut after each dot, slash or underscore. The page keeps such a run whole on the next line
 * when it fits one, and only a run wider than the line wraps at its cuts, so enlarged text on a
 * phone never pushes it past the column and a desktop never ends a line on 'links.'. Short words
 * ('Next.js') stay in the plain words. Joined, the runs are the text.
 */
export function proseRuns(text: string): ProseRun[] {
  // Split on a capturing pattern: the captured addresses land at the odd places.
  return text
    .split(LONG_ADDRESS)
    .map((piece, index): ProseRun => (index % 2 === 1 ? addressParts(piece) : piece))
    .filter((run) => run !== '');
}

/**
 * The breadcrumb's second step, where the project sits on /projects: 'Featured' for a project in
 * the Featured chapter (it is listed there, not under its year), leading to its own story there,
 * else the year it started, leading to that year's chapter; null for an undated project that is
 * not Featured.
 */
export function caseCrumb(
  id: string,
  startDate: string | null | undefined,
  featured: boolean,
): CaseCrumb | null {
  if (featured) {
    return {
      label: groupLabel(FEATURED_GROUP),
      href: `/projects#${STORY_ANCHOR}${encodeURIComponent(id)}`,
    };
  }
  const year = calendarDay(startDate)?.year;
  return year === undefined ? null : { label: String(year), href: `/projects#${chapterId(year)}` };
}

/** The long description's lines, without blanks. */
const linesOf = (text: string | null | undefined): string[] =>
  (text ?? '')
    .split(/\r?\n/u)
    .map((line) => tidy(line))
    .filter((line) => line !== '');

/**
 * The long description as Studio wrote it: a list when every line is a bullet, else paragraphs
 * (one per line). Null when there is none.
 */
export function caseBody(text: string | null | undefined): CaseBody | null {
  const lines = linesOf(text);
  if (lines.length === 0) return null;
  if (lines.every((line) => BULLET.test(line))) {
    return { kind: 'list', items: lines.map((line) => line.replace(BULLET, '').trim()) };
  }
  return { kind: 'paragraphs', items: lines };
}

/**
 * A paragraph's first sentence, set as its lead, and the rest. Null when the paragraph is one
 * sentence, or its first sentence is too long to read as a lead.
 */
export function leadSplit(paragraph: string): LeadSplit | null {
  const lead = FIRST_SENTENCE.exec(paragraph)?.[1]?.trim() ?? '';
  if (lead === '' || lead.length > MAX_LEAD_LENGTH) return null;
  const rest = paragraph.slice(lead.length).trim();
  return rest === '' ? null : { lead, rest };
}
