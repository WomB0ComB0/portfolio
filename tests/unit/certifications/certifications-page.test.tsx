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
 * @file /certifications as the Ledger, rendered on the server from loadCertifications(): a header
 * with three figures, a Featured row only when the owner featured something, then one table per
 * year with a row per certificate. The one client island holds the filters; everything else is
 * server code without the old card kit. (The URL filters: certifications-filters.test.tsx.)
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
  NEW_TAB,
  renderPage,
  rowFor,
  rowTitles,
  yearHeadings,
} from './page-fixture';

const C_DIR = 'src/app/(routes)/(main)/(professioal)/certifications';
const SERVER_FILES = [
  `${C_DIR}/page.tsx`,
  `${C_DIR}/_interface/certifications/certifications.tsx`,
  `${C_DIR}/_components/ledger-row.tsx`,
  `${C_DIR}/_components/featured-row.tsx`,
  `${C_DIR}/_lib/ledger.ts`,
  `${C_DIR}/_lib/filters.ts`,
  `${C_DIR}/_lib/format.ts`,
];
const ISLAND_FILE = `${C_DIR}/_components/ledger-explorer.tsx`;
/** The island's own modules: its state hook, its toolbar and its year tables. */
const ISLAND_PARTS = [
  `${C_DIR}/_components/use-ledger-filters.ts`,
  `${C_DIR}/_components/ledger-toolbar.tsx`,
  `${C_DIR}/_components/ledger-years.tsx`,
];
/** Text a screen reader reads: aria-hidden subtrees left out. */
const READ_ALOUD = { ignore: '[aria-hidden="true"], [aria-hidden="true"] *, script, style' };

/** What the chrome's type and the old cards used: none of it belongs on the Ledger. */
const FORBIDDEN_TYPE =
  /(?:^|[\s:])!?(?:label-mono|font-mono|uppercase|tracking-label|text-(?:label|stat|display|hero|xs|\[1[01]px\])|font-bold|font-extrabold|font-black)!?(?=[\s/]|$)/;

beforeEach(() => {
  h.loadCertifications.mockReset();
  h.loadCertifications.mockResolvedValue(CERTS);
});

afterEach(cleanup);

describe('/certifications header', () => {
  it('has one h1, the earliest month as its subline, and figures from the data', async () => {
    const { container } = await renderPage();
    // A description list has no ARIA role to query by; it is named by its aria-label.
    const totals = container.querySelector<HTMLElement>('dl[aria-label="Totals"]') as HTMLElement;
    const figure = (label: string): string | null =>
      within(totals).getByText(label).parentElement?.querySelector('dd')?.textContent ?? null;

    expect(screen.getAllByRole('heading', { level: 1 }).map((x) => x.textContent)).toEqual([
      'Certifications',
    ]);
    expect(screen.getByText('Courses and certificates since July 2022.')).toBeInTheDocument();
    expect(figure('certificates')).toBe('7');
    // Google and Google Cloud Skills Boost are one company, Microsoft and its ambassadors another.
    expect(figure('issuers')).toBe('4');
    expect(figure('with a link')).toBe('6');
  });
});

