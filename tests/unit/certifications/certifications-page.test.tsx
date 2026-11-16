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
 * @file /certifications as a Folio record, rendered on the server from loadCertifications(): a
 * header whose counts are one byline, a Featured chapter only when the owner featured something,
 * then one chapter per year. A thin year sets each certificate large with 'Verify on <platform>';
 * a busy year groups them under the issuer's name, months in the margin, each title its
 * credential's link. No table anywhere. The one client island holds the filters; everything else
 * is server code without the old card kit. (The URL filters: certifications-filters.test.tsx; the
 * grouping rules: record.test.ts.)
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, screen, within } from '@testing-library/react';
import { makeCertification } from '@tests/fixtures/sanity-docs';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ loadCertifications: vi.fn() }));

// t3-env validates on import; these tests need no real configuration.
vi.mock('@/env', () => {
  const env = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === 'NODE_ENV' ? 'test' : undefined),
  });
  return { env, default: env };
});
vi.mock('@/lib/sanity/loaders', () => ({ loadCertifications: h.loadCertifications }));

import CertificationsPage from '@/app/(routes)/(main)/(professioal)/certifications/page';
import {
  ALL_TITLES,
  CERTS,
  itemFor,
  itemTitles,
  NEW_TAB,
  renderPage,
  yearHeadings,
} from './page-fixture';

const C_DIR = 'src/app/(routes)/(main)/(professioal)/certifications';
const SERVER_FILES = [
  `${C_DIR}/page.tsx`,
  `${C_DIR}/_interface/certifications/certifications.tsx`,
  `${C_DIR}/_components/credential.tsx`,
  `${C_DIR}/_components/featured-chapter.tsx`,
  `${C_DIR}/_components/issuer-group.tsx`,
  `${C_DIR}/_components/ledger-header.tsx`,
  `${C_DIR}/_components/record-classes.ts`,
  `${C_DIR}/_components/record-years.tsx`,
  `${C_DIR}/_lib/ledger.ts`,
  `${C_DIR}/_lib/filters.ts`,
  `${C_DIR}/_lib/certification-filters.ts`,
  `${C_DIR}/_lib/format.ts`,
  `${C_DIR}/_lib/record.ts`,
];
const ISLAND_FILE = `${C_DIR}/_components/ledger-explorer.tsx`;
/** The island's own modules: its URL sync and the adapter to the FilterBar kit. */
const ISLAND_PARTS = [
  `${C_DIR}/_components/use-ledger-filters.ts`,
  `${C_DIR}/_components/use-ledger-model.ts`,
];
/** The old Ledger's table and tile parts, gone with the record. */
const RETIRED = ['ledger-row.tsx', 'ledger-years.tsx', 'ledger-classes.ts', 'featured-row.tsx'];

/** What the chrome's type and the old cards used: none of it belongs on the page. */
const FORBIDDEN_TYPE =
  /(?:^|[\s:])!?(?:label-mono|font-mono|uppercase|tracking-label|text-(?:label|stat|display|hero|xs|\[1[01]px\])|font-bold|font-extrabold|font-black)!?(?=[\s/]|$)/;

const SOLO = 'https://www.sololearn.com/certificates/CT-';
/** A busy 2023 (seven, so it is grouped by issuer) and a thin 2024 of one. */
const BUSY = [
  makeCertification({
    title: 'Azure Fundamentals',
    issuer: 'Microsoft',
    issueDate: '2024-06-01',
    credentialUrl: 'https://learn.microsoft.com/x',
  }),
  ...[
    ['Java', '2023-07'],
    ['Python', '2023-07'],
    ['C#', '2023-06'],
  ].map(([title, month], index) =>
    makeCertification({
      title,
      issuer: 'Sololearn',
      issueDate: `${month}-01`,
      order: index,
      credentialUrl: `${SOLO}${index}`,
      credentialId: `CT-${index}`,
    }),
  ),
  makeCertification({
    title: 'Go Beyond the Numbers',
    issuer: 'Google',
    issueDate: '2023-05-01',
    credentialUrl: 'https://www.coursera.org/account/accomplishments/records/X',
  }),
  makeCertification({
    title: 'Baseline: Infrastructure',
    issuer: 'Google Cloud Skills Boost',
    issueDate: '2023-03-01',
    credentialUrl: 'https://www.cloudskillsboost.google/public_profiles/x/badges/1',
  }),
  makeCertification({
    title: 'Algoexpert',
    issuer: 'AlgoExpert',
    issueDate: '2023-08-01',
    credentialUrl: 'https://certificate.algoexpert.io/AE-1',
  }),
  makeCertification({
    title: 'Postman Student Expert',
    issuer: 'Postman',
    issueDate: '2023-04-01',
  }),
];

