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
 * @file The Ledger's toolbar, rendered by the filter island: the search (a GET form, so it works
 * without JavaScript) and the issuer chips (links, likewise). Below a 48rem page the two share
 * one row that scrolls sideways; when the current chip starts out of view there (a shared
 * ?issuer=IBM link), the row scrolls to it, never the page.
 */

import { type MouseEvent, type ReactElement, type RefObject, useEffect, useRef } from 'react';

import { CERTIFICATIONS_PATH, QUERY_MAX_LENGTH } from '../_lib/filters';
import type { IssuerChip } from '../_lib/ledger';
import { revealInScroller } from '../_lib/reveal';
import {
  CHIP_CLASS,
  CHIP_COUNT_CLASS,
  CHIP_LIST_CLASS,
  SEARCH_FIELD_CLASS,
  SEARCH_INPUT_CLASS,
  SEARCH_SLOT_CLASS,
  TOOLBAR_CLASS,
} from './ledger-classes';

/** A plain primary click; anything else (a new tab, a download) is the browser's. */
const isPlainClick = (event: MouseEvent): boolean =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/** Calls `handle` instead of following the link, for a plain click only. */
export const onPlainClick =
  (handle: () => void) =>
  (event: MouseEvent): void => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    handle();
  };

function SearchIcon(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="size-4 shrink-0"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export interface ChipItem {
  readonly chip: IssuerChip;
  readonly current: boolean;
  readonly href: string;
  readonly onSelect: () => void;
}

/** A chip is a link (it works without JavaScript); its name reads "Google 20 certificates". */
export function ChipLink({ chip, current, href, onSelect }: ChipItem): ReactElement {
  return (
    <li>
      <a
        href={href}
        data-chip={chip.slug}
        aria-current={current ? 'true' : undefined}
        className={CHIP_CLASS}
        onClick={onPlainClick(onSelect)}
      >
        {chip.label} <span className={CHIP_COUNT_CLASS}>{chip.count}</span>
        <span className="sr-only"> {chip.count === 1 ? 'certificate' : 'certificates'}</span>
      </a>
    </li>
  );
}

export interface ToolbarProps {
  readonly query: string;
  /** What the GET form carries besides ?q, so a search without JavaScript keeps the filters. */
  readonly issuerSlug: string | null;
  readonly skill: string | null;
  readonly chips: readonly ChipItem[];
  /** The chip list, for handing focus to the current chip. */
  readonly chipsRef: RefObject<HTMLUListElement | null>;
  readonly onSearch: (value: string) => void;
  readonly onSubmit: () => void;
}

type SearchFormProps = Pick<
  ToolbarProps,
  'query' | 'issuerSlug' | 'skill' | 'onSearch' | 'onSubmit'
>;

/** The search: a GET form with the other filters as hidden fields; with JavaScript, live. */
function SearchForm({
  query,
  issuerSlug,
  skill,
  onSearch,
  onSubmit,
}: SearchFormProps): ReactElement {
  return (
    <search className={SEARCH_SLOT_CLASS}>
      <form
        action={CERTIFICATIONS_PATH}
        method="get"
        className="h-full"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className={SEARCH_FIELD_CLASS}>
          <SearchIcon />
          <span className="sr-only">Search certificates</span>
          <input
            type="search"
            name="q"
            value={query}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search"
            maxLength={QUERY_MAX_LENGTH}
            autoComplete="off"
            enterKeyHint="search"
            spellCheck={false}
            className={SEARCH_INPUT_CLASS}
          />
        </label>
        {issuerSlug && <input type="hidden" name="issuer" value={issuerSlug} />}
        {skill && <input type="hidden" name="skill" value={skill} />}
      </form>
    </search>
  );
}

/** The search and the chips. */
export function Toolbar({ chips, chipsRef, ...search }: ToolbarProps): ReactElement {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const current = chips.find((item) => item.current)?.chip.slug;
  useEffect(() => {
    const toolbar = toolbarRef.current;
    const links = toolbar?.querySelectorAll<HTMLElement>('a[data-chip]') ?? [];
    const chip = Array.from(links).find((link) => link.dataset.chip === current);
    if (toolbar && chip) revealInScroller(toolbar, chip);
  }, [current]);

  return (
    <div ref={toolbarRef} data-ledger-part="toolbar" className={TOOLBAR_CLASS}>
      <SearchForm {...search} />
      <ul ref={chipsRef} aria-label="Filter by issuer" className={CHIP_LIST_CLASS}>
        {chips.map((item) => (
          <ChipLink key={item.chip.slug} {...item} />
        ))}
      </ul>
    </div>
  );
}
