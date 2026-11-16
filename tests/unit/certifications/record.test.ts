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
 * @file The Folio record's model (_lib/record.ts): thin years against busy ones, the issuer
 * groups of a busy year (biggest first, one-offs as 'One each', the top group), month stacks, the
 * platform a group may claim and what each certificate must say itself, and the year's one
 * sentence. Built from real-shaped documents through buildLedger.
 */

import { makeCertification } from '@tests/fixtures/sanity-docs';
import { describe, expect, it } from 'vitest';

import { buildLedger } from '@/app/(routes)/(main)/(professioal)/certifications/_lib/ledger';
import {
  briefNotes,
  buildRecord,
  burstSentence,
  groupPlatform,
  issuerGroups,
  monthStacks,
  numberWord,
  ownPlatform,
  platformLine,
  SINGLES_LABEL,
  summaryText,
  THIN_YEAR_MAX,
  yearSentence,
  yearSummary,
} from '@/app/(routes)/(main)/(professioal)/certifications/_lib/record';
import type { Certification } from '@/hooks/sanity/schemas';

const SOLO = 'https://www.sololearn.com/certificates/CT-1';
const COURSERA = 'https://www.coursera.org/account/accomplishments/records/X';
const SKILLS_BOOST = 'https://www.cloudskillsboost.google/public_profiles/x/badges/1';
const CREDLY = 'https://www.credly.com/badges/abc';
/** A PDF in a storage bucket, as the Programming Hub certificate is linked. */
const STORED = 'https://storage.googleapis.com/bucket/';

/** A certificate: title, issuer, 'YYYY-MM', link (or none). */
const cert = (
  title: string,
  issuer: string,
  month: string,
  credentialUrl?: string,
): Certification => makeCertification({ title, issuer, issueDate: `${month}-01`, credentialUrl });

const entriesOf = (certs: readonly Certification[]) => buildLedger(certs).entries;
const labels = (groups: readonly { label: string }[]): string[] => groups.map((g) => g.label);
const titlesIn = (entries: readonly { title: string }[]): string[] => entries.map((e) => e.title);
const say = (certs: readonly Certification[]): string => summaryText(yearSummary(entriesOf(certs)));
/** `count` certificates from one issuer, a month apart from `first` (1 to 9). */
const run = (issuer: string, count: number, year: string, first = 1): Certification[] =>
  Array.from({ length: count }, (_, i) => cert(`${issuer} ${i}`, issuer, `${year}-0${first + i}`));

/** A busy 2023: Sololearn 3, Google 2 (one through Skills Boost), and two one-off issuers. */
const BUSY = [
  cert('Java', 'Sololearn', '2023-07', SOLO),
  cert('Python', 'Sololearn', '2023-07', SOLO),
  cert('C#', 'Sololearn', '2023-06', SOLO),
  cert('Go Beyond the Numbers', 'Google', '2023-05', COURSERA),
  cert('Baseline: Infrastructure', 'Google Cloud Skills Boost', '2023-03', SKILLS_BOOST),
  cert('Algoexpert', 'AlgoExpert', '2023-08', 'https://certificate.algoexpert.io/AE-1'),
  cert('Postman Student Expert', 'Postman', '2023-04'),
];

describe('buildRecord', () => {
  it('makes one chapter per year, newest first, with its id, counts and issuer families', () => {
    const chapters = buildRecord(
      entriesOf([cert('A', 'IBM', '2025-08', CREDLY), ...BUSY, cert('B', 'Sololearn', '2022-07')]),
    );

    expect(chapters.map((c) => [c.year, c.id, c.count, c.issuers])).toEqual([
      ['2025', 'y2025', 1, 1],
      ['2023', 'y2023', 7, 4],
      ['2022', 'y2022', 1, 1],
    ]);
  });

  it(`sets a year of ${THIN_YEAR_MAX} or fewer large, and groups a busier one by issuer`, () => {
    const four = ['2024-04', '2024-03', '2024-02', '2024-01'].map((m, i) =>
      cert(`T${i}`, `Issuer ${i}`, m, CREDLY),
    );
    const [thin] = buildRecord(entriesOf(four));
    const [busy] = buildRecord(entriesOf(BUSY));

    expect(thin?.layout).toBe('thin');
    expect(thin?.groups).toEqual([]);
    expect(titlesIn(thin?.entries ?? [])).toEqual(['T0', 'T1', 'T2', 'T3']);
    expect(busy?.layout).toBe('grouped');
    expect(labels(busy?.groups ?? [])).toEqual(['Sololearn', 'Google', SINGLES_LABEL]);
  });

  it('regroups what a filter keeps: a busy year thinned to two is set large', () => {
    const kept = entriesOf(BUSY).filter((entry) => entry.family === 'Google');
    const [chapter] = buildRecord(kept);

    expect(chapter?.layout).toBe('thin');
    expect(summaryText(chapter?.summary ?? [])).toBe('Both from Google.');
  });
});

