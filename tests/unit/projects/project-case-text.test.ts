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
 * @file The project page's words (case-text.ts): the title's name and subtitle, When and Length
 * from the dates as written (an ongoing range ends 'now', as /projects writes it), the status in
 * sentence case, real web addresses only (safe-href.ts, re-exported) and where an address may
 * wrap, the breadcrumb's step (Featured or the year), and the long description as Studio wrote
 * it. Nothing is invented: a missing date or text gives null.
 */

import { describe, expect, it } from 'vitest';
import {
  addressParts,
  calendarDay,
  caseBody,
  caseCrumb,
  caseStatus,
  caseTitle,
  leadSplit,
  lengthText,
  proseRuns,
  safeHref,
  siteHost,
  whenText,
} from '@/app/(routes)/(main)/(professioal)/projects/_components/detail/case-text';
import { safeHref as pageSafeHref } from '@/app/(routes)/(main)/(professioal)/projects/_components/detail/safe-href';
import { safeHref as listSafeHref } from '@/app/(routes)/(main)/(professioal)/projects/_lib/project-links';

describe('caseTitle', () => {
  it.each([
    ['SparkMind - AI-Driven Learning Hub', 'SparkMind', 'AI-Driven Learning Hub'],
    ['example.dev – Personal Portfolio', 'example.dev', 'Personal Portfolio'],
    [
      'Tumor Segmentation & Classification (CNN/U-Net)',
      'Tumor Segmentation & Classification',
      'CNN/U-Net',
    ],
    ['Data Pipeline (Browser-Use)', 'Data Pipeline', 'Browser-Use'],
    ['AI-BITS - AI Search and RAG Tool', 'AI-BITS', 'AI Search and RAG Tool'],
    ["RamHacks '25 Website", "RamHacks '25 Website", ''],
    ['  grepo  ', 'grepo', ''],
  ])('splits %j into its name and subtitle', (title, name, subtitle) => {
    expect(caseTitle(title)).toMatchObject({ name, subtitle });
  });

  it("measures the name's widest word, so the display size fits it", () => {
    expect(caseTitle('Tumor Segmentation & Classification').fit).toBeGreaterThan(
      caseTitle('grepo').fit,
    );
  });
});

describe('calendarDay', () => {
  it('reads the day as written, whatever the time zone', () => {
    expect(calendarDay('2024-01-01')).toMatchObject({ year: 2024, month: 0 });
    expect(calendarDay('2024-12-31T23:30:00-05:00')).toMatchObject({ year: 2024, month: 11 });
  });

  it.each([null, undefined, '', 'soon', '2024-13-01', '2024-02-30'])('rejects %j', (value) => {
    expect(calendarDay(value)).toBeNull();
  });
});

describe('whenText', () => {
  it.each([
    ['2024-06-12', '2024-09-10', false, 'Jun – Sep 2024'],
    ['2024-09-14', '2024-09-15', false, 'Sep 2024'],
    ['2025-03-07', '2026-07-29', false, 'Mar 2025 – Jul 2026'],
    ['2024-11-15', null, true, 'Nov 2024 – now'],
    ['2026-04-27', null, false, 'Apr 2026'],
    ['2024-05-01', '2024-04-01', false, 'May 2024'],
  ])('writes %s to %s (ongoing %s) as %j', (start, end, ongoing, expected) => {
    expect(whenText(start, end, ongoing)).toBe(expected);
  });

  it('is null without a start date', () => {
    expect(whenText(null, '2024-01-01', false)).toBeNull();
  });
});

describe('lengthText', () => {
  it.each([
    ['2024-09-14', '2024-09-14', '1 day'],
    ['2024-09-14', '2024-09-15', '2 days'],
    ['2024-06-12', '2024-09-10', '3 months'],
    ['2024-09-01', '2025-04-09', '7 months'],
    ['2025-03-07', '2026-07-29', '1 year 5 months'],
    ['2023-01-01', '2024-12-31', '2 years'],
  ])('counts %s to %s as %j', (start, end, expected) => {
    expect(lengthText(start, end)).toBe(expected);
  });

  it('is null without both dates, or when the end comes first', () => {
    expect(lengthText('2024-01-01', null)).toBeNull();
    expect(lengthText(null, '2024-01-01')).toBeNull();
    expect(lengthText('2024-05-01', '2024-04-01')).toBeNull();
  });
});

describe('caseStatus', () => {
  it.each([
    ['In Progress', 'In progress', 'ongoing'],
    ['Completed / Active Maintenance', 'Completed / active maintenance', undefined],
    ['Completed (Research Phase)', 'Completed (research phase)', undefined],
    ['Completed / Live', 'Completed / live', undefined],
    ['MVP shipped', 'MVP shipped', undefined],
  ])('writes %j in sentence case', (status, text, tone) => {
    expect(caseStatus(status)).toEqual(tone ? { text, tone } : { text });
  });

  it('is null for a blank status', () => {
    expect(caseStatus('   ')).toBeNull();
  });
});

