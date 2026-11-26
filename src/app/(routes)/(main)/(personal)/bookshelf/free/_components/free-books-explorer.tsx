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
 * @file The /bookshelf/free island: the Free Library's header, stat strip, filters, table and
 * pagination, all driven by useFreeBooksQuery (URL state and the page fetches). free/page.tsx
 * renders it inside Suspense with the server-rendered first page. Guarded by
 * tests/unit/free-books/explorer.test.tsx, and kept free of server modules by
 * tests/unit/bookshelf/island-imports.test.ts.
 * Known debt: the console FilterBar and IndexTable kits (#624) are not adopted here yet.
 */

import Link from 'next/link';
import { type ReactElement, useMemo } from 'react';
import { FiArrowLeft, FiArrowUpRight } from 'react-icons/fi';
import { PageShell } from '@/components/console/page-shell';
import { StatStrip, type StatStripItem } from '@/components/console/stat-strip';
import { EBOOK_FOUNDATION_REPO_URL, type FreeBooksPageResponse } from '@/lib/free-books/types';
import { FREE_BOOKS_PAGE_SIZES, normalizeFreeBooksPageSize } from '../_lib/free-books-filters';
import { FreeBooksFilters } from './free-books-filters';
import { FreeBooksPagination } from './free-books-pagination';
import { FreeBooksTable } from './free-books-table';
import { useFreeBooksQuery } from './use-free-books-query';

export interface FreeBooksExplorerProps {
  /** Initial SSR-rendered page 1 (50 rows) + catalog summary stats & categories. */
  readonly initialPage: FreeBooksPageResponse;
}

const TOP_CATEGORY_CHIPS = 14;

/**
 * The Free Library for EbookFoundation's free programming books: URL and query state from
 * `useFreeBooksQuery`, with `FreeBooksFilters`, `FreeBooksTable` and `FreeBooksPagination`.
 */
export function FreeBooksExplorer({ initialPage }: FreeBooksExplorerProps): ReactElement {
  const {
    state,
    setState,
    draftQuery,
    handleSearchChange,
    commitSearchNow,
    pageSize,
    hideArchived,
    hideUnavailable,
    requestedPage,
    activeData,
    displayedBooks,
    totalMatched,
    totalPages,
    currentPage,
    isFetching,
    isPlaceholderData,
    isInitialNonDefaultLoading,
    isError,
    refetch,
    prefetchNextPage,
    toggleSort,
    resetFilters,
    hasActiveFilter,
  } = useFreeBooksQuery(initialPage);

  const visibleCategories = useMemo(
    () =>
      activeData.categories.filter((item) =>
        state.source === 'all' ? true : item.source === state.source,
      ),
    [activeData.categories, state.source],
  );

  const topCategories = useMemo(
    () => visibleCategories.slice(0, TOP_CATEGORY_CHIPS),
    [visibleCategories],
  );

  const statItems = useMemo<readonly StatStripItem[]>(
    () => [
      { label: 'free books', value: activeData.totalCatalogBooks },
      { label: 'languages', value: activeData.languageCategoriesCount },
      { label: 'subjects', value: activeData.subjectCategoriesCount },
      { label: 'PDFs', value: activeData.pdfCount },
    ],
    [activeData],
  );

  const rangeStart = totalMatched === 0 ? 0 : activeData.offset + 1;
  const rangeEnd = Math.min(activeData.offset + displayedBooks.length, totalMatched);

  return (
    <PageShell
      sizing="container"
      eyebrow="Open Library Index"
      title="Free Programming Books"
      description="Searchable, URL-synced index of open-access programming books fetched incrementally from EbookFoundation/free-programming-books and screened by our live security manifest."
      stats={
        <StatStrip
          aria-label="Free programming books summary"
          items={statItems}
          sizing="container"
        />
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/bookshelf"
            prefetch={false}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-hairline bg-surface-1 px-3 tile-label text-muted-foreground no-underline transition-colors hover:border-hairline-strong hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
          >
            <FiArrowLeft className="size-4" aria-hidden="true" />
            3D Bookshelf
          </Link>
          <a
            href={EBOOK_FOUNDATION_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-hairline bg-surface-1 px-3 tile-label text-muted-foreground no-underline transition-colors hover:border-hairline-strong hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus"
          >
            EbookFoundation
            <FiArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      }
      className="pb-16"
    >
      <div className="space-y-5">
        <FreeBooksFilters
          draftQuery={draftQuery}
          onSearchChange={handleSearchChange}
          onSearchSubmit={commitSearchNow}
          source={state.source}
          onSourceChange={(source) => void setState({ source, category: 'all', page: 1 })}
          format={state.format}
          onFormatChange={(format) => void setState({ format, page: 1 })}
          category={state.category}
          onCategoryChange={(category) => void setState({ category, page: 1 })}
          visibleCategories={visibleCategories}
          topCategories={topCategories}
          totalCatalogBooks={activeData.totalCatalogBooks}
          langsCount={activeData.langsCount}
          subjectsCount={activeData.subjectsCount}
          verified={state.verified}
          onVerifiedChange={(verified) => void setState({ verified, page: 1 })}
          https={state.https}
          onHttpsChange={(https) => void setState({ https, page: 1 })}
          hideUnavailable={hideUnavailable}
          onHideUnavailableChange={(checked) => void setState({ unavailable: !checked, page: 1 })}
          hideArchived={hideArchived}
          onHideArchivedChange={(checked) => void setState({ archived: !checked, page: 1 })}
          hideWip={state.hideWip}
          onHideWipChange={(hideWip) => void setState({ hideWip, page: 1 })}
        />

        {isError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline-strong bg-[var(--down-tint)] px-4 py-2.5 tile-meta text-down"
          >
            <span>Could not refresh this page from /api/v1/books/free.</span>
            <button
              type="button"
              onClick={() => {
                void refetch();
              }}
              className="underline underline-offset-4 hover:text-foreground"
            >
              Try again
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="tile-meta tabular-nums text-muted-foreground">
            Showing{' '}
            <span className="text-foreground">
              {rangeStart}–{rangeEnd}
            </span>{' '}
            of <span className="text-foreground">{totalMatched}</span> matching books
            {state.category !== 'all' ? ` in ${state.category}` : ''}
            {isFetching && <span className="ml-2 font-mono text-[11px] text-faint">Updating…</span>}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="tile-meta text-brand-ink underline-offset-4 hover:text-foreground hover:underline"
              >
                Reset filters
              </button>
            )}
            <label className="inline-flex items-center gap-1.5 tile-meta text-faint">
              <span>Rows</span>
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(event) => {
                  const next = normalizeFreeBooksPageSize(Number.parseInt(event.target.value, 10));
                  void setState({ perPage: next, page: 1 });
                }}
                className="h-7 rounded-md border border-hairline bg-surface-1 px-2 font-mono text-[11px] text-foreground focus-visible:border-brand-rim focus-visible:outline-2 focus-visible:outline-focus"
              >
                {FREE_BOOKS_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <FreeBooksTable
          books={displayedBooks}
          sort={state.sort}
          dir={state.dir}
          onToggleSort={toggleSort}
          onResetFilters={resetFilters}
          requestedPage={requestedPage}
          isFetching={isFetching}
          isPlaceholderData={isPlaceholderData}
          isInitialNonDefaultLoading={isInitialNonDefaultLoading}
        />

        <FreeBooksPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => void setState({ page })}
          onPrefetchNext={prefetchNextPage}
        />

        <p className="border-t border-hairline pt-4 tile-meta text-faint">
          Index sourced from{' '}
          <a
            href={activeData.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground underline-offset-4 hover:text-brand-ink hover:underline"
          >
            EbookFoundation/free-programming-books
          </a>{' '}
          ({activeData.license}) · Screened via{' '}
          {activeData.manifestSource === 'redis'
            ? 'live Redis security overlay'
            : 'bundled security manifest'}
          {activeData.quarantinedCount > 0 ? ` (${activeData.quarantinedCount} quarantined)` : ''} ·
          Incremental JSON API at{' '}
          <code className="font-mono text-muted-foreground">/api/v1/books/free</code>.
        </p>
      </div>
    </PageShell>
  );
}