describe('issuerGroups', () => {
  it('puts the biggest family first, folds Skills Boost into Google, and one-offs last', () => {
    const groups = issuerGroups(entriesOf(BUSY));

    expect(groups.map((g) => [g.label, g.count, g.singles])).toEqual([
      ['Sololearn', 3, false],
      ['Google', 2, false],
      ['One each', 2, true],
    ]);
    // 'One each' keeps the year's order: newest first.
    expect(titlesIn(groups[2]?.stacks.flatMap((s) => s.entries) ?? [])).toEqual([
      'Algoexpert',
      'Postman Student Expert',
    ]);
  });

  it('marks the first group as the top one only when it is bigger than the next', () => {
    expect(issuerGroups(entriesOf(BUSY)).map((g) => g.top)).toEqual([true, false, false]);

    const tied = issuerGroups(
      entriesOf([
        cert('U1', 'Udemy', '2023-09'),
        cert('U2', 'Udemy', '2023-09'),
        cert('M1', 'MongoDB', '2023-08'),
        cert('M2', 'MongoDB', '2023-06'),
        cert('P', 'Postman', '2023-04'),
      ]),
    );
    // A lone one-off keeps its own name; Udemy is newer than MongoDB, so it comes first.
    expect(labels(tied)).toEqual(['Udemy', 'MongoDB', 'Postman']);
    expect(tied.map((g) => g.top)).toEqual([false, false, false]);
  });

  it('never makes One each the top group, even when it is the only one', () => {
    const groups = issuerGroups(
      entriesOf(['A', 'B', 'C', 'D', 'E'].map((name) => cert(name, `${name} Inc`, '2023-05'))),
    );

    expect(groups.map((g) => [g.label, g.top])).toEqual([[SINGLES_LABEL, false]]);
  });

  it('keeps two issuers whose names slug alike apart, each with its own key', () => {
    const groups = issuerGroups(
      entriesOf([
        cert('A1', 'C++ Institute', '2023-05'),
        cert('A2', 'C++ Institute', '2023-05'),
        cert('B1', 'C Institute', '2023-04'),
        cert('B2', 'C Institute', '2023-04'),
        cert('X', 'Postman', '2023-01'),
      ]),
    );

    expect(labels(groups)).toEqual(['C++ Institute', 'C Institute', 'Postman']);
    expect(new Set(groups.map((g) => g.key)).size).toBe(3);
  });
});

describe('monthStacks', () => {
  it('stacks consecutive certificates of one month under that month, once', () => {
    const sololearn = entriesOf(BUSY).filter((entry) => entry.family === 'Sololearn');

    expect(monthStacks(sololearn).map((s) => [s.month?.name, titlesIn(s.entries)])).toEqual([
      ['Jul', ['Java', 'Python']],
      ['Jun', ['C#']],
    ]);
  });

  it('puts certificates with no readable date in one stack with no month', () => {
    const stacks = monthStacks(
      entriesOf([cert('A', 'X', '2023-05'), makeCertification({ title: 'B', issueDate: 'soon' })]),
    );

    expect(stacks.map((s) => [s.key, s.month?.name ?? null])).toEqual([
      ['2023-05', 'May'],
      ['undated', null],
    ]);
  });
});

