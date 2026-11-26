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

import type { ReactElement } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { DEFAULT_QUERY_MAX_LENGTH } from '@/lib/filters/normalise';
import type {
  FreeBookCategorySummary,
  FreeBookFormat,
  FreeBookSource,
} from '@/lib/free-books/types';
import { cn } from '@/lib/utils';

const FORMAT_FILTERS: readonly ('all' | FreeBookFormat)[] = ['all', 'PDF', 'HTML', 'EPUB'];

export interface FreeBooksFiltersProps {
  readonly draftQuery: string;
  readonly onSearchChange: (value: string) => void;
  readonly onSearchSubmit: (value: string) => void;
  readonly source: 'all' | FreeBookSource;
  readonly onSourceChange: (source: 'all' | FreeBookSource) => void;
  readonly format: 'all' | FreeBookFormat;
  readonly onFormatChange: (format: 'all' | FreeBookFormat) => void;
  readonly category: string;
  readonly onCategoryChange: (category: string) => void;
  readonly visibleCategories: readonly FreeBookCategorySummary[];
  readonly topCategories: readonly FreeBookCategorySummary[];
  readonly totalCatalogBooks: number;
  readonly langsCount: number;
  readonly subjectsCount: number;
  readonly verified: boolean;
  readonly onVerifiedChange: (checked: boolean) => void;
  readonly https: boolean;
  readonly onHttpsChange: (checked: boolean) => void;
  readonly hideUnavailable: boolean;
  readonly onHideUnavailableChange: (checked: boolean) => void;
  readonly hideArchived: boolean;
  readonly onHideArchivedChange: (checked: boolean) => void;
  readonly hideWip: boolean;
  readonly onHideWipChange: (checked: boolean) => void;
}

/** Search input, source tabs, format pills, category picker, safety toggles, and top category chips. */
export function FreeBooksFilters({
  draftQuery,
  onSearchChange,
  onSearchSubmit,
  source,
  onSourceChange,
  format,
  onFormatChange,
  category,
  onCategoryChange,
  visibleCategories,
  topCategories,
  totalCatalogBooks,
  langsCount,
  subjectsCount,
  verified,
  onVerifiedChange,
  https,
  onHttpsChange,
  hideUnavailable,
  onHideUnavailableChange,
  hideArchived,
  onHideArchivedChange,
  hideWip,
  onHideWipChange,
}: FreeBooksFiltersProps): ReactElement {
  return (
    <div className="space-y-4 rounded-tile border border-hairline bg-surface-1 p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <search className="flex-1">
          <form
            className="relative"
            onSubmit={(event) => {
              event.preventDefault();
              onSearchSubmit(draftQuery);
            }}
          >
            <FiSearch
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint"
            />
            <input
              type="search"
              value={draftQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              maxLength={DEFAULT_QUERY_MAX_LENGTH}
              autoComplete="off"
              enterKeyHint="search"
              spellCheck={false}
              placeholder="Search title, author, language, or subject (e.g. Rust, Algorithms, OSTEP)..."
              aria-label="Search free programming books"
              className="h-10 w-full rounded-lg border border-hairline bg-canvas pl-10 pr-9 text-body-sm text-foreground placeholder:text-faint focus-visible:border-brand-rim focus-visible:outline-2 focus-visible:outline-focus"
            />
            {draftQuery && (
              <button
                type="button"
                onClick={() => onSearchSubmit('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-2.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-faint hover:bg-surface-2 hover:text-foreground"
              >
                <FiX className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </form>
        </search>

        <fieldset
          aria-label="Book index source"
          className="m-0 inline-flex flex-wrap items-center gap-1 rounded-full border border-hairline bg-canvas p-1"
        >
          {(
            [
              { id: 'all', label: 'All', count: totalCatalogBooks },
              { id: 'langs', label: 'Languages', count: langsCount },
              { id: 'subjects', label: 'Subjects', count: subjectsCount },
            ] as const
          ).map((tab) => {
            const active = source === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSourceChange(tab.id)}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-label font-medium transition-colors',
                  active
                    ? 'border border-brand-edge bg-brand-subtle text-foreground'
                    : 'border border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <span>{tab.label}</span>
                <span className="tabular-nums text-faint">{tab.count}</span>
              </button>
            );
          })}
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <fieldset
            aria-label="Filter by format"
            className="m-0 inline-flex flex-wrap items-center gap-1 rounded-full border border-hairline bg-canvas p-1"
          >
            {FORMAT_FILTERS.map((fmt) => {
              const active = format === fmt;
              return (
                <button
                  key={fmt}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onFormatChange(fmt)}
                  className={cn(
                    'inline-flex h-7 items-center rounded-full px-2.5 font-mono text-[11px] font-medium transition-colors',
                    active
                      ? 'border border-brand-edge bg-brand-subtle text-foreground'
                      : 'border border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {fmt === 'all' ? 'All formats' : fmt}
                </button>
              );
            })}
          </fieldset>

          <label className="inline-flex items-center gap-2">
            <span className="sr-only">Category</span>
            <select
              aria-label="Filter by language or subject"
              value={category}
              onChange={(event) => onCategoryChange(event.target.value)}
              className="h-9 max-w-[240px] rounded-lg border border-hairline bg-canvas px-3 text-label text-foreground focus-visible:border-brand-rim focus-visible:outline-2 focus-visible:outline-focus"
            >
              <option value="all">
                All{' '}
                {source === 'langs'
                  ? 'languages'
                  : source === 'subjects'
                    ? 'subjects'
                    : 'categories'}{' '}
                ({visibleCategories.length})
              </option>
              {visibleCategories.map((item) => (
                <option key={`${item.source}-${item.name}`} value={item.name}>
                  {item.name} ({item.count})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-label text-muted-foreground">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={verified}
              onChange={(event) => onVerifiedChange(event.target.checked)}
              className="size-3.5 accent-[var(--brand)]"
            />
            <span>Verified hosts only</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={https}
              onChange={(event) => onHttpsChange(event.target.checked)}
              className="size-3.5 accent-[var(--brand)]"
            />
            <span>HTTPS only</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={hideUnavailable}
              onChange={(event) => onHideUnavailableChange(event.target.checked)}
              className="size-3.5 accent-[var(--brand)]"
            />
            <span>Hide unavailable</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={hideArchived}
              onChange={(event) => onHideArchivedChange(event.target.checked)}
              className="size-3.5 accent-[var(--brand)]"
            />
            <span>Hide archived</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={hideWip}
              onChange={(event) => onHideWipChange(event.target.checked)}
              className="size-3.5 accent-[var(--brand)]"
            />
            <span>Hide in-progress</span>
          </label>
        </div>
      </div>

      {topCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-hairline pt-3">
          <button
            type="button"
            onClick={() => onCategoryChange('all')}
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px] transition-colors',
              category === 'all'
                ? 'border-brand-edge bg-brand-subtle text-foreground'
                : 'border-hairline bg-canvas text-muted-foreground hover:border-hairline-strong hover:text-foreground',
            )}
          >
            All
          </button>
          {topCategories.map((item) => {
            const active = category.toLowerCase() === item.name.toLowerCase();
            return (
              <button
                key={`${item.source}-${item.name}`}
                type="button"
                onClick={() => onCategoryChange(active ? 'all' : item.name)}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition-colors',
                  active
                    ? 'border-brand-edge bg-brand-subtle text-foreground'
                    : 'border-hairline bg-canvas text-muted-foreground hover:border-hairline-strong hover:text-foreground',
                )}
              >
                <span>{item.name}</span>
                <span className="font-mono text-[11px] tabular-nums text-faint">{item.count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
