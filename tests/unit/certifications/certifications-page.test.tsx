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
 * @file /certifications renders on the server from loadCertifications(): every certification is
 * in the HTML, grouped by issuer, with no entrance animation hiding it. The search, issuer and
 * skill filters live in the URL (?q, ?issuer, ?skill), so a filtered view can be shared and
 * survives Back; a value that is not among the options shows everything.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { makeCertification } from '@tests/fixtures/sanity-docs';
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
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
// client.ts require()s '@/env' at load; the page only needs the image URL builder.
vi.mock('@/lib/sanity/client', async () => {
  const { createImageUrlBuilder } = await import('@sanity/image-url');
  const builder = createImageUrlBuilder({ projectId: 'test', dataset: 'test' });
  return { urlFor: (source: Parameters<typeof builder.image>[0]) => builder.image(source) };
});

import {
  CertificationsPageSkeleton,
  toCertificationCard,
} from '@/app/(routes)/(main)/(professioal)/certifications/_interface/certifications/certifications';
import CertificationsPage from '@/app/(routes)/(main)/(professioal)/certifications/page';

const C_DIR = 'src/app/(routes)/(main)/(professioal)/certifications';
const EXPLORER_FILE = `${C_DIR}/_components/certifications-explorer.tsx`;
const WRAPPER_FILE = `${C_DIR}/_interface/certifications/certifications.tsx`;

const GOOGLE = 'Google';
const AWS = 'Amazon Web Services';
const MICROSOFT = 'Microsoft';

const BADGE = {
  _type: 'image' as const,
  asset: { _ref: 'image-badge-800x450-png', _type: 'reference' as const },
  alt: 'Power BI badge',
};

const CERTIFICATIONS = [
  makeCertification({
    issuer: GOOGLE,
    title: 'Google Cloud Digital Leader',
    // The CMS stores some skill lists as one joined string.
    skills: ['Cloud Strategy • Networking'],
  }),
  makeCertification({ issuer: GOOGLE, title: 'Google Data Analytics', skills: ['SQL'] }),
  makeCertification({ issuer: AWS, title: 'AWS Cloud Practitioner', skills: ['Cloud Strategy'] }),
  makeCertification({
    issuer: MICROSOFT,
    title: 'Azure Fundamentals',
    description: 'Core Azure services and governance.',
    credentialId: 'AZ-900-123',
  }),
  makeCertification({ issuer: MICROSOFT, title: 'Power BI Data Analyst', image: BADGE }),
];

const TITLES_BY_ISSUER: Readonly<Record<string, readonly string[]>> = {
  [GOOGLE]: ['Google Cloud Digital Leader', 'Google Data Analytics'],
  [AWS]: ['AWS Cloud Practitioner'],
  [MICROSOFT]: ['Azure Fundamentals', 'Power BI Data Analyst'],
};
const ALL_TITLES = Object.values(TITLES_BY_ISSUER).flat();

/** An `opacity: 0` style (not 0.8): what a motion entrance serializes into server HTML. */
const HIDDEN_BY_OPACITY = /opacity:\s*0(?![.\d])/;

/** The card titles inside one issuer's section, in order. */
const titlesIn = (issuer: string): string[] =>
  within(screen.getByRole('region', { name: issuer }))
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent ?? '');

const cardTitles = (): string[] =>
  screen.queryAllByRole('heading', { level: 3 }).map((heading) => heading.textContent ?? '');

/** The page at `searchParams`, with a URL that keeps what the page writes to it, as a browser's does. */
async function renderPage(searchParams = '', onUrlUpdate?: OnUrlUpdateFunction) {
  const page = await CertificationsPage();
  return render(
    <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate} hasMemory>
      {page}
    </NuqsTestingAdapter>,
  );
}

beforeEach(() => {
  h.loadCertifications.mockReset();
  h.loadCertifications.mockResolvedValue(CERTIFICATIONS);
});

afterEach(cleanup);

describe('/certifications from the server', () => {
  it('renders every certification, each under its issuer', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'My Certifications' })).toBeVisible();
    for (const [issuer, titles] of Object.entries(TITLES_BY_ISSUER)) {
      expect(titlesIn(issuer)).toEqual(titles);
    }
    expect(cardTitles()).toHaveLength(CERTIFICATIONS.length);
    expect(screen.getByText('AZ-900-123')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Power BI badge' })).toBeInTheDocument();
  });

  it('server-renders every title with nothing hidden at opacity 0', async () => {
    const html = renderToString(
      <NuqsTestingAdapter>{await CertificationsPage()}</NuqsTestingAdapter>,
    );

    for (const title of ALL_TITLES) expect(html).toContain(title);
    expect(html).not.toMatch(HIDDEN_BY_OPACITY);
  });

  it('lets a failed load reach the route error boundary instead of showing an empty list', async () => {
    h.loadCertifications.mockReset();
    h.loadCertifications.mockRejectedValue(new Error('Sanity is down'));

    await expect(CertificationsPage()).rejects.toThrow('Sanity is down');
  });
});

