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
 * @file /certifications on the shared filter schema (src/lib/filters): it reads every URL the
 * Ledger's own resolveFilters reads, keeps the same certificates, words the empty state the same
 * way, and counts the issuer chips disjunctively (with the skill and the search applied, never
 * the issuer itself). The island's URL sync stays on the Ledger's hand-written hook, so the two
 * readings must agree; this suite holds them together.
 */

import { describe, expect, it } from 'vitest';

import {
  certificationFilters,
  issuerFilterOf,
  ledgerStateOf,
} from '@/app/(routes)/(main)/(professioal)/certifications/_lib/certification-filters';
import {
  matchesFilters,
  noMatchSentence,
  type RawFilters,
  resolveFilters,
} from '@/app/(routes)/(main)/(professioal)/certifications/_lib/filters';
import { ledger, titles } from './ledger-fixture';

const schema = certificationFilters<(typeof ledger.entries)[number]>(ledger);

/** Today's URLs and shared links of every kind, including ones that resolve to nothing. */
const URLS: readonly RawFilters[] = [
  {},
  { issuer: 'google' },
  { issuer: 'Google Cloud Skills Boost' },
  { issuer: 'Microsoft Learn Student Ambassadors' },
  { issuer: 'IBM' },
  { issuer: 'ibm' },
  { issuer: 'other' },
  { issuer: 'all' },
  { issuer: 'nobody' },
  { issuer: '__proto__' },
  { skill: 'react.js' },
  { skill: 'SQL', issuer: 'google' },
  { skill: 'nothing' },
  { q: 'REACT' },
  { q: '  azure   ai ' },
  { q: 'react', skill: 'Redux.js', issuer: 'udemy' },
  { issuer: ['udemy', 'google'], q: ['redux', 'x'] },
];

describe('the schema reads a URL as the Ledger does', () => {
  it.each(URLS.map((url) => [JSON.stringify(url), url] as const))(
    '%s keeps the same certificates and stands for the same filters',
    (_name, url) => {
      const legacy = resolveFilters(url, ledger);
      const state = schema.parse(url);

      expect(state).toEqual(ledgerStateOf(legacy));
      expect(titles(schema.filter(ledger.entries, state))).toEqual(
        titles(ledger.entries.filter((entry) => matchesFilters(entry, legacy))),
      );
      expect(schema.noMatchSentence(state)).toBe(noMatchSentence(legacy));
    },
  );

  it('gives an issuer slug back as the filter the Ledger’s hook takes', () => {
    const legacyIssuer = (issuer: string) => resolveFilters({ issuer }, ledger).issuer;

    expect(issuerFilterOf('google', ledger)).toEqual(legacyIssuer('google'));
    expect(issuerFilterOf('ibm', ledger)).toEqual(legacyIssuer('IBM'));
    expect(issuerFilterOf('other', ledger)).toEqual(legacyIssuer('other'));
    expect(issuerFilterOf('nobody', ledger)).toBeNull();
  });
});

describe('the issuer chips', () => {
  const chips = (url: RawFilters): string[] =>
    schema
      .options(ledger.entries, schema.parse(url))
      .issuer.options.map(
        (option) => `${option.label} ${option.count}${option.current ? ' *' : ''}`,
      );

  it('lists the families with two or more, then Other, counted with nothing else applied', () => {
    expect(schema.options(ledger.entries, schema.empty()).issuer.all).toBe(ledger.entries.length);
    expect(chips({})).toEqual([
      ...ledger.chips.map((chip) => `${chip.label} ${chip.count}`),
      `Other ${ledger.other?.count}`,
    ]);
  });

  it('counts each chip with the skill and the search applied, never the issuer', () => {
    const options = schema.options(ledger.entries, schema.parse({ q: 'react', issuer: 'google' }));
    const option = (slug: string) => options.issuer.options.find((each) => each.slug === slug);

    // "react" is in Complete React Developer (Udemy) and React + Redux (Sololearn, under Other).
    expect(options.issuer.all).toBe(2);
    expect(option('udemy')?.count).toBe(1);
    expect(option('other')?.count).toBe(1);
    expect(option('google')).toMatchObject({ count: 0, current: true });
  });

  it('shows a one-off issuer in Other’s place while it filters', () => {
    expect(chips({ issuer: 'IBM' }).at(-1)).toBe('IBM 1 *');
  });
});