describe('the platform a group names, and what a certificate says itself', () => {
  it("claims 'all' only when every certificate links there, 'most' past half, else nothing", () => {
    const all = entriesOf([
      cert('A', 'Sololearn', '2023-07', SOLO),
      cert('B', 'Sololearn', '2023-06', SOLO),
    ]);
    const most = entriesOf([
      cert('A', 'Google', '2024-04', COURSERA),
      cert('B', 'Google', '2024-04', COURSERA),
      cert('C', 'Google Cloud Skills Boost', '2024-03', SKILLS_BOOST),
    ]);
    const unlinked = entriesOf([
      cert('A', 'Sololearn', '2023-07', SOLO),
      cert('B', 'Sololearn', '2023-06'),
    ]);
    const split = entriesOf(BUSY).filter((entry) => entry.family === 'Google');

    expect(groupPlatform(all)).toEqual({ name: 'Sololearn', share: 'all' });
    expect(groupPlatform(most)).toEqual({ name: 'Coursera', share: 'most' });
    // One link of two is not more than half, so the group claims nothing.
    expect(groupPlatform(unlinked)).toBeNull();
    expect(groupPlatform(split)).toBeNull();
    expect(groupPlatform([])).toBeNull();
    expect(platformLine({ name: 'Sololearn', share: 'all' })).toBe('Verify on Sololearn');
    expect(platformLine({ name: 'Coursera', share: 'most' })).toBe('Most verify on Coursera');
    expect(platformLine(null)).toBeNull();
  });

  it("never lets a group's line speak for a certificate that verifies elsewhere", () => {
    const [onCoursera, , onSkillsBoost] = entriesOf([
      cert('A', 'Google', '2024-04', COURSERA),
      cert('B', 'Google', '2024-04', COURSERA),
      cert('C', 'Google Cloud Skills Boost', '2024-03', SKILLS_BOOST),
    ]);
    const group = {
      label: 'Google',
      singles: false,
      platform: { name: 'Coursera', share: 'most' },
    } as const;

    expect(onCoursera && briefNotes(onCoursera, group)).toEqual([]);
    expect(onSkillsBoost && briefNotes(onSkillsBoost, group)).toEqual([
      'Google Cloud Skills Boost',
      'Verify on Skills Boost',
    ]);
  });

  it("names every issuer in One each, its platform unless it is the issuer's own site", () => {
    const entries = entriesOf([
      cert('Algoexpert', 'AlgoExpert', '2023-08', 'https://certificate.algoexpert.io/AE-1'),
      cert('Social PayMe', 'Hashtag University', '2023-08', 'https://www.virtualbadge.io/x'),
      cert('Postman Student Expert', 'Postman', '2023-04'),
    ]);
    const singles = { label: SINGLES_LABEL, singles: true, platform: null } as const;

    expect(entries.map((entry) => briefNotes(entry, singles))).toEqual([
      ['AlgoExpert'],
      ['Hashtag University', 'Verify on VirtualBadge'],
      ['Postman', 'No public link'],
    ]);
    expect(entries[0] && ownPlatform(entries[0], null)).toBeNull();
  });

  it('says a PDF on a file host is a certificate file, never that its host verifies it', () => {
    const [onCoursera, , stored] = entriesOf([
      cert('A', 'Google', '2024-04', COURSERA),
      cert('B', 'Google', '2024-04', COURSERA),
      cert('C++', 'Google', '2024-03', `${STORED}certificate%2F1.pdf`),
    ]);
    const singles = { label: SINGLES_LABEL, singles: true, platform: null } as const;
    const lone = entriesOf([cert('C++', 'Programming Hub', '2023-01', `${STORED}c.pdf`)])[0];

    expect(stored?.link).toMatchObject({ host: 'storage.googleapis.com', verifies: false });
    expect(stored && ownPlatform(stored, null)).toBeNull();
    expect(
      stored && briefNotes(stored, { label: 'Google', singles: false, platform: null }),
    ).toEqual(['Certificate file']);
    expect(lone && briefNotes(lone, singles)).toEqual(['Programming Hub', 'Certificate file']);
    expect(onCoursera?.link?.verifies).toBe(true);
  });

  it('never makes a file host the platform a group names, and counts its file against "all"', () => {
    const stored = (title: string) =>
      cert(title, 'Programming Hub', '2023-01', `${STORED}${title}.pdf`);
    const twoOfThree = entriesOf([
      cert('A', 'Sololearn', '2023-07', SOLO),
      cert('B', 'Sololearn', '2023-06', SOLO),
      cert('C', 'Sololearn', '2023-05', `${STORED}c.pdf`),
    ]);

    expect(groupPlatform(entriesOf([stored('a'), stored('b')]))).toBeNull();
    expect(groupPlatform(twoOfThree)).toEqual({ name: 'Sololearn', share: 'most' });
  });
});

