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
 * @file The Free Library's Suspense fallback (free/page.tsx), shown until the explorer has its
 * URL state. A server component with no state.
 */

import type { ReactElement } from 'react';

const SKELETON_ROWS = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5', 'row-6'] as const;

/** Lightweight structural fallback while `/bookshelf/free` hydrates URL search state. */
export function FreeBooksSkeleton(): ReactElement {
  return (
    <output
      aria-busy="true"
      aria-label="Loading free programming books"
      className="block space-y-5 p-6"
    >
      <div className="h-28 animate-pulse rounded-tile border border-hairline bg-surface-1" />
      <div className="space-y-2 rounded-tile border border-hairline bg-surface-1 p-4">
        {SKELETON_ROWS.map((rowId) => (
          <div key={rowId} className="h-10 animate-pulse rounded-md bg-surface-2" />
        ))}
      </div>
    </output>
  );
}
