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

import Link from 'next/link';
import { type ReactElement, useDeferredValue, useMemo, useState } from 'react';
import { FiArrowLeft, FiArrowUpRight, FiBookOpen, FiSearch, FiX } from 'react-icons/fi';
import { PageShell } from '@/components/console/page-shell';
import { StatStrip, type StatStripItem } from '@/components/console/stat-strip';
import {
  EBOOK_FOUNDATION_REPO_URL,
  type FreeBookFormat,
  type FreeBookSource,
  type FreeProgrammingBooksCatalog,
  filterFreeProgrammingBooks,
} from '@/lib/books/free-programming-books';
import { cn } from '@/lib/utils';

export interface FreeBooksExplorerProps {
  readonly catalog: FreeProgrammingBooksCatalog;
}

const FORMAT_FILTERS: readonly ('all' | FreeBookFormat)[] = ['all', 'PDF', 'HTML', 'EPUB'];
const PAGE_SIZE = 60;
const TOP_CATEGORY_CHIPS = 14;

/**
 * Live Console searchable directory of EbookFoundation's free programming books
 * (parsed from `free-programming-books-langs.md` and `free-programming-books-subjects.md`,
 * validated upstream via `fpb-lint` and `check-urls.yml`).
 */
export function FreeBooksExplorer({ catalog }: FreeBooksExplorerProps): ReactElement {
  const [source, setSource] = useState<'all' | FreeBookSource>('all');
  const [category, setCategory] = useState<string>('all');
  const [format, setFormat] = useState<'all' | FreeBookFormat>('all');
  const [query, setQuery] = useState<string>('');
  const [hideArchived, setHideArchived] = useState<boolean>(true);
  const [hideUnavailable, setHideUnavailable] = useState<boolean>(true);
  const [httpsOnly, setHttpsOnly] = useState<boolean>(false);
  const [verifiedHostsOnly, setVerifiedHostsOnly] = useState<boolean>(false);
  const [hideInProcess, setHideInProcess] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  const deferredQuery = useDeferredValue(query);

  const visibleCategories = useMemo(
    () => catalog.categories.filter((item) => (source === 'all' ? true : item.source === source)),
    [catalog.categories, source],
  );

  const topCategories = useMemo(
    () => visibleCategories.slice(0, TOP_CATEGORY_CHIPS),
    [visibleCategories],
  );

  const filteredBooks = useMemo(
    () =>
      filterFreeProgrammingBooks(catalog.books, {
        source,
        category,
        format,
        q: deferredQuery,
        hideArchived,
        hideInProcess,
        hideUnavailable,
        httpsOnly,
        verifiedHostsOnly,
      }),
    [
      catalog.books,
      source,
      category,
      format,
      deferredQuery,
      hideArchived,
      hideInProcess,
      hideUnavailable,
      httpsOnly,
      verifiedHostsOnly,
    ],
  );

  const displayedBooks = useMemo(
    () => filteredBooks.slice(0, visibleCount),
    [filteredBooks, visibleCount],
  );

  const statItems = useMemo<readonly StatStripItem[]>(
    () => [
      { label: 'free books', value: catalog.totalBooks },
      { label: 'languages', value: catalog.languageCategoriesCount },
      { label: 'subjects', value: catalog.subjectCategoriesCount },
      { label: 'PDFs', value: catalog.pdfCount },
    ],
    [catalog],
  );

  const resetFilters = (): void => {
    setSource('all');
    setCategory('all');
    setFormat('all');
    setQuery('');
    setHideArchived(true);
    setHideUnavailable(true);
    setHttpsOnly(false);
    setVerifiedHostsOnly(false);
    setHideInProcess(false);
    setVisibleCount(PAGE_SIZE);
  };

  const hasActiveFilter =
    source !== 'all' ||
    category !== 'all' ||
    format !== 'all' ||
    query.trim().length > 0 ||
    !hideArchived ||
    !hideUnavailable ||
    httpsOnly ||
    verifiedHostsOnly ||
    hideInProcess;

  return (
    <PageShell
      sizing="container"
      eyebrow="Open Library Index"
      title="Free Programming Books"
      description="Searchable index of open-access programming books by language and subject, synced live from EbookFoundation/free-programming-books (verified upstream via fpb-lint and URL checks)."
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
      <div className="space-y-6">
        {/* Search + Source + Format Controls */}
        <div className="space-y-4 rounded-tile border border-hairline bg-surface-1 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search box */}
            <div className="relative flex-1">
              <FiSearch
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="Search title, author, language, or subject (e.g. Rust, Algorithms, OSTEP)..."
                aria-label="Search free programming books"
                className="h-10 w-full rounded-lg border border-hairline bg-canvas pl-10 pr-9 text-body-sm text-foreground placeholder:text-faint focus-visible:border-brand-rim focus-visible:outline-2 focus-visible:outline-focus"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setVisibleCount(PAGE_SIZE);
                  }}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-faint hover:bg-surface-2 hover:text-foreground"
                >
                  <FiX className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Source segmented control */}
            <fieldset
              aria-label="Book index source"
              className="m-0 inline-flex flex-wrap items-center gap-1 rounded-full border border-hairline bg-canvas p-1"
            >
              {(
                [
                  { id: 'all', label: 'All', count: catalog.totalBooks },
                  { id: 'langs', label: 'Languages', count: catalog.langsCount },
                  { id: 'subjects', label: 'Subjects', count: catalog.subjectsCount },
                ] as const
              ).map((tab) => {
                const active = source === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setSource(tab.id);
                      setCategory('all');
                      setVisibleCount(PAGE_SIZE);
                    }}
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

          {/* Format filter + Category selector + fpb-lint flag toggles */}
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
                      onClick={() => {
                        setFormat(fmt);
                        setVisibleCount(PAGE_SIZE);
                      }}
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
                  onChange={(event) => {
                    setCategory(event.target.value);
                    setVisibleCount(PAGE_SIZE);
                  }}
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
                  checked={verifiedHostsOnly}
                  onChange={(event) => {
                    setVerifiedHostsOnly(event.target.checked);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className="size-3.5 accent-[var(--brand)]"
                />
                <span>Verified hosts only</span>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={httpsOnly}
                  onChange={(event) => {
                    setHttpsOnly(event.target.checked);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className="size-3.5 accent-[var(--brand)]"
                />
                <span>HTTPS only</span>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={hideUnavailable}
                  onChange={(event) => {
                    setHideUnavailable(event.target.checked);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className="size-3.5 accent-[var(--brand)]"
                />
                <span>Hide unavailable</span>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={hideArchived}
                  onChange={(event) => {
                    setHideArchived(event.target.checked);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className="size-3.5 accent-[var(--brand)]"
                />
                <span>Hide archived</span>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={hideInProcess}
                  onChange={(event) => {
                    setHideInProcess(event.target.checked);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className="size-3.5 accent-[var(--brand)]"
                />
                <span>Hide in-progress</span>
              </label>
            </div>
          </div>

          {/* Quick top category chips */}
          {topCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-hairline pt-3">
              <button
                type="button"
                onClick={() => {
                  setCategory('all');
                  setVisibleCount(PAGE_SIZE);
                }}
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
                    onClick={() => {
                      setCategory(active ? 'all' : item.name);
                      setVisibleCount(PAGE_SIZE);
                    }}
                    className={cn(
                      'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition-colors',
                      active
                        ? 'border-brand-edge bg-brand-subtle text-foreground'
                        : 'border-hairline bg-canvas text-muted-foreground hover:border-hairline-strong hover:text-foreground',
                    )}
                  >
                    <span>{item.name}</span>
                    <span className="font-mono text-[11px] tabular-nums text-faint">
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Results header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="tile-meta tabular-nums text-muted-foreground">
            Showing <span className="text-foreground">{displayedBooks.length}</span> of{' '}
            <span className="text-foreground">{filteredBooks.length}</span> matching books
            {category !== 'all' ? ` in ${category}` : ''}
          </p>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="tile-meta text-brand-ink underline-offset-4 hover:text-foreground hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* Book rows */}
        {displayedBooks.length === 0 ? (
          <div className="rounded-tile border border-hairline bg-surface-1 p-10 text-center">
            <p className="tile-sub text-foreground">No free books match that filter.</p>
            <p className="mt-1 tile-meta text-muted-foreground">
              Try clearing your search query or switching between Languages and Subjects.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 inline-flex h-9 items-center rounded-md border border-hairline bg-surface-2 px-3.5 tile-label text-foreground hover:border-hairline-strong"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {displayedBooks.map((book) => (
              <li
                key={book.id}
                className="group flex h-full flex-col justify-between gap-3 rounded-tile border border-hairline bg-surface-1 p-4 transition-colors hover:border-brand-rim hover:bg-surface-2"
              >
                <a
                  href={book.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  referrerPolicy="no-referrer"
                  className="space-y-1.5 no-underline focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-body-sm font-semibold leading-snug text-foreground group-hover:text-brand-ink">
                      {book.title}
                    </h2>
                    <FiArrowUpRight
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-ink"
                    />
                  </div>
                  {book.authors && (
                    <p className="line-clamp-2 text-meta text-muted-foreground">{book.authors}</p>
                  )}
                </a>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-canvas px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                      <FiBookOpen aria-hidden="true" className="size-3 text-faint" />
                      {book.category}
                      {book.subcategory ? ` / ${book.subcategory}` : ''}
                    </span>

                    {book.trustTier === 'verified' ? (
                      <span
                        title={`Verified publisher/repository host (${book.host})`}
                        className="rounded-full border border-hairline bg-[var(--live-tint)] px-2 py-0.5 font-mono text-[11px] text-[var(--live)]"
                      >
                        Verified host
                      </span>
                    ) : (
                      <span
                        title={`Independent external host (${book.host})`}
                        className="rounded-full border border-hairline bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-faint"
                      >
                        {book.host}
                      </span>
                    )}

                    {book.formats.map((fmt) => (
                      <span
                        key={fmt}
                        className="rounded-full border border-brand-edge bg-brand-subtle px-2 py-0.5 font-mono text-[11px] font-medium text-brand-ink"
                      >
                        {fmt}
                      </span>
                    ))}

                    {book.license && (
                      <span className="rounded-full border border-hairline bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-faint">
                        {book.license}
                      </span>
                    )}

                    {book.insecureTransport && (
                      <span className="rounded-full border border-hairline-strong bg-[var(--ongoing-tint)] px-2 py-0.5 font-mono text-[11px] text-[var(--ongoing)]">
                        HTTP
                      </span>
                    )}

                    {book.unavailable && (
                      <span className="rounded-full border border-hairline-strong bg-[var(--down-tint)] px-2 py-0.5 font-mono text-[11px] text-down">
                        Unavailable
                      </span>
                    )}

                    {book.inProcess && (
                      <span className="rounded-full border border-hairline-strong bg-[var(--ongoing-tint)] px-2 py-0.5 font-mono text-[11px] text-[var(--ongoing)]">
                        In progress
                      </span>
                    )}

                    {book.archived && (
                      <span className="rounded-full border border-hairline bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-faint">
                        Archived
                      </span>
                    )}

                    {book.requiresAccount && (
                      <span className="rounded-full border border-hairline bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-faint">
                        Registration
                      </span>
                    )}
                  </div>

                  {book.trustTier === 'external' && (
                    <a
                      href={`https://web.archive.org/web/*/${book.url}`}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      referrerPolicy="no-referrer"
                      title="Open archived Wayback Machine snapshot"
                      className="shrink-0 font-mono text-[11px] text-faint underline-offset-4 hover:text-brand-ink hover:underline"
                    >
                      Wayback ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Pagination / Show more */}
        {displayedBooks.length < filteredBooks.length && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-hairline bg-surface-1 px-4 tile-label text-foreground transition-colors hover:border-brand-rim hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus"
            >
              Load more ({filteredBooks.length - displayedBooks.length} remaining)
            </button>
          </div>
        )}

        {/* Attribution & security screening telemetry footer */}
        <p className="border-t border-hairline pt-4 tile-meta text-faint">
          Index sourced from{' '}
          <a
            href={catalog.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground underline-offset-4 hover:text-brand-ink hover:underline"
          >
            EbookFoundation/free-programming-books
          </a>{' '}
          ({catalog.license}) · Screened by SSRF/URL/DNSBL security gate
          {catalog.quarantinedCount > 0 ? ` (${catalog.quarantinedCount} quarantined)` : ''} · JSON
          API at <code className="font-mono text-muted-foreground">/api/v1/books/free</code>.
        </p>
      </div>
    </PageShell>
  );
}
