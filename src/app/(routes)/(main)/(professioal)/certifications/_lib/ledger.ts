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
 * @file The Ledger's model: what /certifications shows, derived from the Sanity documents.
 * Certificates newest first (then Studio order), the header's stats, the issuer chips (families
 * with two or more, then Other), up to four featured certificates in display order, the lookups
 * the URL's filters resolve against, and year groups. Pure and server-safe.
 */

import type { Certification } from '@/hooks/sanity/schemas';
import {
  type CredentialLink,
  credentialLinkOf,
  familyOf,
  type Month,
  monthOf,
  skillsOf,
  slugOf,
} from './format';

/** The featured row's size: the first four featured certificates in display order. */
export const MAX_FEATURED = 4;
/** The chip that gathers every issuer with a single certificate. */
export const OTHER_SLUG = 'other';
/** The ?issuer value that means every issuer. */
export const ALL_SLUG = 'all';
/** A family needs this many certificates for a chip of its own; fewer go under Other. */
const CHIP_MIN_COUNT = 2;
/** The year group of a certificate whose issue date cannot be read. */
export const UNDATED_YEAR = 'Undated';

/** The fields the Ledger reads from a certification document. */
export type LedgerSource = Pick<
  Certification,
  '_id' | 'title' | 'issuer' | 'issueDate' | 'order' | 'credentialId' | 'credentialUrl' | 'skills'
> & { readonly featured?: boolean | null };

export interface LedgerEntry {
  readonly id: string;
  readonly title: string;
  /** As written on the credential. */
  readonly issuer: string;
  /** The company the issuer string belongs to. */
  readonly family: string;
  readonly familySlug: string;
  /** The chip the certificate counts under: its family's slug, or 'other'. */
  readonly chip: string;
  readonly month: Month | null;
  /** The year group: the month's year, or 'Undated'. */
  readonly year: string;
  readonly link: CredentialLink | null;
  readonly credentialId: string | null;
  readonly skills: readonly string[];
  readonly featured: boolean;
  /** Title, issuer and skills in lower case: what ?q searches. */
  readonly haystack: string;
}

export interface IssuerChip {
  readonly slug: string;
  readonly label: string;
  readonly count: number;
}

/** The active issuer: a family, or Other. `chip` is the slug of the chip shown as current. */
export interface IssuerFilter extends IssuerChip {
  readonly chip: string;
}

export interface LedgerStats {
  readonly certificates: number;
  /** Companies, after folding issuer strings into families. */
  readonly issuers: number;
  /** Certificates with a credential URL that can be linked. */
  readonly withLink: number;
  /** The earliest issue month ('July 2022'), or null when no date can be read. */
  readonly since: string | null;
}

/** Lookups for reading the URL: families by slug, raw issuer strings and skills by key. */
export interface LedgerIndex {
  readonly families: Readonly<Record<string, IssuerFilter>>;
  /** A raw issuer string's slug to its family's slug. */
  readonly issuers: Readonly<Record<string, string>>;
  /** A skill in lower case to the skill as written. */
  readonly skills: Readonly<Record<string, string>>;
}

export interface Ledger {
  /** Newest first: issue month descending, then Studio order. */
  readonly entries: readonly LedgerEntry[];
  /** Up to MAX_FEATURED featured certificates, in Studio display order. */
  readonly featured: readonly LedgerEntry[];
  readonly stats: LedgerStats;
  /** Families with two or more certificates: biggest first, then the newest. */
  readonly chips: readonly IssuerChip[];
  /** The one-off issuers' chip, or null when there are none. */
  readonly other: IssuerChip | null;
  readonly index: LedgerIndex;
}

/** A family's slug, kept clear of the two reserved ?issuer values. */
const familySlugOf = (family: string): string => {
  const slug = slugOf(family) || 'issuer';
  return slug === ALL_SLUG || slug === OTHER_SLUG ? `${slug}-issuer` : slug;
};

const sortKey = (source: LedgerSource): string => monthOf(source.issueDate)?.iso ?? '';

const descending = (a: string, b: string): number => (a === b ? 0 : a < b ? 1 : -1);

/** Newest month first (an unreadable date last), then Studio order. */
const byNewest = (a: LedgerSource, b: LedgerSource): number =>
  descending(sortKey(a), sortKey(b)) || a.order - b.order;