const chapter = (name: string): HTMLElement => screen.getByRole('region', { name });
const chapterSizes = (): (string | undefined)[] =>
  Array.from(document.querySelectorAll<HTMLElement>('section[data-chapter]')).map(
    (section) => section.dataset.chapter,
  );
/** The first byline inside `root`, as one line of text. */
const bylineOf = (root: Element): string =>
  (root.querySelector('[data-byline]')?.textContent ?? '').replace(/\s+/g, ' ').trim();
/** What an element shows: its text without the words only screen readers hear. */
const shownText = (element: Element | null): string => {
  const copy = element?.cloneNode(true) as Element | undefined;
  for (const hidden of copy?.querySelectorAll('.sr-only') ?? []) hidden.remove();
  return (copy?.textContent ?? '').replace(/\s+/g, ' ').trim();
};
/** What a screen reader hears of it: its text without what is hidden from them. */
const spokenText = (element: Element | null): string => {
  const copy = element?.cloneNode(true) as Element | undefined;
  for (const hidden of copy?.querySelectorAll('[aria-hidden="true"]') ?? []) hidden.remove();
  return (copy?.textContent ?? '').replace(/\s+/g, ' ').trim();
};
/** A certificate whose link is a PDF in a storage bucket, as Programming Hub's is. */
const STORED = makeCertification({
  title: 'C++',
  issuer: 'Programming Hub',
  issueDate: '2023-01-01',
  credentialUrl: 'https://storage.googleapis.com/programminghub/certificate%2F1.pdf',
});
/** A chapter opener's sentence: the paragraph in its own header that is not its byline. */
const sentenceOf = (section: HTMLElement): string =>
  section.querySelector(':scope > header p:not([data-byline])')?.textContent ?? '';
/** A chapter opener's own byline as one line of text, or null when it has none. */
const yearBylineOf = (section: HTMLElement): string | null => {
  const byline = section.querySelector(':scope > header [data-byline]');
  return byline ? (byline.textContent ?? '').replace(/\s+/g, ' ').trim() : null;
};
/** An issuer group's own byline (under its name), as one line of text. */
const groupBylineOf = (name: string): string =>
  bylineOf(screen.getByRole('list', { name }).closest('section') as HTMLElement);

beforeEach(() => {
  h.loadCertifications.mockReset();
  h.loadCertifications.mockResolvedValue(CERTS);
});

afterEach(cleanup);

describe('/certifications header', () => {
  it('has one h1, the earliest month as its subline, and its counts as one byline', async () => {
    const { container } = await renderPage();
    const header = container.querySelector('header') as HTMLElement;

    expect(screen.getAllByRole('heading', { level: 1 }).map((x) => x.textContent)).toEqual([
      'Certifications',
    ]);
    expect(screen.getByText('Courses and certificates since July 2022.')).toBeInTheDocument();
    // Google and Google Cloud Skills Boost are one company, Microsoft and its ambassadors another.
    expect(bylineOf(header)).toBe('7 certificates · 4 issuers · 6 you can verify');
    // Counts sit in a byline, never in stat tiles.
    expect(container.querySelector('dl[aria-label="Totals"]')).toBeNull();
  });
});

