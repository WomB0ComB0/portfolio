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
 * @file How /projects reads a project's free-text words, pure and server-safe:
 * - the title and a one-line summary ("Fraud Guard - AI-Powered …" is the title "Fraud Guard");
 * - the kinds in a category, split on the spaced slash only, so "AI/ML / Full-Stack" is two
 *   kinds and AI/ML stays whole, with a trailing qualifier in brackets dropped;
 * - kind slugs and technology keys, which fold spellings of one technology together (React,
 *   React.js, ReactJS, React 19) while keeping C, C++ and C# apart;
 * - the start month in UTC, the detail href and the countable noun.
 */

/** "Name - what it is": a spaced hyphen, en dash or em dash. */
const TITLE_SPLIT = /\s+[-–—]\s+/u;
const FIRST_SENTENCE = /^(.+?[.!?])(?:\s|$)/u;
/** A slash with a space before it and after it (or an end): never the slash inside AI/ML. */
const KIND_SPLIT = /(?:^|\s)\/(?=\s|$)/u;
/*
 * The two trailing patterns read text from a URL as well as from Sanity, so each starts with one
 * fixed token (a bracket, one whitespace character), never a quantified run, and runs on text
 * already trimmed at its end: linear on any input. Their old leading \s* and \s+ backtracked
 * quadratically over a long run of interior spaces (about 0.2 s for 14,000 of them).
 */
/** "Web Development (Elysium Freelance)": the qualifier in brackets at the end (trimmed text). */
const TRAILING_QUALIFIER = /\([^()]*\)$/u;
/** "Python 3.12", "Next.js 15", "Vue 3": a version number at the end, after a space (trimmed text). */
const TRAILING_VERSION = /\sv?\d+(?:\.\d+)*$/u;
const SANITY_DATE = /^(\d{4})-(\d{2})-\d{2}/u;

/**
 * Spellings the live projects use for one technology, by the key techKey() otherwise gives
 * them (from a GET snapshot of /api/v1/sanity/projects; React.js-style ones for old links).
 */
export const TECH_ALIASES: Readonly<Record<string, string>> = {
  reactjs: 'react',
  vuejs: 'vue',
  nodejs: 'node',
  elysiajs: 'elysia',
  sentrysdk: 'sentry',
  clerkauth: 'clerk',
  googlegemini: 'gemini',
  googlegeminiapi: 'gemini',
  googlegeminillm: 'gemini',
};

export const PROJECT_NOUN = { one: 'project', many: 'projects' } as const;

/** A project's start month, for the Started column: "Mar", with its year beside it. */
export interface ProjectMonth {
  /** "2024-03", for <time dateTime>. */
  readonly iso: string;
  /** "Mar". */
  readonly name: string;
  readonly year: string;
}

export interface TitleParts {
  readonly title: string;
  readonly summary: string;
}

const MONTH_NAME = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

const collapse = (text: string): string => text.replaceAll(/\s+/gu, ' ').trim();

/**
 * The title before a spaced dash, and a summary: the rest of the title, else the description's
 * first sentence, else the whole description.
 */
export function splitTitle(title: string, description: string): TitleParts {
  const [head = '', ...rest] = title.split(TITLE_SPLIT);
  const fromTitle = rest.map((part) => part.trim()).join(' – ');
  const text = collapse(description);
  return {
    title: head.trim() || title.trim(),
    summary: fromTitle || FIRST_SENTENCE.exec(text)?.[1] || text,
  };
}

/** A kind's slug: lower case, accents dropped, each run of other characters one hyphen. */
export const kindSlug = (label: string): string =>
  label
    .normalize('NFKD')
    .replaceAll(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-+|-+$/gu, '');

/**
 * The kinds a free-text category names, in order: split on the spaced slash, each without a
 * trailing qualifier in brackets; blanks and repeats (by slug) dropped.
 */
export function kindsOf(category: string): string[] {
  const kinds: string[] = [];
  const slugs = new Set<string>();
  for (const part of category.split(KIND_SPLIT)) {
    const label = collapse(part.trimEnd().replace(TRAILING_QUALIFIER, ''));
    const slug = kindSlug(label);
    if (slug !== '' && !slugs.has(slug)) {
      slugs.add(slug);
      kinds.push(label);
    }
  }
  return kinds;
}

/**
 * A technology's key: without a trailing qualifier or version (unless that leaves nothing),
 * lower case, '++' as 'pp', '#' as 'sharp' and a leading '.' as 'dot' (so C, C++, C# and .NET
 * stay apart), every other non-alphanumeric dropped, then TECH_ALIASES.
 */
export function techKey(raw: string): string {
  const bare = raw
    .trimEnd()
    .replace(TRAILING_QUALIFIER, '')
    .trimEnd()
    .replace(TRAILING_VERSION, '')
    .trim();
  const key = (bare || raw.trim())
    .toLowerCase()
    .replaceAll('++', 'pp')
    .replaceAll('#', 'sharp')
    .replace(/^\./u, 'dot')
    .replaceAll(/[^a-z0-9]/gu, '');
  return Object.hasOwn(TECH_ALIASES, key) ? (TECH_ALIASES[key] ?? key) : key;
}

/** A Sanity date's month in UTC, or null without a date or with a malformed one. */
export function startedOf(date: string | null | undefined): ProjectMonth | null {
  const match = SANITY_DATE.exec(date ?? '');
  if (!match) return null;
  const [, year = '', month = ''] = match;
  const index = Number(month) - 1;
  if (index < 0 || index > 11) return null;
  return {
    iso: `${year}-${month}`,
    name: MONTH_NAME.format(new Date(Date.UTC(Number(year), index, 1))),
    year,
  };
}

/** The detail page of a project, by the Sanity id it reads. */
export const projectHref = (id: string): string => `/projects/${encodeURIComponent(id)}`;

/** "1 project", "12 projects". */
export const projectCount = (count: number): string =>
  `${count} ${count === 1 ? PROJECT_NOUN.one : PROJECT_NOUN.many}`;
