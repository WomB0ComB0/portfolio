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
 * @file The Ledger's URL filters: ?issuer, ?skill and ?q read into filters, matched against
 * certificates, and written back as a URL. Today's shared links keep working: ?issuer takes a
 * family slug, 'other' or a raw issuer string (resolved to its family), and ?skill matches one part
 * of a joined skill string, in any case. Pure; the server and the filter island share it.
 */

import { slugOf } from './format';
import {
  ALL_SLUG,
  type IssuerChip,
  type IssuerFilter,
  type Ledger,
  type LedgerEntry,
  OTHER_SLUG,
} from './ledger';

/** The route, for links and the search form's action. */
export const CERTIFICATIONS_PATH = '/certifications';
/** The longest search the page reads from ?q or the field. */
export const QUERY_MAX_LENGTH = 100;

export interface LedgerFilters {
  readonly issuer: IssuerFilter | null;
  /** The skill as written, or null. */
  readonly skill: string | null;
  /** Normalised search text; '' matches everything. */
  readonly q: string;
}

/** A search param as Next passes it. */
export type ParamValue = string | readonly string[] | null | undefined;

export interface RawFilters {
  readonly issuer?: ParamValue;
  readonly skill?: ParamValue;
  readonly q?: ParamValue;
}

const firstOf = (value: ParamValue): string =>
  typeof value === 'string' ? value : (value?.[0] ?? '');

/** A record's own value: CMS strings never reach the prototype chain. */
const lookup = <T>(record: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.hasOwn(record, key) ? record[key] : undefined;

/** Search text as the page reads it: the first value, single-spaced, trimmed, capped. */
export function normaliseQuery(value: ParamValue): string {
  return firstOf(value).replaceAll(/\s+/g, ' ').trim().slice(0, QUERY_MAX_LENGTH);
}

/** A chip as a filter: its family, or every one-off issuer for Other. */
export const chipFilter = (chip: IssuerChip): IssuerFilter => ({ ...chip, chip: chip.slug });

function resolveIssuer(
  value: ParamValue,
  ledger: Pick<Ledger, 'index' | 'other'>,
): IssuerFilter | null {
  const slug = slugOf(firstOf(value));
  if (slug === '' || slug === ALL_SLUG) return null;
  if (slug === OTHER_SLUG) return ledger.other ? chipFilter(ledger.other) : null;
  const { families, issuers } = ledger.index;
  const familySlug = lookup(families, slug) ? slug : lookup(issuers, slug);
  return familySlug === undefined ? null : (lookup(families, familySlug) ?? null);
}

/**
 * The URL's filters. ?issuer is a family slug, 'other', or a raw issuer string (resolved to its
 * family); ?skill is any one skill, in any case. An issuer or skill the data does not have shows
 * everything, as the old page did.
 */
export function resolveFilters(
  raw: RawFilters,
  ledger: Pick<Ledger, 'index' | 'other'>,
): LedgerFilters {
  const skillKey = firstOf(raw.skill).trim().toLowerCase();
  return {
    issuer: resolveIssuer(raw.issuer, ledger),
    skill: skillKey === '' ? null : (lookup(ledger.index.skills, skillKey) ?? null),
    q: normaliseQuery(raw.q),
  };
}

/** Whether a certificate passes every active filter. */
export function matchesFilters(
  entry: Pick<LedgerEntry, 'familySlug' | 'chip' | 'skills' | 'haystack'>,
  { issuer, skill, q }: LedgerFilters,
): boolean {
  const issuerOk =
    issuer === null ||
    (issuer.slug === OTHER_SLUG ? entry.chip === OTHER_SLUG : entry.familySlug === issuer.slug);
  const skillOk =
    skill === null || entry.skills.some((each) => each.toLowerCase() === skill.toLowerCase());
  return issuerOk && skillOk && (q === '' || entry.haystack.includes(q.toLowerCase()));
}

/** Whether any filter narrows the list. */
export const isFiltered = ({ issuer, skill, q }: LedgerFilters): boolean =>
  issuer !== null || skill !== null || q !== '';

/** The values a URL carries: ?issuer as a slug, ?skill as written, ?q. */
export interface FilterValues {
  readonly issuer?: string | null;
  readonly skill?: string | null;
  readonly q?: string | null;
}

/**
 * The query part of the page's URL for these filters ('' for none): issuer, skill, q, in that
 * order, empty ones left out, serialised by URLSearchParams as the router's search params are.
 */
export function filtersQuery(filters: FilterValues): string {
  const params = new URLSearchParams();
  for (const key of ['issuer', 'skill', 'q'] as const) {
    const value = filters[key]?.trim();
    if (value) params.set(key, value);
  }
  return params.toString();
}

/** The page's URL for these filters. */
export function filtersHref(filters: FilterValues): string {
  const query = filtersQuery(filters);
  return query ? `${CERTIFICATIONS_PATH}?${query}` : CERTIFICATIONS_PATH;
}

/**
 * The filters in a search string ('issuer=google&q=react', with or without its '?'), read the way
 * the server reads the same URL: what the island follows when Back or a navigation moves the URL.
 */
export function filtersFromSearch(
  search: string,
  ledger: Pick<Ledger, 'index' | 'other'>,
): LedgerFilters {
  const params = new URLSearchParams(search);
  return resolveFilters(
    { issuer: params.get('issuer'), skill: params.get('skill'), q: params.get('q') },
    ledger,
  );
}

/**
 * What the empty state says filtered everything out: 'Nothing matches “quantum” from Google.' with
 * a search, 'No certificates from Google with SQL.' without one.
 */
export function noMatchSentence({ issuer, skill, q }: LedgerFilters): string {
  const scope = [issuer && `from ${issuer.label}`, skill && `with ${skill}`]
    .filter(Boolean)
    .join(' ');
  if (q) return `Nothing matches “${q}”${scope ? ` ${scope}` : ''}.`;
  return scope ? `No certificates ${scope}.` : 'No certificates match.';
}

export interface StatusInput {
  readonly filters: LedgerFilters;
  readonly shown: number;
  readonly total: number;
  /** Whether the visitor changed a filter on this page (a first load stays quiet). */
  readonly touched: boolean;
}

/** The status line: how many a filter shows, or that every certificate is back once cleared. */
export function statusText({ filters, shown, total, touched }: StatusInput): string {
  if (isFiltered(filters)) return `Showing ${shown} of ${total} certificates`;
  return touched ? `Showing all ${total} certificates` : '';
}
