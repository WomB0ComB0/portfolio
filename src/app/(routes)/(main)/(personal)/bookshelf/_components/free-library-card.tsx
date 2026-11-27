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
 * @file The card that links /bookshelf to the Free Library (/bookshelf/free), the index of
 * EbookFoundation's free programming books. The stage (bookshelf-stage.tsx) draws it under the
 * shelf cards, on the whole shelf only. It describes the library in words and carries no figures:
 * the island may not read the catalog, so a written figure would only drift from it. Guarded by
 * tests/unit/bookshelf/free-library-card.test.tsx and kept on the palette by palette-only.test.ts.
 */

import Link from 'next/link';
import type { ReactElement } from 'react';
import { FiArrowUpRight, FiBookOpen } from 'react-icons/fi';

/** Promo link card to the EbookFoundation Free Programming Books Directory. */
export function FreeLibraryDirectoryCard(): ReactElement {
  return (
    <Link
      href="/bookshelf/free"
      prefetch={false}
      className="group flex flex-wrap items-center justify-between gap-4 rounded-tile border border-hairline bg-surface-1 p-5 no-underline transition-colors hover:border-brand-rim hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2 tile-meta text-brand-ink">
          <FiBookOpen className="size-3.5" aria-hidden="true" />
          <span>Open-access index · EbookFoundation</span>
        </div>
        <p className="tile-title text-foreground">Free Programming Books Directory</p>
        <p className="tile-sub text-muted-foreground">
          Free programming books from the EbookFoundation&apos;s community-maintained list,
          searchable by language and subject.
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 tile-label text-brand-ink group-hover:text-foreground">
        Browse directory
        <FiArrowUpRight
          className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}