describe('links', () => {
  it('names a live site by its host, without www', () => {
    expect(siteHost('https://www.example.org')).toBe('example.org');
    expect(siteHost('https://app.example.dev/')).toBe('app.example.dev');
  });

  it('keeps only real web addresses', () => {
    expect(safeHref('https://github.com/example/grepo')).toBe('https://github.com/example/grepo');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('not a url')).toBeNull();
    expect(safeHref(null)).toBeNull();
    expect(siteHost('mailto:someone@example.com')).toBeNull();
  });

  it('is the one rule /projects uses, so the list and the page never disagree', () => {
    expect(safeHref).toBe(listSafeHref);
    expect(pageSafeHref).toBe(listSafeHref);
    expect(safeHref('  https://example.org/a  ')).toBe('https://example.org/a');
    expect(safeHref('ftp://example.org/file')).toBeNull();
  });

  it('cuts an address after each dot or slash, the only places it may wrap', () => {
    expect(addressParts('sparkmind.vercel.app')).toEqual(['sparkmind.', 'vercel.', 'app']);
    expect(addressParts('links.example.dev')).toEqual(['links.', 'example.', 'dev']);
    expect(addressParts('example.org/docs')).toEqual(['example.', 'org/', 'docs']);
    expect(addressParts('localhost')).toEqual(['localhost']);
    expect(addressParts('sparkmind.vercel.app').join('')).toBe('sparkmind.vercel.app');
  });
});

describe('proseRuns', () => {
  it('keeps each long address or path in prose as one run, cut after its dots and slashes', () => {
    const text = 'Built grepo (@elysiumoss/grepo on npm) behind links.example.dev today.';

    expect(proseRuns(text)).toEqual([
      'Built grepo ',
      ['(@elysiumoss/', 'grepo'],
      ' on npm) behind ',
      ['links.', 'example.', 'dev'],
      ' today.',
    ]);
  });

  it('reads as the text when its runs are joined', () => {
    const text = 'The frontend is Next.js/Tailwind/TypeScript, served from links.example.dev';

    expect(proseRuns(text).flat().join('')).toBe(text);
    expect(proseRuns(text).at(-1)).toEqual(['links.', 'example.', 'dev']);
  });

  it('keeps short names, sentence ends and plain words in the words', () => {
    expect(proseRuns('Built with Next.js and Node.js. It ships.')).toEqual([
      'Built with Next.js and Node.js. It ships.',
    ]);
    expect(proseRuns('An unbreakable-looking-word stays put.')).toEqual([
      'An unbreakable-looking-word stays put.',
    ]);
    expect(proseRuns('')).toEqual([]);
  });

  it('gives a name that is only an address one run', () => {
    expect(proseRuns('@ducanh2912/next-pwa')).toEqual([['@ducanh2912/', 'next-pwa']]);
  });
});

describe('caseCrumb', () => {
  it('leads a Featured project to its own story in the Featured chapter, where /projects lists it', () => {
    expect(caseCrumb('proj-grepo', '2026-04-01', true)).toEqual({
      label: 'Featured',
      href: '/projects#story-proj-grepo',
    });
    expect(caseCrumb('LMgGoXAr6ytk3EPuOaTy9m', null, true)).toEqual({
      label: 'Featured',
      href: '/projects#story-LMgGoXAr6ytk3EPuOaTy9m',
    });
  });

  it('writes an id that is not a plain word as a safe address fragment', () => {
    expect(caseCrumb('a b#c', null, true)?.href).toBe('/projects#story-a%20b%23c');
  });

  it('leads any other project to the year it started', () => {
    expect(caseCrumb('proj-x', '2024-06-12', false)).toEqual({
      label: '2024',
      href: '/projects#y2024',
    });
  });

  it('has no step for an undated project that is not Featured', () => {
    expect(caseCrumb('proj-x', null, false)).toBeNull();
    expect(caseCrumb('proj-x', 'soon', false)).toBeNull();
  });
});

describe('caseBody', () => {
  it('reads bullet lines as the list Studio wrote', () => {
    expect(caseBody('• Built the API\n• Added bulk filing\n')).toEqual({
      kind: 'list',
      items: ['Built the API', 'Added bulk filing'],
    });
  });

  it('reads other text as paragraphs, one per line', () => {
    expect(caseBody('First line.\n\nSecond   line.')).toEqual({
      kind: 'paragraphs',
      items: ['First line.', 'Second line.'],
    });
  });

  it('is null without text', () => {
    expect(caseBody(null)).toBeNull();
    expect(caseBody(' \n ')).toBeNull();
  });
});

describe('leadSplit', () => {
  it("sets a paragraph's first sentence as its lead", () => {
    expect(leadSplit('Team submission for a contest. My role covered the scraper.')).toEqual({
      lead: 'Team submission for a contest.',
      rest: 'My role covered the scraper.',
    });
  });

  it('never splits inside a name such as Next.js', () => {
    expect(leadSplit('Built with Next.js and Supabase. It ships.')).toEqual({
      lead: 'Built with Next.js and Supabase.',
      rest: 'It ships.',
    });
  });

  it('leaves a one-sentence paragraph, or a very long first sentence, whole', () => {
    expect(leadSplit('One sentence only.')).toBeNull();
    expect(leadSplit(`${'word '.repeat(60)}end. Then more.`)).toBeNull();
  });
});