describe('the count under the bar', () => {
  it('is left out with no filter, so the header byline is the one count', async () => {
    const { container } = await renderPage();

    expect(container.querySelector('[data-filter-part="count"]')).toBeNull();
    // The status line is still there, empty, ready to speak after a change.
    expect(container.querySelector('p[role="status"]')).toBeInTheDocument();
  });

  it('shows what a filter keeps of the whole, with the filter as a removable token', async () => {
    const { container } = await renderPage({ issuer: 'google' });
    const count = container.querySelector('[data-filter-part="count"]') as HTMLElement;

    // The figure is a screen-reader twin beside an aria-hidden copy that counts up.
    expect(spokenText(count)).toBe('2 of 7 certificates');
    expect(screen.getByRole('link', { name: 'Remove Issuer: Google' })).toBeInTheDocument();
  });

  it('leads each kept certificate’s skills with the ?skill filter’s skill', async () => {
    await renderPage({ skill: 'react.js' });

    expect(shownText(itemFor('Complete React Developer').querySelector('[data-cert-skills]'))).toBe(
      'React.js · CSS · Redux.js',
    );
    expect(shownText(itemFor('Udemy TypeScript').querySelector('[data-cert-skills]'))).toBe(
      'React.js · TypeScript',
    );
  });
});

describe('the year chapters', () => {
  it('gives every year a chapter named by its year, newest first, every certificate once', async () => {
    await renderPage();

    expect(yearHeadings()).toEqual(['2025', '2024', '2023', '2022']);
    for (const year of ['2025', '2024', '2023', '2022']) {
      expect(chapter(year)).toHaveAttribute('id', `y${year}`);
    }
    expect(itemTitles()).toEqual(ALL_TITLES);
    expect(screen.queryAllByRole('table')).toEqual([]);
  });

  it('sizes the years by one system: a year of one is a heading on the rule', async () => {
    await renderPage();
    // 2025 and 2022 hold one certificate each; 2024 and 2023 more, after the first chapter.
    expect(chapterSizes()).toEqual(['inline', 'step', 'step', 'inline']);
  });

  it('makes the first year of more than one the page’s one display numeral', async () => {
    h.loadCertifications.mockResolvedValue(CERTS.filter((c) => c.issueDate.startsWith('2024')));
    await renderPage();

    expect(chapterSizes()).toEqual(['lead']);
  });

  it('says each year in a sentence, and no count its jump link or sentence already gives', async () => {
    await renderPage();
    const y2023 = chapter('2023');

    // Names in the year's own order: both December, Microsoft's first in Studio.
    expect(sentenceOf(chapter('2024'))).toBe('Microsoft and Google.');
    expect(sentenceOf(y2023)).toBe('Udemy, Google and Microsoft.');
    // Its jump link says '2023, 3 certificates' and the sentence names all three issuers.
    expect(yearBylineOf(y2023)).toBeNull();
    // A year of one needs neither: its certificate says it.
    expect(yearBylineOf(chapter('2025'))).toBeNull();
  });

  it('lists the years as jump links with their counts, each landing on its chapter', async () => {
    await renderPage();
    const jumps = screen.getByRole('navigation', { name: 'By year' });

    expect(
      within(jumps)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['#y2025', '#y2024', '#y2023', '#y2022']);
    expect(within(jumps).getByRole('link', { name: '2024, 2 certificates' })).toBeInTheDocument();
  });
});

