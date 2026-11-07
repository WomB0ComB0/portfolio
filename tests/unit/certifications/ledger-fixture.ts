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
 * @file The Ledger selector tests' dataset: a small set with the real data's shapes (issuer
 * families, one-off issuers, joined skill strings, certificates without a link), the ledger built
 * from it, and helpers that read titles off it. Not a test file itself.
 */

import { makeCertification } from '@tests/fixtures/sanity-docs';

import {
  matchesFilters,
  type RawFilters,
  resolveFilters,
} from '@/app/(routes)/(main)/(professioal)/certifications/_lib/filters';
import { buildLedger } from '@/app/(routes)/(main)/(professioal)/certifications/_lib/ledger';

export const cert = makeCertification;

/** A small dataset with the real data's shapes: families, one-offs, joined skills, no-link rows. */
export const CERTS = [
  cert({
    title: 'Qiskit Global Summer School 2025',
    issuer: 'IBM',
    issueDate: '2025-08-01',
    order: 1,
    credentialUrl: 'https://www.credly.com/badges/abc/linked_in_profile',
  }),
  cert({
    title: 'Building AI-Powered Search',
    issuer: 'MongoDB',
    issueDate: '2025-04-01',
    order: 2,
    credentialUrl: 'https://learn.mongodb.com/c/one',
    credentialId: 'MDBoeods0fx0y',
  }),
  cert({
    title: 'Build Wireframes',
    issuer: 'Google',
    issueDate: '2024-12-01',
    order: 4,
    credentialUrl: 'https://www.coursera.org/account/accomplishments/records/W5LT6G2556LY',
    credentialId: 'W5LT6G2556LY',
  }),
  cert({
    title: 'Hack Together',
    issuer: 'Microsoft Learn Student Ambassadors',
    issueDate: '2024-12-01',
    order: 3,
  }),
  cert({
    title: 'Azure AI Fundamentals',
    issuer: 'Microsoft',
    issueDate: '2024-06-01',
    order: 6,
    credentialUrl: 'https://learn.microsoft.com/api/credentials/share/x',
    featured: true,
  }),
  cert({
    title: 'Complete React Developer',
    issuer: 'Udemy',
    issueDate: '2023-09-01',
    order: 8,
    credentialUrl: 'https://www.udemy.com/certificate/UC-1/',
    skills: ['Cascading Style Sheets (CSS) · Redux.js · React.js'],
    featured: true,
  }),
  cert({
    title: 'BigQuery Basics',
    issuer: 'Google Cloud Skills Boost',
    issueDate: '2023-06-01',
    order: 9,
    credentialUrl: 'https://www.cloudskillsboost.google/public_profiles/x/badges/1',
    skills: ['Google Cloud Platform (GCP) • SQL', 'SQL'],
  }),
  cert({
    title: 'MongoDB Basics',
    issuer: 'MongoDB',
    issueDate: '2023-04-01',
    order: 10,
    credentialUrl: 'https://learn.mongodb.com/c/two',
  }),
  cert({
    title: 'Udemy TypeScript',
    issuer: 'Udemy',
    issueDate: '2023-01-01',
    order: 12,
    credentialUrl: 'https://www.udemy.com/certificate/UC-2/',
  }),
  cert({
    title: 'React + Redux',
    issuer: 'Sololearn',
    issueDate: '2023-01-01',
    order: 11,
    credentialUrl: 'https://api2.sololearn.com/v2/certificates/CT-1/image/png',
    skills: ['Redux.js\nReact.js'],
    featured: true,
  }),
  cert({
    title: 'Postman Student Expert',
    issuer: 'Postman',
    issueDate: '2022-07-01',
    order: 13,
  }),
];

export const ledger = buildLedger(CERTS);

export const titles = (entries: readonly { title: string }[]): string[] =>
  entries.map((entry) => entry.title);

/** The titles the URL's filters keep, in the ledger's order. */
export const titlesFor = (params: RawFilters): string[] => {
  const filters = resolveFilters(params, ledger);
  return titles(ledger.entries.filter((entry) => matchesFilters(entry, filters)));
};