describe('/certifications filters in the URL', () => {
  it('?issuer=Google shows only the Google group', async () => {
    await renderPage('?issuer=Google');

    expect(titlesIn(GOOGLE)).toEqual(TITLES_BY_ISSUER[GOOGLE]);
    expect(screen.queryByRole('region', { name: AWS })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: MICROSOFT })).not.toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 5 certifications')).toBeInTheDocument();
  });

  it('?skill matches one part of a joined skill string', async () => {
    await renderPage('?skill=Networking');

    expect(cardTitles()).toEqual(['Google Cloud Digital Leader']);
  });

  it('?q filters on the server render too', async () => {
    await renderPage('?q=governance');

    expect(cardTitles()).toEqual(['Azure Fundamentals']);
  });

  it("treats an issuer or skill that is not among the options as 'all'", async () => {
    await renderPage('?issuer=Nobody&skill=Juggling');

    expect(cardTitles()).toEqual(ALL_TITLES);
    expect(screen.queryByText(/^Showing /)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('writes the search to ?q with history replace, and filters the cards', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await renderPage('', onUrlUpdate);

    fireEvent.change(screen.getByPlaceholderText('Search certifications...'), {
      target: { value: 'power' },
    });

    await waitFor(() => expect(cardTitles()).toEqual(['Power BI Data Analyst']));
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const update = onUrlUpdate.mock.calls.at(-1)?.[0];
    expect(update?.searchParams.get('q')).toBe('power');
    expect(update?.options.history).toBe('replace');
    expect(update?.options.shallow).toBe(true);
  });

  it('Clear removes every filter from the URL', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    await renderPage('?issuer=Google&q=data', onUrlUpdate);
    expect(cardTitles()).toEqual(['Google Data Analytics']);

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toBe('');
    await waitFor(() => expect(cardTitles()).toEqual(ALL_TITLES));
  });

  it('shows "No matches found" with a way out when the filters match nothing', async () => {
    await renderPage('?q=quantum');

    expect(screen.getByRole('heading', { name: 'No matches found' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear Filters' })).toBeInTheDocument();
  });

  it('shows "No certifications found" when there are none at all', async () => {
    h.loadCertifications.mockResolvedValue([]);
    await renderPage();

    expect(screen.getByRole('heading', { name: 'No certifications found' })).toBeInTheDocument();
  });
});

describe('certification cards and the loading skeleton', () => {
  it('toCertificationCard precomputes the image URL at 800x450, or null without an image', () => {
    const [withoutImage, withImage] = [CERTIFICATIONS[0], CERTIFICATIONS[4]].map((cert) =>
      toCertificationCard(cert as NonNullable<typeof cert>),
    );

    expect(withoutImage).toMatchObject({
      id: CERTIFICATIONS[0]?._id,
      issuer: GOOGLE,
      imageUrl: null,
      imageAlt: 'Google Cloud Digital Leader certification badge',
      expiryDate: null,
      credentialUrl: null,
    });
    expect(withImage?.imageUrl).toMatch(/^https:\/\/cdn\.sanity\.io\/images\/test\/test\/badge-/);
    expect(withImage?.imageUrl).toContain('w=800');
    expect(withImage?.imageUrl).toContain('h=450');
    expect(withImage?.imageAlt).toBe('Power BI badge');
  });

  it("lays the skeleton's cards out in the loaded grid's columns", async () => {
    const loaded = await renderPage();
    const loadedGrid = loaded.container.querySelector('section > .grid');
    const loadedClass = loadedGrid?.className;
    cleanup();

    const { container } = render(<CertificationsPageSkeleton />);

    expect(screen.getByRole('heading', { level: 1, name: 'My Certifications' })).toBeVisible();
    expect(screen.getByRole('status', { name: 'Loading certifications' })).toBeInTheDocument();
    const skeletonGrids = container.querySelectorAll('section > .grid');
    expect(skeletonGrids.length).toBeGreaterThan(0);
    for (const grid of skeletonGrids) expect(grid.className).toBe(loadedClass);
  });

  it('keeps Sanity, data hooks and client code out of the wrong modules', () => {
    const explorer = readFileSync(join(process.cwd(), EXPLORER_FILE), 'utf8');
    const wrapper = readFileSync(join(process.cwd(), WRAPPER_FILE), 'utf8');

    expect(explorer).toMatch(/^'use client';/);
    expect(explorer).not.toMatch(/from '@\/lib\/sanity/);
    expect(explorer).not.toMatch(/from '@\/hooks'/);
    expect(explorer).not.toMatch(/from '(?:framer-motion|motion\/react)'/);
    expect(wrapper).not.toContain("'use client'");
    expect(wrapper).not.toMatch(/from '@\/components'/);
  });
});
