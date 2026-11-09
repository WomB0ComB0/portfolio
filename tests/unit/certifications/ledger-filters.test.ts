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
 * @file The Ledger's URL filters, including today's shared links: ?issuer as a family slug, Other,
 * or a raw issuer string (resolved to its family; a one-off issuer filters to itself under the
 * Other chip), ?skill as one part of a joined skill string, ?q over titles, issuers and skills,
 * the URL written back from the filters and read again from a search string (what the island
 * follows when Back or a navigation changes the URL), and the words the list says about them.
 */

import { describe, expect, it } from 'vitest';

import {
  CERTIFICATIONS_PATH,
  filtersFromSearch,
  filtersHref,
  filtersQuery,
  isFiltered,
  type LedgerFilters,
  noMatchSentence,
  normaliseQuery,
  QUERY_MAX_LENGTH,
  resolveFilters,
  statusText,
} from '@/app/(routes)/(main)/(professioal)/certifications/_lib/filters';
import { ledger, titlesFor } from './ledger-fixture';

describe('resolveFilters: ?issuer', () => {
  it('takes a family slug', () => {
    expect(titlesFor({ issuer: 'google' })).toEqual(['Build Wireframes', 'BigQuery Basics']);
  });

  it('resolves a raw issuer string to its family, as today’s shared links hold', () => {
    const filters = resolveFilters({ issuer: 'Google Cloud Skills Boost' }, ledger);

    expect(filters.issuer).toEqual({ slug: 'google', label: 'Google', count: 2, chip: 'google' });
    expect(titlesFor({ issuer: 'Microsoft Learn Student Ambassadors' })).toEqual([
      'Hack Together',
      'Azure AI Fundamentals',
    ]);
  });

  it('filters a one-off issuer to itself, under the Other chip with its own name', () => {
    expect(resolveFilters({ issuer: 'IBM' }, ledger).issuer).toEqual({
      slug: 'ibm',
      label: 'IBM',
      count: 1,
      chip: 'other',
    });
    expect(titlesFor({ issuer: 'IBM' })).toEqual(['Qiskit Global Summer School 2025']);
  });

  it('?issuer=other shows every one-off issuer', () => {
    expect(titlesFor({ issuer: 'other' })).toEqual([
      'Qiskit Global Summer School 2025',
      'React + Redux',
      'Postman Student Expert',
    ]);
  });

  it.each([null, '', 'all', 'Nobody', ['Nobody', 'google']])(
    'shows everything for %j',
    (issuer) => {
      expect(resolveFilters({ issuer }, ledger).issuer).toBeNull();
    },
  );

  it('reads the first of repeated values', () => {
    expect(resolveFilters({ issuer: ['udemy', 'google'] }, ledger).issuer?.slug).toBe('udemy');
  });
});

describe('resolveFilters: ?skill and ?q', () => {
  it('?skill matches one part of a joined skill string, in any case, shown as written', () => {
    const filters = resolveFilters({ skill: 'react.JS' }, ledger);

    expect(filters.skill).toBe('React.js');
    expect(titlesFor({ skill: 'React.js' })).toEqual(['Complete React Developer', 'React + Redux']);
  });

  it('ignores a skill no certificate has, as the old page did', () => {
    expect(resolveFilters({ skill: 'Juggling' }, ledger).skill).toBeNull();
  });

  it('?q matches titles, issuers and skills, ignoring case', () => {
    expect(titlesFor({ q: 'MONGODB' })).toEqual(['Building AI-Powered Search', 'MongoDB Basics']);
    expect(titlesFor({ q: 'skills boost' })).toEqual(['BigQuery Basics']);
    expect(titlesFor({ q: 'redux.js' })).toEqual(['Complete React Developer', 'React + Redux']);
    expect(titlesFor({ q: 'quantum computing' })).toEqual([]);
  });

  it('combines the filters', () => {
    expect(titlesFor({ issuer: 'udemy', skill: 'React.js' })).toEqual(['Complete React Developer']);
    expect(titlesFor({ issuer: 'sololearn', q: 'typescript' })).toEqual([]);
  });

  it('normalises the search: trimmed, single spaces, at most the cap', () => {
    expect(normaliseQuery('  big   query ')).toBe('big query');
    expect(normaliseQuery('x'.repeat(QUERY_MAX_LENGTH + 20))).toHaveLength(QUERY_MAX_LENGTH);
    // Normalising twice gives the same answer, even when the cap lands just after a space.
    const cut = normaliseQuery(`${'x'.repeat(QUERY_MAX_LENGTH - 1)} tail`);
    expect(cut).toBe('x'.repeat(QUERY_MAX_LENGTH - 1));
    expect(normaliseQuery(cut)).toBe(cut);
    expect(normaliseQuery(undefined)).toBe('');
    expect(normaliseQuery(['a', 'b'])).toBe('a');
  });

  it('says whether anything filters', () => {
    expect(isFiltered(resolveFilters({}, ledger))).toBe(false);
    expect(isFiltered(resolveFilters({ q: '  ' }, ledger))).toBe(false);
    expect(isFiltered(resolveFilters({ skill: 'SQL' }, ledger))).toBe(true);
  });
});