describe("a year's sentence", () => {
  it('names a thin year: one issuer as both or all, else every issuer', () => {
    expect(say(run('Sololearn', 2, '2022'))).toBe('Both from Sololearn.');
    expect(say(run('Udemy', 3, '2022'))).toBe('All three from Udemy.');
    expect(say([cert('A', 'IBM', '2025-08'), cert('B', 'MongoDB', '2025-04')])).toBe(
      'IBM and MongoDB.',
    );
    expect(
      say([
        cert('A', 'IBM', '2025-08'),
        cert('B', 'MongoDB', '2025-04'),
        cert('C', 'Postman', '2025-01'),
      ]),
    ).toBe('IBM, MongoDB and Postman.');
    expect(say([cert('A', 'IBM', '2025-08')])).toBe('');
  });

  it('lifts every name it says, and nothing else', () => {
    const parts = yearSummary(
      entriesOf([cert('A', 'IBM', '2025-08'), cert('B', 'MongoDB', '2025-04')]),
    );

    expect(parts.filter((part) => part.name).map((part) => part.text)).toEqual(['IBM', 'MongoDB']);
  });

  it('says who most of a busy year came from, words first and figures after', () => {
    const mostlyOne = [
      ...run('Google', 4, '2024'),
      cert('M', 'Microsoft', '2024-06'),
      cert('L', 'LinkedIn', '2024-07'),
    ];
    const mostlyTwo = [
      ...run('Sololearn', 3, '2023'),
      ...run('Coursera', 2, '2023', 4),
      cert('U', 'Udemy', '2023-09'),
      cert('P', 'Postman', '2023-08'),
    ];
    const spread = ['A', 'B', 'C', 'D', 'E'].map((name, i) =>
      cert(name, `${name} Inc`, `2023-0${i + 1}`),
    );

    expect(say(mostlyOne)).toBe('Mostly Google: 4 of 6.');
    expect(say(mostlyTwo)).toBe('Mostly Sololearn and Coursera: 5 of 7.');
    // Five one-offs tie, so the two newest are named.
    expect(say(spread)).toBe('E Inc, D Inc and three more.');
  });

  it('says a busy year from one issuer (what a chip leaves) as all from it, not as a share', () => {
    // A chip often leaves one issuer: 'Mostly Google: 16 of 16.' would read as a slip.
    expect(say(run('Google', 6, '2024'))).toBe('All six from Google.');
  });

  it('adds the burst when one month alone holds three or more and a quarter of the year', () => {
    const august = Array.from({ length: 4 }, (_, i) => cert(`A${i}`, 'Coursera', '2023-08'));
    const rest = [cert('J', 'Sololearn', '2023-07'), cert('K', 'Sololearn', '2023-06')];

    expect(burstSentence(entriesOf([...august, ...rest]))).toBe('Four of them in August.');
    expect(say([...august, ...rest])).toBe('Mostly Coursera: 4 of 6. Four of them in August.');
    expect(burstSentence(entriesOf([...august, cert('Z', 'X', '2023-08')]))).toBe('All in August.');
  });

  it('says no burst when months tie or none stands out', () => {
    const tie = [
      ...Array.from({ length: 3 }, (_, i) => cert(`J${i}`, 'Google', '2024-01')),
      ...Array.from({ length: 3 }, (_, i) => cert(`A${i}`, 'Google', '2024-04')),
    ];

    expect(burstSentence(entriesOf(tie))).toBeNull();
    expect(burstSentence(entriesOf(run('Google', 5, '2024')))).toBeNull();
  });

  it('writes counts in words to twelve and in figures above', () => {
    expect([1, 10, 12, 13].map(numberWord)).toEqual(['one', 'ten', 'twelve', '13']);
  });
});

describe('each count said once around a year’s opening', () => {
  /** What the year's sentence already says: whether it names every issuer, whose count it gives. */
  const told = (certs: readonly Certification[]) => {
    const { issuersSaid, countOf } = yearSentence(entriesOf(certs));
    return { issuersSaid, countOf };
  };
  const mostlyOne = [
    ...run('Google', 4, '2024'),
    cert('M', 'Microsoft', '2024-06'),
    cert('L', 'LinkedIn', '2024-07'),
  ];

  it('knows which counts the sentence gives, by its form', () => {
    // 'Mostly Google: 4 of 6.' gives Google's four, and leaves two issuers unnamed.
    expect(told(mostlyOne)).toEqual({ issuersSaid: false, countOf: 'google' });
    // 'Mostly Sololearn and Coursera: 5 of 7.' gives neither family's own count.
    expect(told(BUSY)).toEqual({ issuersSaid: false, countOf: null });
    // A thin year names every issuer; one issuer, 'All six from Google.', says its count too.
    expect(told([cert('A', 'IBM', '2025-08'), cert('B', 'MongoDB', '2025-04')])).toEqual({
      issuersSaid: true,
      countOf: null,
    });
    expect(told(run('Google', 6, '2024'))).toEqual({ issuersSaid: true, countOf: 'google' });
    // 'E Inc, D Inc and three more.' counts every issuer.
    const spread = ['A', 'B', 'C', 'D', 'E'].map((name, i) =>
      cert(name, `${name} Inc`, `2023-0${i + 1}`),
    );
    expect(told(spread).issuersSaid).toBe(true);
  });

  it('marks a chapter and its groups by what is already said', () => {
    const [mostly] = buildRecord(entriesOf(mostlyOne));
    const [shared] = buildRecord(entriesOf(BUSY));
    const [alone] = buildRecord(entriesOf(run('Google', 6, '2024')));

    expect(mostly?.issuersSaid).toBe(false);
    expect(mostly?.groups.map((g) => [g.label, g.countSaid])).toEqual([
      ['Google', true],
      [SINGLES_LABEL, false],
    ]);
    expect(shared?.groups.map((g) => g.countSaid)).toEqual([false, false, false]);
    // A year's only group: its count is the year's, which the year's jump link says.
    expect(alone?.groups.map((g) => [g.label, g.countSaid])).toEqual([['Google', true]]);
  });
});
