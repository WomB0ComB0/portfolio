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
 * @file The Free Library's pager: "Page N of M" with Previous and Next buttons; hovering or
 * focusing Next prefetches that page. Renders nothing for a single page.
 */

import type { ReactElement } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export interface FreeBooksPaginationProps {
  readonly currentPage: number;
  readonly totalPages: number;
  readonly onPageChange: (page: number) => void;
  readonly onPrefetchNext: () => void;
}

/** Paginated bar with hover/focus prefetching for the next page. */
export function FreeBooksPagination({
  currentPage,
  totalPages,
  onPageChange,
  onPrefetchNext,
}: FreeBooksPaginationProps): ReactElement | null {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Free books pagination"
      className="flex flex-wrap items-center justify-between gap-3 pt-1"
    >
      <span className="tile-meta tabular-nums text-faint">
        Page <span className="text-foreground">{currentPage}</span> of{' '}
        <span className="text-foreground">{totalPages}</span>
      </span>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="inline-flex h-9 items-center gap-1 rounded-md border border-hairline bg-surface-1 px-3 tile-label text-foreground transition-colors hover:border-brand-rim hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-focus"
        >
          <FiChevronLeft className="size-3.5" aria-hidden="true" />
          Previous
        </button>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onMouseEnter={onPrefetchNext}
          onFocus={onPrefetchNext}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className="inline-flex h-9 items-center gap-1 rounded-md border border-hairline bg-surface-1 px-3 tile-label text-foreground transition-colors hover:border-brand-rim hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-focus"
        >
          Next
          <FiChevronRight className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
