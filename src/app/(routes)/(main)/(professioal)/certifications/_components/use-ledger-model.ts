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

'use client';

/**
 * @file The adapter between the Ledger's own URL sync (use-ledger-filters.ts, which handles Back,
 * Forward, shared links and same-tick navigations, each pinned by tests) and the shared FilterBar
 * parts, which read only a FilterModel. The sync stays as it is; this hook only translates: the
 * hook's issuer and skill become the schema's state, the schema counts the chips disjunctively
 * and words the status and empty state, and the parts' setters call the hook's. Links keep the
 * Ledger's URL format (URLSearchParams, issuer, skill, q), so a link, the GET form and an
 * in-place change still write byte-identical URLs.
 */

import { useMemo } from 'react';

import { type BuiltFilterModel, buildFilterModel } from '@/components/console/filter-bar';
import type { FilterPatch } from '@/lib/filters';
import {
  type CertificationFacet,
  type CertificationLookups,
  type CertificationState,
  certificationFilters,
  issuerFilterOf,
  ledgerStateOf,
} from '../_lib/certification-filters';
import { filtersHref, type LedgerFilters, normaliseQuery } from '../_lib/filters';
import type { LedgerRowItem } from './ledger-years';
import { useLedgerFilters } from './use-ledger-filters';

/** A patch's value for one key: its first value, null to clear, or the current one. */
function patched(
  patch: FilterPatch<CertificationFacet>,
  key: CertificationFacet | 'q',
  current: string | null,
): string | null {
  if (!Object.hasOwn(patch, key)) return current;
  const value = patch[key];
  return (typeof value === 'string' ? value : value?.[0]) ?? null;
}

/** The FilterModel for /certifications, on the Ledger's URL sync, and the rows it keeps. */
export function useLedgerModel(
  rows: readonly LedgerRowItem[],
  lookups: CertificationLookups,
  initial: LedgerFilters,
): BuiltFilterModel<LedgerRowItem> {
  const filters = useLedgerFilters(lookups, initial);
  const schema = useMemo(() => certificationFilters<LedgerRowItem>(lookups), [lookups]);
  const { choices, query } = filters;
  const draft: CertificationState = {
    ...ledgerStateOf({ ...choices, q: '' }),
    q: query,
  };

  const choose = (key: CertificationFacet, slug: string | null): void =>
    key === 'issuer'
      ? filters.choose({
          issuer: slug === null ? null : issuerFilterOf(slug, lookups),
          skill: choices.skill,
        })
      : filters.choose({ issuer: choices.issuer, skill: slug });

  return buildFilterModel({
    schema,
    items: rows,
    draft,
    active: ledgerStateOf(filters.active),
    touched: filters.touched,
    actions: {
      setQuery: filters.search,
      submit: filters.submit,
      choose,
      toggle: (key, slug) => choose(key, draft[key].includes(slug) ? null : slug),
      clearAll: filters.clearAll,
    },
    hrefFor: (patch) =>
      filtersHref({
        issuer: patched(patch, 'issuer', choices.issuer?.slug ?? null),
        skill: patched(patch, 'skill', choices.skill),
        q: patched(patch, 'q', normaliseQuery(query)),
      }),
  });
}
