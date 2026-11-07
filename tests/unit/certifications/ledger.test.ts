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
 * @file The Ledger's display helpers and model: issuer families, split skills, months (never a
 * day, never shifted by the time zone), credential links, the header's stats, the issuer chips,
 * featured picks, and year groups.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  countLabel,
  credentialLinkOf,
  familyOf,
  monthOf,
  skillsOf,
  slugOf,
} from '@/app/(routes)/(main)/(professioal)/certifications/_lib/format';
import {
  buildLedger,
  groupByYear,
  MAX_FEATURED,
} from '@/app/(routes)/(main)/(professioal)/certifications/_lib/ledger';
import { CERTS, cert, ledger, titles } from './ledger-fixture';

/** The no-break space the long month joins its year with. */
const NBSP = '\u00a0';

describe('issuer families', () => {
  it.each([
    ['Google', 'Google'],
    ['Google Cloud Skills Boost', 'Google'],
    ['Google Cloud Training Online', 'Google'],
    ['Google Digital Academy (Skillshop)', 'Google'],
    ['Microsoft', 'Microsoft'],
    ['Microsoft Learn Student Ambassadors', 'Microsoft'],
    ['Coursera', 'Coursera'],
    ['IBM', 'IBM'],
    ['  Udemy ', 'Udemy'],
  ])('%s belongs to %s', (issuer, family) => {
    expect(familyOf(issuer)).toBe(family);
  });

  it('folds only the listed strings, not every name that starts with a company', () => {
    expect(familyOf('Google Developer Groups')).toBe('Google Developer Groups');
    expect(familyOf('Microsoftish')).toBe('Microsoftish');
  });

  it('slugs names for the URL', () => {
    expect(slugOf('Google Cloud Skills Boost')).toBe('google-cloud-skills-boost');
    expect(slugOf('  Develop for Good ')).toBe('develop-for-good');
    expect(slugOf('Google Digital Academy (Skillshop)')).toBe('google-digital-academy-skillshop');
  });
});

describe('skillsOf', () => {
  it('splits the joined strings the CMS holds, on middots, bullets and newlines', () => {
    expect(
      skillsOf({ skills: ['Cascading Style Sheets (CSS) · Redux.js · React.js', 'SQL'] }),
    ).toEqual(['Cascading Style Sheets (CSS)', 'Redux.js', 'React.js', 'SQL']);
    expect(skillsOf({ skills: ['Redux.js\nReact.js', 'GCP • SQL'] })).toEqual([
      'Redux.js',
      'React.js',
      'GCP',
      'SQL',
    ]);
  });

  it('drops blanks and repeats (ignoring case) and copes with no skills', () => {
    expect(skillsOf({ skills: [' · SQL ·  ', 'sql', ''] })).toEqual(['SQL']);
    expect(skillsOf({ skills: null })).toEqual([]);
    expect(skillsOf({})).toEqual([]);
  });
});

describe('monthOf', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('formats the month Sanity holds, never a day', () => {
    expect(monthOf('2024-12-01')).toEqual({
      short: 'Dec 2024',
      long: `December${NBSP}2024`,
      iso: '2024-12',
      year: '2024',
    });
    expect(monthOf('2023-09')).toMatchObject({ short: 'Sep 2023', iso: '2023-09' });
  });

  it('keeps the long month with its year, so a narrow subline never ends on "July"', () => {
    expect(monthOf('2022-07-01')?.long).toBe(`July${NBSP}2022`);
    expect(monthOf('2022-07-01')?.long).not.toContain(' ');
  });

  it('never shifts the month by the time zone', () => {
    process.env.TZ = 'Pacific/Honolulu';
    expect(monthOf('2024-01-01')?.short).toBe('Jan 2024');
    process.env.TZ = 'Pacific/Kiritimati';
    expect(monthOf('2023-12-31')?.short).toBe('Dec 2023');
  });

  it.each([null, undefined, '', 'May 2024', '2024-13-01', '2024-00-01', '24-01-01'])(
    'returns null for %j',
    (value) => {
      expect(monthOf(value)).toBeNull();
    },
  );
});

