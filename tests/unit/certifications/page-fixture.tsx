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
 * @file The /certifications page tests' dataset and helpers: certificates with the real data's
 * shapes, the page rendered for a set of search params, and readers for its rows, chips and year
 * headings. Not a test file itself; each test file mocks the loaders and @/env before using it.
 */

import { render, screen, within } from '@testing-library/react';
import { makeCertification } from '@tests/fixtures/sanity-docs';

import CertificationsPage from '@/app/(routes)/(main)/(professioal)/certifications/page';

export const cert = makeCertification;
export const CERTS = [
  cert({
    title: 'Qiskit Global Summer School 2025',
    issuer: 'IBM',
    issueDate: '2025-08-01',
    order: 1,
    credentialUrl: 'https://www.credly.com/badges/abc/linked_in_profile',
  }),
  cert({
    title: 'Build Wireframes',
    issuer: 'Google',
    issueDate: '2024-12-01',
    order: 3,
    credentialUrl: 'https://www.coursera.org/account/accomplishments/records/W5LT6G2556LY',
    credentialId: 'W5LT6G2556LY',
  }),
  cert({
    title: 'Perform Cloud Data Science with Azure Machine Learning',
    issuer: 'Microsoft',
    issueDate: '2024-12-01',
    order: 2,
  }),
  cert({
    title: 'Complete React Developer',
    issuer: 'Udemy',
    issueDate: '2023-09-01',
    order: 5,
    credentialUrl: 'https://www.udemy.com/certificate/UC-1/',
    credentialId: 'UC-5ba0a391',
    skills: ['Cascading Style Sheets (CSS) · Redux.js · React.js'],
  }),
  cert({
    title: 'BigQuery Basics',
    issuer: 'Google Cloud Skills Boost',
    issueDate: '2023-06-01',
    order: 6,
    credentialUrl: 'https://www.cloudskillsboost.google/public_profiles/x/badges/1',
    skills: ['SQL'],
  }),
  cert({
    title: 'Microsoft Learn Ambassador',
    issuer: 'Microsoft Learn Student Ambassadors',
    issueDate: '2023-03-01',
    order: 7,
    credentialUrl: 'https://learn.microsoft.com/x',
  }),
  cert({
    title: 'Udemy TypeScript',
    issuer: 'Udemy',
    issueDate: '2022-07-01',
    order: 8,
    credentialUrl: 'https://www.udemy.com/certificate/UC-2/',
    skills: ['TypeScript\nReact.js'],
  }),
];
export const ALL_TITLES = [
  'Qiskit Global Summer School 2025',
  'Perform Cloud Data Science with Azure Machine Learning',
  'Build Wireframes',
  'Complete React Developer',
  'BigQuery Basics',
  'Microsoft Learn Ambassador',
  'Udemy TypeScript',
];
export const NEW_TAB = ' (opens in a new tab)';

export type Params = Record<string, string | string[]>;

/** The page's URL for these params, as the address bar holds it. */
export function urlOf(params: Params): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const each of [value].flat()) search.append(key, each);
  }
  const query = search.toString();
  return query ? `/certifications?${query}` : '/certifications';
}

/**
 * The page rendered on the server for `params`, with the address bar at `at` (by default the
 * same URL, as on a first visit). pushState, so a test's replaceState spy sees only the page's
 * own writes.
 */
export async function renderPage(params: Params = {}, at: string = urlOf(params)) {
  window.history.pushState(null, '', at);
  return render(await CertificationsPage({ searchParams: Promise.resolve(params) }));
}

export const rowsOf = (root: ParentNode = document): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>('tr[data-cert-row]'));
export const rowTitles = (): string[] =>
  rowsOf().map((row) => row.querySelector('[data-cert-title]')?.firstChild?.textContent ?? '');
export const rowFor = (title: string): HTMLElement => {
  const row = rowsOf().find((each) => each.textContent?.includes(title));
  if (!row) throw new Error(`no row for ${title}`);
  return row;
};
export const chips = (): HTMLElement => screen.getByRole('list', { name: 'Filter by issuer' });
export const currentChip = (): HTMLElement | undefined =>
  within(chips())
    .getAllByRole('link')
    .find((link) => link.getAttribute('aria-current') === 'true');
export const yearHeadings = (): string[] =>
  screen
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent ?? '')
    .filter((text) => /^\d{4}/.test(text));
