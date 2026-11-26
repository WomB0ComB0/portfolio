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
 * @file The Free Library's table: one row per book with its host, trust tier and formats, sortable
 * by title, category or host (aria-sort on each header), with its loading and empty states.
 * Known debt: the console FilterBar and IndexTable kits (#624) are not adopted here yet.
 */

import type { ReactElement } from 'react';
import { FiArrowDown, FiArrowUp, FiArrowUpRight } from 'react-icons/fi';
import type { FreeBookEntry, FreeBooksSortDir, FreeBooksSortField } from '@/lib/free-books/types';
import { cn } from '@/lib/utils';

export interface FreeBooksTableProps {
  readonly books: readonly FreeBookEntry[];
  readonly sort: FreeBooksSortField;
  readonly dir: FreeBooksSortDir;
  readonly onToggleSort: (field: FreeBooksSortField) => void;
  readonly onResetFilters: () => void;
  readonly requestedPage: number;
  readonly isFetching: boolean;
  readonly isPlaceholderData: boolean;
  readonly isInitialNonDefaultLoading: boolean;
}

function SortIcon({
  active,
  dir,
}: {
  readonly active: boolean;
  readonly dir: FreeBooksSortDir;
}): ReactElement {
  if (!active) {
    return (
      <span aria-hidden="true" className="text-[10px] text-faint/60">
        ↕
      </span>
    );
  }
  return dir === 'asc' ? (
    <FiArrowUp aria-hidden="true" className="size-3 text-brand-ink" />
  ) : (
    <FiArrowDown aria-hidden="true" className="size-3 text-brand-ink" />
  );
}

/** Sortable 4-column Live Console table with loading and empty states. */
export function FreeBooksTable({
  books,
  sort,
  dir,
  onToggleSort,
  onResetFilters,
  requestedPage,
  isFetching,
  isPlaceholderData,
  isInitialNonDefaultLoading,
}: FreeBooksTableProps): ReactElement {
  const ariaSortFor = (field: FreeBooksSortField): 'ascending' | 'descending' | 'none' => {
    if (sort !== field) return 'none';
    return dir === 'asc' ? 'ascending' : 'descending';
  };

  if (isInitialNonDefaultLoading) {
    return (
      <output
        aria-live="polite"
        className="block rounded-tile border border-hairline bg-surface-1 p-10 text-center"
      >
        <p className="tile-sub text-foreground">Loading matching books…</p>
        <p className="mt-1 tile-meta text-muted-foreground">
          Fetching page {requestedPage} from{' '}
          <code className="font-mono text-foreground">/api/v1/books/free</code>.
        </p>
      </output>
    );
  }

  if (books.length === 0) {
    return (
      <div className="rounded-tile border border-hairline bg-surface-1 p-10 text-center">
        <p className="tile-sub text-foreground">No free books match that filter.</p>
        <p className="mt-1 tile-meta text-muted-foreground">
          Try clearing your search query or switching between Languages and Subjects.
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-4 inline-flex h-9 items-center rounded-md border border-hairline bg-surface-2 px-3.5 tile-label text-foreground hover:border-hairline-strong"
        >
          Reset filters
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-tile border border-hairline bg-canvas transition-opacity duration-150',
        isPlaceholderData && 'opacity-70',
      )}
    >
      <table
        aria-label="Free programming books catalog"
        aria-busy={isFetching}
        className="w-full table-fixed border-separate border-spacing-0"
      >
        <colgroup>
          <col />
          <col className="hidden w-[21%] @min-[40rem]/page:table-column" />
          <col className="hidden w-[17%] @min-[40rem]/page:table-column" />
          <col className="hidden w-[22%] @min-[48rem]/page:table-column" />
        </colgroup>
        <thead className="hidden @min-[40rem]/page:table-header-group">
          <tr className="bg-surface-1">
            <th
              scope="col"
              aria-sort={ariaSortFor('title')}
              className="border-b border-hairline-strong px-3 py-2.5 text-left tile-label text-faint"
            >
              <button
                type="button"
                onClick={() => onToggleSort('title')}
                className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
              >
                <span>Book</span>
                <SortIcon active={sort === 'title'} dir={dir} />
              </button>
            </th>
            <th
              scope="col"
              aria-sort={ariaSortFor('category')}
              className="border-b border-hairline-strong px-3 py-2.5 text-left tile-label text-faint"
            >
              <button
                type="button"
                onClick={() => onToggleSort('category')}
                className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
              >
                <span>Category</span>
                <SortIcon active={sort === 'category'} dir={dir} />
              </button>
            </th>
            <th
              scope="col"
              className="border-b border-hairline-strong px-3 py-2.5 text-left tile-label text-faint"
            >
              Format &amp; Flags
            </th>
            <th
              scope="col"
              aria-sort={ariaSortFor('host')}
              className="hidden border-b border-hairline-strong px-3 py-2.5 text-left tile-label text-faint @min-[48rem]/page:table-cell"
            >
              <button
                type="button"
                onClick={() => onToggleSort('host')}
                className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
              >
                <span>Host</span>
                <SortIcon active={sort === 'host'} dir={dir} />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {books.map((book) => (
            <tr
              key={book.id}
              className="group/row relative [transform:translate(0)] transition-colors duration-100 hover:bg-surface-1 focus-within:bg-surface-1"
            >
              <td className="border-b border-hairline px-3 py-3 align-middle">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <a
                    href={book.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    referrerPolicy="no-referrer"
                    className="inline-flex max-w-full items-baseline gap-1.5 text-body-sm font-medium text-foreground no-underline after:absolute after:inset-0 after:content-[''] group-hover/row:text-brand-ink focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    <span className="truncate">{book.title}</span>
                    <FiArrowUpRight
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-faint transition-transform duration-150 group-hover/row:translate-x-0.5 group-hover/row:-translate-y-0.5 group-hover/row:text-brand-ink"
                    />
                  </a>
                  {book.authors && (
                    <span className="truncate tile-meta text-muted-foreground">{book.authors}</span>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-faint @min-[40rem]/page:hidden">
                    <span>{book.category}</span>
                    {book.formats.length > 0 && <span>· {book.formats.join(', ')}</span>}
                    <span>· {book.host}</span>
                  </div>
                </div>
              </td>

              <td className="hidden border-b border-hairline px-3 py-3 align-middle @min-[40rem]/page:table-cell">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-label text-foreground">{book.category}</span>
                  {book.subcategory && (
                    <span className="truncate font-mono text-[11px] text-faint">
                      {book.subcategory}
                    </span>
                  )}
                </div>
              </td>

              <td className="hidden border-b border-hairline px-3 py-3 align-middle @min-[40rem]/page:table-cell">
                <div className="flex flex-wrap items-center gap-1">
                  {book.formats.length > 0 ? (
                    book.formats.map((fmt) => (
                      <span
                        key={fmt}
                        className="rounded-full border border-hairline bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground"
                      >
                        {fmt}
                      </span>
                    ))
                  ) : (
                    <span className="font-mono text-[11px] text-faint">Web</span>
                  )}
                  {book.license && (
                    <span className="rounded-full border border-hairline bg-surface-1 px-1.5 py-0.5 font-mono text-[10px] text-faint">
                      {book.license}
                    </span>
                  )}
                  {book.insecureTransport && (
                    <span className="rounded-full border border-hairline bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      HTTP
                    </span>
                  )}
                  {book.unavailable && (
                    <span className="rounded-full border border-hairline bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-down">
                      Unavailable
                    </span>
                  )}
                  {book.inProcess && (
                    <span className="rounded-full border border-hairline bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-faint">
                      WIP
                    </span>
                  )}
                  {book.archived && (
                    <span className="rounded-full border border-hairline bg-surface-1 px-1.5 py-0.5 font-mono text-[10px] text-faint">
                      Archived
                    </span>
                  )}
                  {book.requiresAccount && (
                    <span className="rounded-full border border-hairline bg-surface-1 px-1.5 py-0.5 font-mono text-[10px] text-faint">
                      Account
                    </span>
                  )}
                </div>
              </td>

              <td className="hidden border-b border-hairline px-3 py-3 align-middle @min-[48rem]/page:table-cell">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span
                    title={
                      book.trustTier === 'verified'
                        ? `Verified publisher/repository host (${book.host})`
                        : `Independent external host (${book.host})`
                    }
                    className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-muted-foreground"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        book.trustTier === 'verified' ? 'bg-brand-ink' : 'bg-hairline-strong',
                      )}
                    />
                    <span className="truncate">{book.host}</span>
                  </span>
                  {book.trustTier === 'external' && (
                    <a
                      href={`https://web.archive.org/web/*/${book.url}`}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      referrerPolicy="no-referrer"
                      title="Open archived Wayback Machine snapshot"
                      className="relative z-[1] shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] text-faint no-underline transition-colors hover:bg-surface-2 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      Wayback ↗
                    </a>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