describe('credentialLinkOf', () => {
  it('keeps an http(s) URL and names its host without www', () => {
    expect(credentialLinkOf(' https://www.credly.com/badges/x ')).toEqual({
      href: 'https://www.credly.com/badges/x',
      host: 'credly.com',
    });
    expect(credentialLinkOf('https://api2.sololearn.com/v2/c')?.host).toBe('api2.sololearn.com');
  });

  // 'https://' passes the scheme check and fails the URL parser: the parse error is caught.
  it.each([
    null,
    undefined,
    '',
    '  ',
    '#',
    'javascript:alert(1)',
    'not a url',
    '/relative',
    'https://',
  ])('is null for %j', (value) => {
    expect(credentialLinkOf(value)).toBeNull();
  });
});

describe('buildLedger', () => {
  it('orders newest first, then by Studio order within a month', () => {
    expect(titles(ledger.entries)).toEqual([
      'Qiskit Global Summer School 2025',
      'Building AI-Powered Search',
      'Hack Together',
      'Build Wireframes',
      'Azure AI Fundamentals',
      'Complete React Developer',
      'BigQuery Basics',
      'MongoDB Basics',
      'React + Redux',
      'Udemy TypeScript',
      'Postman Student Expert',
    ]);
  });

  it('counts certificates, issuer families, links, and dates the earliest month', () => {
    expect(ledger.stats).toEqual({
      certificates: 11,
      issuers: 7,
      withLink: 9,
      since: `July${NBSP}2022`,
    });
  });

  it('makes a chip of every family with two or more, biggest first, then newest', () => {
    // All four have two: MongoDB's newest is Apr 2025; Microsoft and Google tie on Dec 2024, and
    // Microsoft's Dec 2024 row comes first in Studio order; Udemy's newest is Sep 2023.
    expect(ledger.chips).toEqual([
      { slug: 'mongodb', label: 'MongoDB', count: 2 },
      { slug: 'microsoft', label: 'Microsoft', count: 2 },
      { slug: 'google', label: 'Google', count: 2 },
      { slug: 'udemy', label: 'Udemy', count: 2 },
    ]);
    expect(ledger.other).toEqual({ slug: 'other', label: 'Other', count: 3 });

    const bigger = buildLedger([...CERTS, cert({ issuer: 'Udemy', issueDate: '2022-01-01' })]);
    expect(bigger.chips[0]).toEqual({ slug: 'udemy', label: 'Udemy', count: 3 });
  });

  it('keeps each row as written: issuer, month, link host, ID and split skills', () => {
    const [qiskit, mongo] = ledger.entries;
    const bigQuery = ledger.entries.find((entry) => entry.title === 'BigQuery Basics');

    expect(qiskit).toMatchObject({
      issuer: 'IBM',
      family: 'IBM',
      chip: 'other',
      year: '2025',
      link: { host: 'credly.com' },
      credentialId: null,
    });
    expect(qiskit?.month?.short).toBe('Aug 2025');
    expect(mongo).toMatchObject({ chip: 'mongodb', credentialId: 'MDBoeods0fx0y' });
    expect(bigQuery).toMatchObject({
      issuer: 'Google Cloud Skills Boost',
      familySlug: 'google',
      skills: ['Google Cloud Platform (GCP)', 'SQL'],
    });
  });

  it('features up to four certificates in display order, and none when none is marked', () => {
    expect(titles(ledger.featured)).toEqual([
      'Azure AI Fundamentals',
      'Complete React Developer',
      'React + Redux',
    ]);

    const many = buildLedger(
      Array.from({ length: 6 }, (_, i) =>
        cert({ title: `F${i}`, order: 6 - i, issueDate: '2024-01-01', featured: true }),
      ),
    );
    expect(many.featured).toHaveLength(MAX_FEATURED);
    expect(titles(many.featured)).toEqual(['F5', 'F4', 'F3', 'F2']);

    expect(buildLedger(CERTS.map((c) => ({ ...c, featured: false }))).featured).toEqual([]);
  });

  // CodeRabbit on #613: names that slug alike ('C++ Institute', 'C Institute'), or not at all
  // (a non-Latin name), must stay separate issuers with their own chip and ?issuer value.
  it('keeps issuers whose names slug alike apart, each with its own chip and URL value', () => {
    const alike = buildLedger([
      cert({ title: 'One', issuer: 'C++ Institute', issueDate: '2024-01-01', order: 1 }),
      cert({ title: 'Two', issuer: 'C++ Institute', issueDate: '2024-02-01', order: 2 }),
      cert({ title: 'Three', issuer: 'C Institute', issueDate: '2024-03-01', order: 3 }),
      cert({ title: 'Four', issuer: 'C Institute', issueDate: '2024-04-01', order: 4 }),
      cert({ title: 'Five', issuer: '東京大学', issueDate: '2024-05-01', order: 5 }),
      cert({ title: 'Six', issuer: '東京大学', issueDate: '2024-05-01', order: 6 }),
      cert({ title: 'Seven', issuer: '北京大学', issueDate: '2024-06-01', order: 7 }),
      cert({ title: 'Eight', issuer: '北京大学', issueDate: '2024-06-01', order: 8 }),
    ]);

    expect(alike.stats.issuers).toBe(4);
    expect(alike.chips.map(({ label, count }) => [label, count]).sort()).toEqual(
      [
        ['C Institute', 2],
        ['C++ Institute', 2],
        ['北京大学', 2],
        ['東京大学', 2],
      ].sort(),
    );
    const slugs = alike.chips.map((chip) => chip.slug);
    expect(new Set(slugs).size).toBe(4);
    // The family with the earliest certificate keeps the plain slug.
    expect(alike.index.families['c-institute']?.label).toBe('C++ Institute');
    expect(alike.index.families['c-institute-2']?.label).toBe('C Institute');
    for (const entry of alike.entries) {
      expect(alike.index.families[entry.familySlug]?.label).toBe(entry.family);
    }
  });

  // CodeRabbit on #613: in name order, adding 'C Institute' later took 'c-institute' from an
  // existing 'C++ Institute' and broke its shared links. By earliest certificate it cannot.
  it('keeps an existing issuer’s slug when a newer issuer with an alike name is added', () => {
    const before = buildLedger([
      cert({ title: 'One', issuer: 'C++ Institute', issueDate: '2023-01-01', order: 1 }),
      cert({ title: 'Two', issuer: 'C++ Institute', issueDate: '2023-02-01', order: 2 }),
    ]);
    const after = buildLedger([
      ...[
        cert({ title: 'One', issuer: 'C++ Institute', issueDate: '2023-01-01', order: 1 }),
        cert({ title: 'Two', issuer: 'C++ Institute', issueDate: '2023-02-01', order: 2 }),
      ],
      cert({ title: 'Three', issuer: 'C Institute', issueDate: '2025-03-01', order: 3 }),
      cert({ title: 'Four', issuer: 'C Institute', issueDate: '2025-04-01', order: 4 }),
    ]);

    expect(before.index.families['c-institute']?.label).toBe('C++ Institute');
    expect(after.index.families['c-institute']?.label).toBe('C++ Institute');
    expect(after.index.families['c-institute-2']?.label).toBe('C Institute');
  });

  it('still folds one issuer written in different cases into one family', () => {
    const cased = buildLedger([
      cert({ title: 'One', issuer: 'MongoDB', issueDate: '2024-02-01', order: 1 }),
      cert({ title: 'Two', issuer: 'Mongodb', issueDate: '2024-01-01', order: 2 }),
    ]);

    expect(cased.stats.issuers).toBe(1);
    expect(cased.chips).toEqual([{ slug: 'mongodb', label: 'MongoDB', count: 2 }]);
  });

  it('copes with no certificates at all', () => {
    const empty = buildLedger([]);

    expect(empty.entries).toEqual([]);
    expect(empty.stats).toEqual({ certificates: 0, issuers: 0, withLink: 0, since: null });
    expect(empty.chips).toEqual([]);
    expect(empty.other).toBeNull();
  });

  it('puts a certificate with an unreadable date last, under Undated', () => {
    const odd = buildLedger([
      cert({ title: 'Odd', issueDate: 'soon', order: 1 }),
      cert({ title: 'Real', issueDate: '2022-02-01', order: 2 }),
    ]);

    expect(titles(odd.entries)).toEqual(['Real', 'Odd']);
    expect(odd.entries[1]).toMatchObject({ month: null, year: 'Undated' });
    expect(odd.stats.since).toBe(`February${NBSP}2022`);
  });
});

describe('groupByYear', () => {
  it('groups by year, newest year first, keeping the order inside each year', () => {
    const groups = groupByYear(ledger.entries);

    expect(groups.map((group) => group.year)).toEqual(['2025', '2024', '2023', '2022']);
    expect(titles(groups[1]?.entries ?? [])).toEqual([
      'Hack Together',
      'Build Wireframes',
      'Azure AI Fundamentals',
    ]);
  });

  it('words a count', () => {
    expect(countLabel(1)).toBe('1 certificate');
    expect(countLabel(26)).toBe('26 certificates');
  });
});
