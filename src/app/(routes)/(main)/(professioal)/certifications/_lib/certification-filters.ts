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
 * @file /certifications on the shared filter schema: ?issuer (a family slug, Other, or a raw
 * issuer string from an old shared link) and ?skill (any one skill, in any case), plus ?q over
 * titles, issuers and skills. It reads every URL exactly as the Ledger's resolveFilters does
 * (certification-filters.test.ts holds the two together), so the FilterBar parts can count the
 * chips disjunctively and word the empty state while the island's URL sync stays on the
 * Ledger's own hook. Pure and server-safe; built per ledger, whose families and skills it reads.
 */

import { defineFilters, type FilterSchema, type FilterState, ownValue } from '@/lib/filters';
import { CERTIFICATIONS_PATH, chipFilter, type LedgerFilters, QUERY_MAX_LENGTH } from './filters';
import { slugOf } from './format';
import { ALL_SLUG, type IssuerFilter, type Ledger, type LedgerEntry, OTHER_SLUG } from './ledger';

/** The facets: the issuer chips, and the skill a shared link can carry. */
export type CertificationFacet = 'issuer' | 'skill';
/** What the schema reads of a certificate. */
export type CertificationItem = Pick<LedgerEntry, 'familySlug' | 'chip' | 'skills' | 'haystack'>;
/** What the schema is built from: the ledger's chips and lookups. */
export type CertificationLookups = Pick<Ledger, 'chips' | 'other' | 'index'>;
export type CertificationState = FilterState<CertificationFacet>;
export type CertificationSchema<T extends CertificationItem = CertificationItem> = FilterSchema<
  T,
  CertificationFacet
>;

export const CERTIFICATION_NOUN = { one: 'certificate', many: 'certificates' } as const;

/** The issuer filter the Ledger's hook takes for a slug: a family, Other, or null. */
export function issuerFilterOf(
  slug: string,
  { other, index }: Pick<Ledger, 'other' | 'index'>,
): IssuerFilter | null {
  if (slug === OTHER_SLUG) return other ? chipFilter(other) : null;
  return ownValue(index.families, slug) ?? null;
}

/** The Ledger's filters as the schema's state. */
export const ledgerStateOf = ({ issuer, skill, q }: LedgerFilters): CertificationState => ({
  q,
  issuer: issuer ? [issuer.slug] : [],
  skill: skill ? [skill] : [],
});

/** ?issuer as the Ledger reads it: a family slug, 'other', or a raw issuer string's family. */
function resolveIssuer(raw: string, { other, index }: CertificationLookups): string | null {
  const slug = slugOf(raw);
  if (slug === '' || slug === ALL_SLUG) return null;
  if (slug === OTHER_SLUG) return other ? OTHER_SLUG : null;
  const family = ownValue(index.families, slug) ? slug : ownValue(index.issuers, slug);
  return family !== undefined && ownValue(index.families, family) ? family : null;
}

/** The /certifications filter schema for this ledger, over any rows that carry a certificate's fields. */
export function certificationFilters<T extends CertificationItem = CertificationItem>(
  lookups: CertificationLookups,
): CertificationSchema<T> {
  const { chips, other, index } = lookups;
  /** A skill as the ledger first writes it (its index is keyed in lower case), else as given. */
  const skillOf = (skill: string): string => ownValue(index.skills, skill.toLowerCase()) ?? skill;
  return defineFilters<T, CertificationFacet>({
    path: CERTIFICATIONS_PATH,
    noun: CERTIFICATION_NOUN,
    search: { haystack: (entry) => entry.haystack, maxLength: QUERY_MAX_LENGTH },
    facets: {
      issuer: {
        label: 'Issuer',
        /** A one-off issuer is itself and Other, so both ?issuer=ibm and ?issuer=other keep it. */
        valuesOf: (entry) =>
          entry.chip === OTHER_SLUG ? [entry.familySlug, OTHER_SLUG] : [entry.familySlug],
        /** Other's chip label ('Other' when the ledger has none), a family's label, or the slug. */
        labelOf: (slug) =>
          slug === OTHER_SLUG
            ? (other?.label ?? 'Other')
            : (ownValue(index.families, slug)?.label ?? slug),
        values: [...chips.map((chip) => chip.slug), ...(other ? [OTHER_SLUG] : [])],
        /** The chip a family shows under: its own, or Other for a one-off issuer (?issuer=ibm). */
        groupOf: (slug) => ownValue(index.families, slug)?.chip ?? null,
        resolve: (raw) => resolveIssuer(raw, lookups),
        scope: (labels) => `from ${labels.join(' or ')}`,
      },
      skill: {
        label: 'Skill',
        valuesOf: (entry) => entry.skills.map(skillOf),
        labelOf: (skill) => skill,
        /** ?skill in any case, as the ledger writes it; a skill no certificate has is dropped. */
        resolve: (raw) => ownValue(index.skills, raw.toLowerCase()) ?? null,
        scope: (labels) => `with ${labels.join(' or ')}`,
      },
    },
  });
}
