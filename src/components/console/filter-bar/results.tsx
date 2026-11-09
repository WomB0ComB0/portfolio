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
 * @file The parts around the results, outside the sticky bar: FilterBar.Count ("3 of 22
 * projects"), FilterBar.Applied (one removable token per facet value, then Clear all; each a
 * link, so they work without JavaScript), FilterBar.Status (the always-present status line screen
 * readers hear after a change), FilterBar.Empty (names what removed everything, with Clear
 * filters) and FilterBar.Results (the box a discrete change crossfades).
 *
 * Focus never falls to the page: after a token goes it moves to the next token, then the previous
 * one, then the current chip, then the search; after Clear, to the current chip or the search.
 */

import type { ReactElement, ReactNode } from 'react';

import { LiveNumber } from '@/components/console/live-number';
import { onPlainClick } from '@/lib/dom/plain-click';
import { cn } from '@/lib/utils';
import { type FilterBarRegistry, fallbackFocus, useFilterBar } from './context';
import {
  APPLIED_CLASS,
  APPLIED_LABEL_CLASS,
  APPLIED_LIST_CLASS,
  CLEAR_CLASS,
  COUNT_CLASS,
  COUNT_NUMBER_CLASS,
  EMPTY_CLASS,
  EMPTY_CLEAR_CLASS,
  EMPTY_TEXT_CLASS,
  EMPTY_TITLE_CLASS,
  RESULTS_CLASS,
  TOKEN_CLASS,
  TOKEN_KEY_CLASS,
  TOKEN_X_CLASS,
} from './filter-bar-classes';
import { CrossIcon } from './icons';
import type { FilterFacetView, FilterModel } from './model';

/** The visible count: "64 certificates", or "20 of 64 certificates" while filtered. */
export function FilterBarCount({ className }: { readonly className?: string }): ReactElement {
  const { model } = useFilterBar();
  const { noun, shown, total, filtered } = model;
  return (
    <p data-filter-part="count" className={cn(COUNT_CLASS, className)}>
      {filtered ? (
        <>
          <LiveNumber value={shown} className={COUNT_NUMBER_CLASS} /> of {total} {noun.many}
        </>
      ) : (
        <>
          {total} {total === 1 ? noun.one : noun.many}
        </>
      )}
    </p>
  );
}

interface Token {
  readonly facet: FilterFacetView;
  readonly slug: string;
  readonly label: string;
}

const tokensOf = (model: FilterModel, only?: readonly string[]): Token[] =>
  model.facets
    .filter((facet) => !only || only.includes(facet.key))
    .flatMap((facet) =>
      (model.draft[facet.key] ?? []).map((slug) => ({
        facet,
        slug,
        label:
          model.options[facet.key]?.options.find((option) => option.slug === slug)?.label ?? slug,
      })),
    );

/** After token `index` went: the token now at its place, the one before it, then the fallback. */
const nextAfterToken = (registry: FilterBarRegistry, index: number) => (): HTMLElement | null => {
  const tokens = Array.from(
    registry.applied?.querySelectorAll<HTMLElement>('a[data-filter-part="token"]') ?? [],
  );
  return tokens[index] ?? tokens[index - 1] ?? fallbackFocus(registry);
};

export interface FilterBarAppliedProps {
  /** The facets to list; every facet by default. */
  readonly facets?: readonly string[];
}

/** The applied filters, each removable, then Clear all; nothing while no facet narrows the list. */
export function FilterBarApplied({ facets }: FilterBarAppliedProps): ReactElement | null {
  const { model, registry, change } = useFilterBar();
  const tokens = tokensOf(model, facets);
  if (tokens.length === 0) return null;
  return (
    <div data-filter-part="applied" className={APPLIED_CLASS}>
      <span aria-hidden="true" className={APPLIED_LABEL_CLASS}>
        Applied
      </span>
      <ul
        ref={(element) => {
          registry.current.applied = element;
        }}
        aria-label="Applied filters"
        className={APPLIED_LIST_CLASS}
      >
        {tokens.map((token, index) => {
          const rest = (model.draft[token.facet.key] ?? []).filter((slug) => slug !== token.slug);
          return (
            <li key={`${token.facet.key}:${token.slug}`}>
              <a
                href={model.hrefFor({ [token.facet.key]: rest })}
                aria-label={`Remove ${token.facet.label}: ${token.label}`}
                data-filter-part="token"
                className={TOKEN_CLASS}
                onClick={onPlainClick(() =>
                  change(
                    (latest) => latest.toggle(token.facet.key, token.slug),
                    nextAfterToken(registry.current, index),
                  ),
                )}
              >
                <span className={TOKEN_KEY_CLASS}>{token.facet.label}:</span> {token.label}
                <CrossIcon className={TOKEN_X_CLASS} />
              </a>
            </li>
          );
        })}
      </ul>
      <a
        href={model.path}
        className={CLEAR_CLASS}
        onClick={onPlainClick(() =>
          change(
            (latest) => latest.clearAll(),
            () => fallbackFocus(registry.current),
          ),
        )}
      >
        Clear all
      </a>
    </div>
  );
}

/** The status line: in the DOM from the start (a live region must exist before it speaks). */
export function FilterBarStatus(): ReactElement {
  const { model } = useFilterBar();
  return (
    <p role="status" className="sr-only">
      {model.status}
    </p>
  );
}

export interface FilterBarEmptyProps {
  /** The heading; "No {noun} match" by default. */
  readonly title?: string;
  /** More words after the sentence. */
  readonly children?: ReactNode;
}

/** The designed empty state for filters that match nothing, with a Clear link. */
export function FilterBarEmpty({ title, children }: FilterBarEmptyProps): ReactElement {
  const { model, registry, change } = useFilterBar();
  return (
    <div data-state="empty" className={EMPTY_CLASS}>
      <h2 className={EMPTY_TITLE_CLASS}>{title ?? `No ${model.noun.many} match`}</h2>
      <p className={EMPTY_TEXT_CLASS}>
        {model.emptySentence} Clear the filters to see all {model.total}.{children}
      </p>
      <a
        href={model.path}
        className={EMPTY_CLEAR_CLASS}
        onClick={onPlainClick(() =>
          change(
            (latest) => latest.clearAll(),
            () => fallbackFocus(registry.current),
          ),
        )}
      >
        Clear filters
      </a>
    </div>
  );
}

export interface FilterBarResultsProps {
  readonly className?: string;
  readonly children: ReactNode;
}

/** The results' box: what a chip, a token or Clear crossfades. */
export function FilterBarResults({ className, children }: FilterBarResultsProps): ReactElement {
  const { registry } = useFilterBar();
  return (
    <div
      ref={(element) => {
        registry.current.results = element;
      }}
      data-filter-part="results"
      className={cn(RESULTS_CLASS, className)}
    >
      {children}
    </div>
  );
}