/** Studio display order, then the newest. */
const byDisplayOrder = (a: LedgerSource, b: LedgerSource): number =>
  a.order - b.order || byNewest(a, b);

interface FamilyTally {
  readonly label: string;
  readonly count: number;
  /** The family's newest month (input sorted newest first: the first one seen). */
  readonly newest: string;
}

function tallyFamilies(sorted: readonly LedgerSource[]): ReadonlyMap<string, FamilyTally> {
  const tallies = new Map<string, FamilyTally>();
  for (const source of sorted) {
    const family = familyOf(source.issuer);
    const slug = familySlugOf(family);
    const tally = tallies.get(slug);
    tallies.set(
      slug,
      tally
        ? { ...tally, count: tally.count + 1 }
        : { label: family, count: 1, newest: sortKey(source) },
    );
  }
  return tallies;
}

function toEntry(source: LedgerSource, chipOf: (familySlug: string) => string): LedgerEntry {
  const family = familyOf(source.issuer);
  const familySlug = familySlugOf(family);
  const month = monthOf(source.issueDate);
  const skills = skillsOf(source);
  return {
    id: source._id,
    title: source.title,
    issuer: source.issuer,
    family,
    familySlug,
    chip: chipOf(familySlug),
    month,
    year: month?.year ?? UNDATED_YEAR,
    link: credentialLinkOf(source.credentialUrl),
    credentialId: source.credentialId?.trim() || null,
    skills,
    featured: source.featured === true,
    haystack: [source.title, source.issuer, ...skills].join('\n').toLowerCase(),
  };
}

function buildIndex(
  entries: readonly LedgerEntry[],
  tallies: ReadonlyMap<string, FamilyTally>,
  chipOf: (familySlug: string) => string,
): LedgerIndex {
  const families = Object.fromEntries(
    [...tallies].map(([slug, { label, count }]) => [
      slug,
      { slug, label, count, chip: chipOf(slug) },
    ]),
  );
  const issuers = Object.fromEntries(
    entries.map((entry) => [slugOf(entry.issuer), entry.familySlug]),
  );
  // Reversed, so the first way a skill is written (newest first) is the one kept.
  const skills = Object.fromEntries(
    entries
      .flatMap((entry) => entry.skills)
      .reverse()
      .map((skill) => [skill.toLowerCase(), skill]),
  );
  return { families, issuers, skills };
}

/** Everything /certifications shows, from the decoded documents. */
export function buildLedger(sources: readonly LedgerSource[]): Ledger {
  const sorted = [...sources].sort(byNewest);
  const tallies = tallyFamilies(sorted);
  const chipOf = (familySlug: string): string =>
    (tallies.get(familySlug)?.count ?? 0) >= CHIP_MIN_COUNT ? familySlug : OTHER_SLUG;
  const entries = sorted.map((source) => toEntry(source, chipOf));
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  const chips = [...tallies]
    .filter(([, tally]) => tally.count >= CHIP_MIN_COUNT)
    .sort(([, a], [, b]) => b.count - a.count || descending(a.newest, b.newest))
    .map(([slug, { label, count }]) => ({ slug, label, count }));
  const otherCount = entries.filter((entry) => entry.chip === OTHER_SLUG).length;
  const featured = sorted
    .filter((source) => source.featured === true)
    .sort(byDisplayOrder)
    .slice(0, MAX_FEATURED)
    .flatMap((source) => byId.get(source._id) ?? []);
  const earliest = entries.findLast((entry) => entry.month !== null)?.month ?? null;

  return {
    entries,
    featured,
    stats: {
      certificates: entries.length,
      issuers: tallies.size,
      withLink: entries.filter((entry) => entry.link !== null).length,
      since: earliest?.long ?? null,
    },
    chips,
    other: otherCount > 0 ? { slug: OTHER_SLUG, label: 'Other', count: otherCount } : null,
    index: buildIndex(entries, tallies, chipOf),
  };
}

export interface YearGroup<T> {
  readonly year: string;
  readonly entries: readonly T[];
}

/** Entries grouped by year in the order given (newest first), each group keeping its order. */
export function groupByYear<T extends { readonly year: string }>(
  entries: readonly T[],
): YearGroup<T>[] {
  const years = [...new Set(entries.map((entry) => entry.year))];
  return years.map((year) => ({ year, entries: entries.filter((entry) => entry.year === year) }));
}
