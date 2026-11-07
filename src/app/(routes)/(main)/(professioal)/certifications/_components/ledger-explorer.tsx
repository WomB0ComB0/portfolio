'use client';

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
 * @file The Ledger's one client island: the search, the issuer chips, the skill line and the year
 * tables. The rows are server-rendered markup it only arranges. Its filters come from the URL
 * (use-ledger-filters.ts), so the server HTML of a shared link is already filtered, the chips are
 * links and the search is a GET form. The route has no loading.tsx (owner decision), so without
 * JavaScript the filtered rows show as they arrive, and the links and the form still filter.
 *
 * With JavaScript a chip or a keystroke filters in place and rewrites the URL with
 * history.replaceState, instead of a navigation that renders the page again. A modified click
 * (a new tab) is left to the browser. When Clear removes the filter it sits on, focus moves to
 * the current chip and the status line says every certificate is back.
 */

import { type ReactElement, useEffect, useMemo, useRef } from 'react';

import {
  CERTIFICATIONS_PATH,
  chipFilter,
  filtersHref,
  type LedgerFilters,
  matchesFilters,
  noMatchSentence,
  normaliseQuery,
  statusText,
} from '../_lib/filters';
import {
  ALL_SLUG,
  type IssuerChip,
  type IssuerFilter,
  type LedgerIndex,
  OTHER_SLUG,
} from '../_lib/ledger';
import { EMPTY_CLASS, LIST_CLASS } from './ledger-classes';
import { type ChipItem, onPlainClick, Toolbar } from './ledger-toolbar';
import { type LedgerRowItem, YearTables } from './ledger-years';
import { type LedgerChoices, useLedgerFilters } from './use-ledger-filters';

export type { LedgerRowItem } from './ledger-years';

const LINK_CLASS = 'text-brand-ink underline-offset-4 hover:underline';

export interface LedgerExplorerProps {
  /** Every certificate, newest first. */
  readonly rows: readonly LedgerRowItem[];
  readonly chips: readonly IssuerChip[];
  readonly other: IssuerChip | null;
  /** The lookups the URL's filters resolve against: families, raw issuers, skills. */
  readonly index: LedgerIndex;
  /** The server's reading of the URL, for where no router reports search params. */
  readonly initial: LedgerFilters;
}

const hrefOf = (issuer: string | null | undefined, skill: string | null, query: string): string =>
  filtersHref({ issuer, skill, q: normaliseQuery(query) });

interface ChipsInput {
  readonly chips: readonly IssuerChip[];
  readonly other: IssuerChip | null;
  readonly choices: LedgerChoices;
  readonly query: string;
  readonly total: number;
  readonly choose: (next: LedgerChoices) => void;
}

/** All, the family chips, then Other, which carries a one-off issuer's name while it filters. */
function chipItems({ chips, other, choices, query, total, choose }: ChipsInput): ChipItem[] {
  const { issuer, skill } = choices;
  const otherChip: IssuerChip | null =
    issuer?.chip === OTHER_SLUG && issuer.slug !== OTHER_SLUG ? issuer : other;
  const current = issuer?.chip ?? ALL_SLUG;
  const pick = (chip: IssuerChip): IssuerFilter => (chip === issuer ? issuer : chipFilter(chip));
  const all: ChipItem = {
    chip: { slug: ALL_SLUG, label: 'All', count: total },
    current: current === ALL_SLUG,
    href: hrefOf(null, skill, query),
    onSelect: () => choose({ issuer: null, skill }),
  };
  return [
    all,
    ...[...chips, ...(otherChip ? [otherChip] : [])].map((chip) => ({
      chip,
      current: current === (chip === otherChip ? OTHER_SLUG : chip.slug),
      href: hrefOf(chip.slug, skill, query),
      onSelect: () => choose({ issuer: pick(chip), skill }),
    })),
  ];
}

interface ClearProps {
  readonly href: string;
  readonly onClear: () => void;
}

function SkillLine({
  skill,
  href,
  onClear,
}: ClearProps & { readonly skill: string }): ReactElement {
  return (
    <p className="tile-meta text-muted-foreground">
      <span>Skill:</span> <span className="font-medium text-foreground">{skill}</span>
      {' · '}
      <a href={href} className={LINK_CLASS} onClick={onPlainClick(onClear)}>
        Clear
      </a>
    </p>
  );
}

interface NoMatchProps extends ClearProps {
  readonly filters: LedgerFilters;
  readonly total: number;
}

/** The designed empty state for filters that match nothing. */
function NoMatch({ filters, total, href, onClear }: NoMatchProps): ReactElement {
  return (
    <div data-state="empty" className={EMPTY_CLASS}>
      <h2 className="tile-title text-foreground">No certificates match</h2>
      <p className="tile-sub text-muted-foreground">
        {noMatchSentence(filters)} Clear the filters to see all {total}.
      </p>
      <a href={href} className={`tile-label ${LINK_CLASS}`} onClick={onPlainClick(onClear)}>
        Clear filters
      </a>
    </div>
  );
}

/**
 * After a Clear that removes the link it sat on, focus would fall to the page: this hands it to
 * the current chip once the cleared state has rendered.
 */
function useFocusCurrentChip() {
  const chipsRef = useRef<HTMLUListElement>(null);
  const due = useRef(false);
  useEffect(() => {
    if (!due.current) return;
    due.current = false;
    chipsRef.current?.querySelector<HTMLElement>('a[aria-current="true"]')?.focus();
  });
  const thenFocus = (clear: () => void) => () => {
    due.current = true;
    clear();
  };
  return { chipsRef, thenFocus };
}

/** The search, the chips, the skill line and the year tables. */
export function LedgerExplorer({
  rows,
  chips,
  other,
  index,
  initial,
}: LedgerExplorerProps): ReactElement {
  const lookups = useMemo(() => ({ index, other }), [index, other]);
  const filters = useLedgerFilters(lookups, initial);
  const { chipsRef, thenFocus } = useFocusCurrentChip();
  const { choices, query, active, choose } = filters;
  const shown = rows.filter((row) => matchesFilters(row, active));
  const total = rows.length;

  return (
    <div data-ledger-part="list" className={LIST_CLASS}>
      <Toolbar
        query={query}
        issuerSlug={choices.issuer?.slug ?? null}
        skill={choices.skill}
        chips={chipItems({ chips, other, choices, query, total, choose })}
        chipsRef={chipsRef}
        onSearch={filters.search}
        onSubmit={filters.submit}
      />
      {choices.skill && (
        <SkillLine
          skill={choices.skill}
          href={hrefOf(choices.issuer?.slug, null, query)}
          onClear={thenFocus(() => choose({ issuer: choices.issuer, skill: null }))}
        />
      )}
      <p role="status" className="sr-only">
        {statusText({ filters: active, shown: shown.length, total, touched: filters.touched })}
      </p>
      {shown.length > 0 ? (
        <YearTables items={shown} />
      ) : (
        <NoMatch
          filters={active}
          total={total}
          href={CERTIFICATIONS_PATH}
          onClear={thenFocus(filters.clearAll)}
        />
      )}
    </div>
  );
}