describe('the Ledger list', () => {
  it('renders every certificate as a row, grouped by year, newest first', async () => {
    await renderPage();

    expect(rowTitles()).toEqual(ALL_TITLES);
    expect(yearHeadings()).toEqual([
      '2025, 1 certificate',
      '2024, 2 certificates',
      '2023, 3 certificates',
      '2022, 1 certificate',
    ]);
  });

  it('is a real table per year, named by its heading with a pause between the two numbers', async () => {
    await renderPage();
    const tables = screen.getAllByRole('table');

    expect(tables).toHaveLength(4);
    expect(tables[1]).toHaveAccessibleName('2024, 2 certificates');
    expect(screen.getByRole('heading', { level: 2, name: '2024, 2 certificates' })).toBeVisible();
    for (const table of tables) {
      expect(
        within(table)
          .getAllByRole('columnheader')
          .map((th) => th.textContent),
      ).toEqual(['Certificate', 'Issuer', 'Issued', 'Verify']);
    }
  });

  it('shows the column header row once, under the first year; later tables keep it for readers', async () => {
    await renderPage();
    const [first, ...later] = screen.getAllByRole('table') as HTMLElement[];
    const headerClasses = (table: HTMLElement | undefined): string[] =>
      Array.from(table?.querySelectorAll('th') ?? []).map((th) => th.className);

    for (const className of headerClasses(first)) {
      expect(className).not.toMatch(/clip-path/);
    }
    expect(later).toHaveLength(3);
    for (const table of later) {
      for (const className of headerClasses(table)) {
        // Visually hidden inside the table's own layout (no sr-only: an absolutely positioned
        // cell drops out of some browsers' table models), so the column keeps its header.
        expect(className).toMatch(/\[clip-path:inset\(50%\)\]/);
        expect(className).toMatch(/(?:^|\s)leading-0(?:\s|$)/);
        expect(className).not.toMatch(/(?:^|\s)(?:sr-only|hidden|absolute)(?:\s|$)/);
      }
    }
  });

  it('links a title to its credential in a new tab, as the site words new-tab links', async () => {
    await renderPage();
    const link = within(rowFor('Build Wireframes')).getByRole('link', {
      name: `Build Wireframes${NEW_TAB}`,
    });

    expect(link).toHaveAttribute(
      'href',
      'https://www.coursera.org/account/accomplishments/records/W5LT6G2556LY',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows issuer as written, the month, the host and the ID in the desktop cells', async () => {
    await renderPage();
    const [, issuer, issued, verify] = within(rowFor('BigQuery Basics')).getAllByRole('cell');
    const month = within(issued as HTMLElement).getByText('Jun 2023');

    expect(issuer).toHaveTextContent('Google Cloud Skills Boost');
    expect(month.tagName).toBe('TIME');
    expect(month).toHaveAttribute('datetime', '2023-06');
    expect(verify).toHaveTextContent('cloudskillsboost.google');
    const id = within(rowFor('Complete React Developer')).getByText('UC-5ba0a391');
    expect(id).toHaveClass('mono-token');
    // The ID shows wherever the Verify column is wide enough for it: from a 48rem page.
    expect(id.className).toMatch(/@min-\[48rem\]\/page:block/);
  });

  it('gives screen readers the Verify cell’s host and names the ID', async () => {
    await renderPage();
    const verifyOf = (title: string): HTMLElement =>
      within(rowFor(title)).getAllByRole('cell')[3] as HTMLElement;

    expect(
      within(verifyOf('BigQuery Basics')).getByText('cloudskillsboost.google', READ_ALOUD),
    ).toHaveClass('sr-only');
    const withId = verifyOf('Complete React Developer');
    expect(within(withId).getByText('udemy.com', READ_ALOUD)).toBeInTheDocument();
    expect(within(withId).getByText('Credential ID', READ_ALOUD)).toHaveClass('sr-only');
  });

  it('truncates a long host’s text but never its new-tab arrow', async () => {
    await renderPage();
    const verify = within(rowFor('BigQuery Basics')).getAllByRole('cell')[3] as HTMLElement;
    const host = verify.querySelector('a') as HTMLAnchorElement;
    const arrow = host.querySelector('[data-new-tab-arrow]') as HTMLElement;
    const text = within(host).getByText('cloudskillsboost.google');

    expect(host).not.toHaveClass('truncate');
    expect(text).toHaveClass('truncate', 'min-w-0');
    expect(arrow.parentElement).toBe(host);
    expect(arrow).toHaveClass('shrink-0');
  });

  it('keeps the host link out of the tab order: the title already goes there', async () => {
    await renderPage();
    const row = rowFor('Build Wireframes');
    const host = (within(row).getAllByRole('cell')[3] as HTMLElement).querySelector('a');

    expect(host).toHaveTextContent('coursera.org');
    expect(host).toHaveAttribute('tabindex', '-1');
    expect(host).toHaveAttribute('aria-hidden', 'true');
    expect(host?.getAttribute('href')).toBe(row.querySelector('a')?.getAttribute('href'));
  });

  it('says No link, and links nothing, for a certificate without a credential URL', async () => {
    await renderPage();
    const row = rowFor('Perform Cloud Data Science');

    expect(within(row).queryByRole('link')).toBeNull();
    expect(within(row).getByText('No link')).toBeInTheDocument();
  });

  // CodeRabbit on #613: an ID is still how a visitor verifies a credential by hand.
  it('still shows the credential ID, named, when there is no URL', async () => {
    h.loadCertifications.mockResolvedValue([
      ...CERTS,
      makeCertification({
        title: 'Proctored Exam',
        issuer: 'IBM',
        issueDate: '2024-03-01',
        order: 99,
        credentialUrl: null,
        credentialId: 'EXAM-42',
      }),
    ]);
    await renderPage();
    const row = rowFor('Proctored Exam');

    expect(within(row).queryByRole('link')).toBeNull();
    expect(within(row).getByText('No link')).toBeInTheDocument();
    expect(row).toHaveTextContent(/Credential ID\s*EXAM-42/);
  });

  it('lists the split skills under the title, and the phone meta line under that', async () => {
    await renderPage();
    const row = rowFor('Complete React Developer');

    expect(
      within(row).getByText('Cascading Style Sheets (CSS) · Redux.js · React.js'),
    ).toBeInTheDocument();
    expect(within(row).getByText('Udemy · Sep 2023 · udemy.com')).toBeInTheDocument();
    expect(
      within(rowFor('Perform Cloud Data Science')).getByText('Microsoft · Dec 2024'),
    ).toBeInTheDocument();
  });
});

describe('the Featured row', () => {
  it('is left out entirely when nothing is featured', async () => {
    const { container } = await renderPage();

    expect(screen.queryByRole('heading', { name: 'Featured' })).toBeNull();
    expect(container.querySelector('[data-featured]')).toBeNull();
  });

  it('shows up to four featured certificates in display order', async () => {
    h.loadCertifications.mockResolvedValue(
      CERTS.map((c) => ({ ...c, featured: c.title !== 'Build Wireframes' })),
    );
    await renderPage();
    const section = screen.getByRole('region', { name: 'Featured' });
    const tiles = within(section).getAllByRole('listitem');

    expect(tiles.map((tile) => within(tile).getByRole('heading', { level: 3 }))).toHaveLength(4);
    expect(
      tiles.map((tile) => {
        const heading = within(tile).getByRole('heading', { level: 3 });
        return heading.querySelector('a, span')?.firstChild?.textContent;
      }),
    ).toEqual([
      'Qiskit Global Summer School 2025',
      'Perform Cloud Data Science with Azure Machine Learning',
      'Complete React Developer',
      'BigQuery Basics',
    ]);
    const qiskit = tiles[0] as HTMLElement;
    expect(within(qiskit).getByText('IBM')).toBeInTheDocument();
    expect(within(qiskit).getByText('Aug 2025')).toBeInTheDocument();
    expect(within(qiskit).getByText('credly.com')).toBeInTheDocument();
    expect(
      within(qiskit).getByRole('link', { name: `Qiskit Global Summer School 2025${NEW_TAB}` }),
    ).toHaveAttribute('href', 'https://www.credly.com/badges/abc/linked_in_profile');
  });
});

describe('server rendering and module boundaries', () => {
  // Owner decision (2026-11-07): no skeleton for this route. With a loading.tsx React streams the
  // rows into a hidden segment behind it, so visitors without JavaScript, crawlers and link
  // previews saw only the skeleton, and a Featured row the skeleton cannot predict would jump.
  it('has no loading.tsx, so the whole Ledger is in the HTML as it arrives', () => {
    const present = ['loading.tsx', 'loading.ts', 'loading.jsx', 'loading.js'].filter((file) =>
      existsSync(join(process.cwd(), C_DIR, file)),
    );

    expect(present).toEqual([]);
  });

  it('server-renders every title, the filters applied, nothing hidden at opacity 0', async () => {
    const all = renderToString(await CertificationsPage({ searchParams: Promise.resolve({}) }));
    const google = renderToString(
      await CertificationsPage({ searchParams: Promise.resolve({ issuer: 'google' }) }),
    );

    for (const title of ALL_TITLES) expect(all).toContain(title);
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

  it('says so when there are no certificates at all, with no toolbar', async () => {
    h.loadCertifications.mockResolvedValue([]);
    await renderPage();
    const empty = screen.getByText('No certificates are listed yet.');

    // The designed empty state, under the tile state contract like the filtered one.
    expect(empty.closest('[data-state="empty"]')).not.toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Certifications');
  });

  it('sets no upper case, mono face (but the IDs) or bold weight anywhere on the page', async () => {
    h.loadCertifications.mockResolvedValue(CERTS.map((c) => ({ ...c, featured: true })));
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
      expect(source, file).not.toMatch(/magic-card|next\/image|from 'nuqs'/);
    }
  });
});