describe('filtersHref', () => {
  it('writes issuer, skill and q in that order, leaving out what is empty', () => {
    expect(filtersHref({})).toBe(CERTIFICATIONS_PATH);
    expect(filtersHref({ issuer: 'google', skill: 'React.js', q: 'big query' })).toBe(
      '/certifications?issuer=google&skill=React.js&q=big+query',
    );
    expect(filtersHref({ issuer: null, skill: '', q: '  ' })).toBe('/certifications');
  });

  it('round-trips through resolveFilters', () => {
    const filters: LedgerFilters = resolveFilters(
      { issuer: 'Google Cloud Skills Boost', skill: 'sql', q: 'basics' },
      ledger,
    );
    const href = filtersHref({ issuer: filters.issuer?.slug, skill: filters.skill, q: filters.q });
    const params = new URL(href, 'https://mikeodnis.dev').searchParams;

    expect(href).toBe('/certifications?issuer=google&skill=SQL&q=basics');
    expect(
      resolveFilters(
        { issuer: params.get('issuer'), skill: params.get('skill'), q: params.get('q') },
        ledger,
      ),
    ).toEqual(filters);
  });
});

describe('filtersQuery and filtersFromSearch: the URL as the island reads and writes it', () => {
  it('writes the query part of filtersHref, as URLSearchParams serialises it', () => {
    expect(filtersQuery({})).toBe('');
    expect(filtersQuery({ issuer: 'google', skill: 'React.js', q: 'big query' })).toBe(
      'issuer=google&skill=React.js&q=big+query',
    );
    expect(filtersQuery({ issuer: 'google', q: 'big query' })).toBe(
      new URLSearchParams('issuer=google&q=big%20query').toString(),
    );
  });

  it('reads a search string as the server reads the same URL', () => {
    const search = 'issuer=Google+Cloud+Skills+Boost&skill=sql&q=%20basics%20&utm_source=x';

    expect(filtersFromSearch(search, ledger)).toEqual(
      resolveFilters({ issuer: 'Google Cloud Skills Boost', skill: 'sql', q: ' basics ' }, ledger),
    );
    expect(filtersFromSearch(`?${search}`, ledger)).toEqual(filtersFromSearch(search, ledger));
    expect(filtersFromSearch('', ledger)).toEqual(resolveFilters({}, ledger));
  });

  it('round-trips: what the island writes, it reads back as the same filters', () => {
    const filters = resolveFilters({ issuer: 'IBM', skill: 'react.js', q: 'redux' }, ledger);
    const written = filtersQuery({
      issuer: filters.issuer?.slug,
      skill: filters.skill,
      q: filters.q,
    });

    expect(filtersFromSearch(written, ledger)).toEqual(filters);
  });
});

describe('noMatchSentence: what the empty state says filtered everything out', () => {
  const words = (raw: Parameters<typeof resolveFilters>[0]): string =>
    noMatchSentence(resolveFilters(raw, ledger));

  it('names the search, then where it looked', () => {
    expect(words({ q: 'quantum' })).toBe('Nothing matches “quantum”.');
    expect(words({ q: 'quantum', issuer: 'google' })).toBe(
      'Nothing matches “quantum” from Google.',
    );
    expect(words({ q: 'quantum', issuer: 'google', skill: 'SQL' })).toBe(
      'Nothing matches “quantum” from Google with SQL.',
    );
  });

  it('without a search, says which certificates there are none of', () => {
    expect(words({ issuer: 'google', skill: 'SQL' })).toBe('No certificates from Google with SQL.');
    expect(words({ skill: 'SQL' })).toBe('No certificates with SQL.');
    expect(words({})).toBe('No certificates match.');
  });
});

describe('statusText: what the status line announces', () => {
  const none = resolveFilters({}, ledger);
  const google = resolveFilters({ issuer: 'google' }, ledger);

  it('counts what a filter shows', () => {
    expect(statusText({ filters: google, shown: 2, total: 11, touched: true })).toBe(
      'Showing 2 of 11 certificates',
    );
    expect(statusText({ filters: google, shown: 2, total: 11, touched: false })).toBe(
      'Showing 2 of 11 certificates',
    );
  });

  it('says every certificate is back once the visitor clears the last filter', () => {
    expect(statusText({ filters: none, shown: 11, total: 11, touched: true })).toBe(
      'Showing all 11 certificates',
    );
  });

  it('stays quiet on an unfiltered first load', () => {
    expect(statusText({ filters: none, shown: 11, total: 11, touched: false })).toBe('');
  });
});