describe('a thin year: each certificate set large', () => {
  it('sets the title as a heading, the issuer and month as its byline', async () => {
    await renderPage();
    const wireframes = itemFor('Build Wireframes');

    expect(within(wireframes).getByRole('heading', { level: 3 })).toHaveTextContent(
      'Build Wireframes',
    );
    expect(bylineOf(wireframes)).toBe('Google · Dec 2024');
  });

  it('links Verify on its platform in a new tab, its name starting with the words it shows', async () => {
    await renderPage();
    const link = within(itemFor('Build Wireframes')).getByRole('link');

    expect(link).toHaveAccessibleName(`Verify on Coursera, Build Wireframes${NEW_TAB}`);
    expect(link).toHaveTextContent(/^Verify on Coursera/);
    expect(link).toHaveAttribute(
      'href',
      'https://www.coursera.org/account/accomplishments/records/W5LT6G2556LY',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('says No public link, and links nothing, for a certificate without a credential URL', async () => {
    await renderPage();
    const azure = itemFor('Perform Cloud Data Science with Azure Machine Learning');

    expect(within(azure).getByText('No public link')).toBeInTheDocument();
    expect(within(azure).queryByRole('link')).toBeNull();
  });

  it('offers Copy ID with the ID named for screen readers, and lists the split skills', async () => {
    await renderPage();
    const react = itemFor('Complete React Developer');

    expect(
      within(react).getByRole('button', {
        name: 'Copy the credential ID for Complete React Developer',
      }),
    ).toHaveAttribute('title', 'UC-5ba0a391');
    expect(within(react).getByText('Credential ID UC-5ba0a391')).toHaveClass('sr-only');
    const skills = react.querySelector('[data-cert-skills]') as HTMLElement;
    // Short forms where the credential gives one; screen readers hear a list.
    expect(shownText(skills)).toBe('CSS · Redux.js · React.js');
    expect(spokenText(skills)).toBe('Skills: CSS, Redux.js, React.js');
  });

  it('offers a PDF on a file host as View certificate, never as verified by its host', async () => {
    h.loadCertifications.mockResolvedValue([...CERTS, STORED]);
    const { container } = await renderPage();
    const link = within(itemFor('C++')).getByRole('link');

    expect(link).toHaveTextContent(/^View certificate/);
    expect(link).toHaveAccessibleName(`View certificate, C++${NEW_TAB}`);
    expect(within(itemFor('C++')).queryByText(/Verify on/)).toBeNull();
    // Linked, but not one you can verify: the header still counts six.
    expect(bylineOf(container.querySelector('header') as HTMLElement)).toBe(
      '8 certificates · 5 issuers · 6 you can verify',
    );
  });
});

describe('a busy year: grouped under the issuer, months in the margin', () => {
  beforeEach(() => {
    h.loadCertifications.mockResolvedValue(BUSY);
  });

  it('groups by issuer family, biggest first, the one-certificate issuers last', async () => {
    await renderPage();
    const y2023 = chapter('2023');

    expect(
      within(y2023)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Sololearn', 'Google', 'One each']);
    // 'Mostly Sololearn and Google: 5 of 7.' leaves two issuers unnamed; the jump link counts 7.
    expect(sentenceOf(y2023)).toBe('Mostly Sololearn and Google: 5 of 7.');
    expect(yearBylineOf(y2023)).toBe('4 issuers');
  });

  it('says each count once around an opening: a group the sentence counts leaves its count out', async () => {
    const more = ['Go', 'Kotlin'].map((title, index) =>
      makeCertification({
        title,
        issuer: 'Sololearn',
        issueDate: '2023-02-01',
        order: 10 + index,
        credentialUrl: `${SOLO}${10 + index}`,
      }),
    );
    h.loadCertifications.mockResolvedValue([...BUSY, ...more]);
    await renderPage();
    const y2023 = chapter('2023');
    const jumps = screen.getByRole('navigation', { name: 'By year' });

    expect(within(jumps).getByRole('link', { name: '2023, 9 certificates' })).toBeInTheDocument();
    expect(sentenceOf(y2023)).toBe('Mostly Sololearn: 5 of 9.');
    expect(yearBylineOf(y2023)).toBe('4 issuers');
    // Sololearn's five are in the sentence; Google's two and One each's two are said only here.
    expect(groupBylineOf('Sololearn')).toBe('Verify on Sololearn');
    expect(groupBylineOf('Google')).toBe('2 certificates');
    expect(groupBylineOf('One each')).toBe('2 certificates');
    // No opener repeats its year's count.
    for (const section of document.querySelectorAll<HTMLElement>('section[data-chapter]')) {
      expect(yearBylineOf(section) ?? '').not.toMatch(/certificates?/);
    }
  });

  it('stacks each month once in the margin, the list named by its issuer', async () => {
    await renderPage();
    const sololearn = screen.getByRole('list', { name: 'Sololearn' });
    const stacks = Array.from(sololearn.querySelectorAll<HTMLElement>('[data-month-stack]'));

    expect(stacks.map((stack) => stack.querySelector('time')?.getAttribute('dateTime'))).toEqual([
      '2023-07',
      '2023-06',
    ]);
    expect(stacks.map((stack) => itemTitles(stack))).toEqual([['Java', 'Python'], ['C#']]);
    // The year stays with the month for screen readers: 'Jul 2023'.
    expect(stacks[0]?.querySelector('time')).toHaveTextContent('Jul 2023');
  });

  it('makes each title its credential’s link, the group’s platform said once', async () => {
    await renderPage();
    const group = screen.getByRole('list', { name: 'Sololearn' }).closest('section') as HTMLElement;

    expect(bylineOf(group)).toBe('3 certificates · Verify on Sololearn');
    expect(
      within(group).getByRole('link', { name: `Java, verify on Sololearn${NEW_TAB}` }),
    ).toHaveAttribute('href', `${SOLO}0`);
    expect(
      within(group).getByRole('button', { name: 'Copy the credential ID for Java' }),
    ).toBeInTheDocument();
  });

  it('notes only what the group does not say: another issuer string, another platform', async () => {
    await renderPage();

    expect(bylineOf(itemFor('Baseline: Infrastructure'))).toBe(
      'Google Cloud Skills Boost · Verify on Skills Boost',
    );
    expect(bylineOf(itemFor('Go Beyond the Numbers'))).toBe('Verify on Coursera');
    expect(bylineOf(itemFor('Algoexpert'))).toBe('AlgoExpert');
    expect(bylineOf(itemFor('Postman Student Expert'))).toBe('Postman · No public link');
    expect(within(itemFor('Postman Student Expert')).queryByRole('link')).toBeNull();
  });

  it('puts the note and up to three skills in the title’s margin, the rest counted', async () => {
    h.loadCertifications.mockResolvedValue(
      BUSY.map((c) =>
        c.title === 'C#'
          ? { ...c, skills: ['C#', 'Object-Oriented Programming (OOP)', '.NET', 'LINQ', 'xUnit'] }
          : c,
      ),
    );
    await renderPage();
    const margin = itemFor('C#').querySelector('[data-cert-margin]') as HTMLElement;
    const skills = margin.querySelector('[data-cert-skills]') as HTMLElement;

    expect(shownText(skills)).toBe('C# · OOP · .NET +2');
    expect(spokenText(skills)).toBe('Skills: C#, OOP, .NET and 2 more');
    // A certificate the group already speaks for, with no skills, has no margin at all.
    expect(itemFor('Java').querySelector('[data-cert-margin]')).toBeNull();
    expect(
      itemFor('Baseline: Infrastructure').querySelector('[data-cert-margin] [data-byline]'),
    ).toHaveTextContent('Google Cloud Skills Boost · Verify on Skills Boost');
  });

  it('says the count once when a filter leaves a busy year one issuer: in its sentence', async () => {
    const more = ['Go', 'Kotlin', 'SQL'].map((title, index) =>
      makeCertification({
        title,
        issuer: 'Sololearn',
        issueDate: '2023-02-01',
        order: 10 + index,
        credentialUrl: `${SOLO}${10 + index}`,
      }),
    );
    h.loadCertifications.mockResolvedValue([...BUSY, ...more]);
    await renderPage({ issuer: 'sololearn' });
    const y2023 = chapter('2023');

    // Then its burst: three of the six in February.
    expect(sentenceOf(y2023)).toBe('All six from Sololearn. Three of them in February.');
    expect(y2023.querySelector(':scope > header [data-byline]')).toBeNull();
    const group = screen.getByRole('list', { name: 'Sololearn' }).closest('section') as HTMLElement;
    expect(bylineOf(group)).toBe('Verify on Sololearn');
  });

  it('notes a stored PDF as a certificate file, its link claiming no platform', async () => {
    h.loadCertifications.mockResolvedValue([...BUSY, { ...STORED, issueDate: '2023-01-01' }]);
    await renderPage();

    expect(bylineOf(itemFor('C++'))).toBe('Programming Hub · Certificate file');
    expect(within(itemFor('C++')).getByRole('link')).toHaveAccessibleName(`C++${NEW_TAB}`);
  });
});

describe('the Featured chapter', () => {
  it('is left out entirely when nothing is featured', async () => {
    const { container } = await renderPage();

    expect(screen.queryByRole('heading', { name: 'Featured' })).toBeNull();
    expect(container.querySelector('[data-featured]')).toBeNull();
  });

  it('opens the page with up to four featured certificates, set large, in display order', async () => {
    h.loadCertifications.mockResolvedValue(
      CERTS.map((c) => ({ ...c, featured: c.title !== 'Build Wireframes' })),
    );
    await renderPage();
    const featured = chapter('Featured');

    expect(itemTitles(featured)).toEqual([
      'Qiskit Global Summer School 2025',
      'Perform Cloud Data Science with Azure Machine Learning',
      'Complete React Developer',
      'BigQuery Basics',
    ]);
    expect(featured).toHaveAttribute('data-chapter', 'lead');
    expect(bylineOf(within(featured).getAllByRole('listitem')[0] as HTMLElement)).toBe(
      'IBM · Aug 2025',
    );
    // Above the filters, and unfiltered by them; the years after it step down.
    const after = featured.compareDocumentPosition(screen.getByRole('searchbox'));
    expect(after & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(chapter('2024')).toHaveAttribute('data-chapter', 'step');
  });
});

describe('server rendering and module boundaries', () => {
  // Owner decision (2026-11-07): no skeleton for this route. With a loading.tsx React streams the
  // record into a hidden segment behind it, so visitors without JavaScript, crawlers and link
  // previews saw only the skeleton, and a Featured chapter the skeleton cannot predict would jump.
  it('has no loading.tsx, so the whole record is in the HTML as it arrives', () => {
    const present = ['loading.tsx', 'loading.ts', 'loading.jsx', 'loading.js'].filter((file) =>
      existsSync(join(process.cwd(), C_DIR, file)),
    );

    expect(present).toEqual([]);
  });

  it('server-renders every title and verify link, filters applied, nothing at opacity 0', async () => {
    const all = renderToString(await CertificationsPage({ searchParams: Promise.resolve({}) }));
    const google = renderToString(
      await CertificationsPage({ searchParams: Promise.resolve({ issuer: 'google' }) }),
    );

    for (const title of ALL_TITLES) expect(all).toContain(title);
    for (const { credentialUrl } of CERTS) {
      if (credentialUrl) expect(all).toContain(`href="${credentialUrl}"`);
    }
    expect(all).not.toMatch(/opacity:\s*0(?![.\d])/);
    expect(google).toContain('BigQuery Basics');
    expect(google).not.toContain('Udemy TypeScript');
  });

  it('lets a failed load reach the route error boundary', async () => {
    h.loadCertifications.mockReset();
    h.loadCertifications.mockRejectedValue(new Error('Sanity is down'));

    await expect(CertificationsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'Sanity is down',
    );
  });

  it('says so when there are no certificates at all, with no toolbar and no counts', async () => {
    h.loadCertifications.mockResolvedValue([]);
    const { container } = await renderPage();
    const empty = screen.getByText('No certificates are listed yet.');

    // The designed empty state, under the tile state contract like the filtered one.
    expect(empty.closest('[data-state="empty"]')).not.toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Certifications');
    expect(container.querySelector('header [data-byline]')).toBeNull();
  });

  it('sets no upper case, mono face (but the IDs) or bold weight anywhere on the page', async () => {
    h.loadCertifications.mockResolvedValue(
      [...CERTS, ...BUSY].map((c) => ({ ...c, featured: true })),
    );
    const { container } = await renderPage({ skill: 'SQL' });
    const offending = Array.from(container.querySelectorAll('[class]'))
      .map((element) => element.getAttribute('class') ?? '')
      .filter((classes) => FORBIDDEN_TYPE.test(classes));

    expect(offending).toEqual([]);
  });

  it('keeps one small client island; the rest is server code with no old card kit', () => {
    const island = readFileSync(join(process.cwd(), ISLAND_FILE), 'utf8');

    expect(island).toMatch(/^'use client';/);
    for (const file of [ISLAND_FILE, ...ISLAND_PARTS]) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      for (const banned of [
        /from 'nuqs'/,
        /from 'lucide-react'/,
        /from 'next\/image'/,
        /from '@\/lib\/sanity/,
        /from '(?:framer-motion|motion\/react)'/,
        /magic-card/,
      ]) {
        expect(source, file).not.toMatch(banned);
      }
    }
    for (const file of SERVER_FILES) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source, file).not.toMatch(/['"]use client['"]/);
      expect(source, file).not.toMatch(/magic-card|next\/image|from 'nuqs'|IndexGroup|<table/);
    }
    for (const file of RETIRED) {
      expect(existsSync(join(process.cwd(), C_DIR, '_components', file)), file).toBe(false);
    }
  });
});
