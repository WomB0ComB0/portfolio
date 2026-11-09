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
 * @file FilterBar.Skeleton: the bar's boxes at the bar's own sizes, from the same class module,
 * for a server-rendered placeholder that must not shift when the real bar arrives. Server-safe
 * (no directive, no hooks). It never wraps filterable content: anything behind a Suspense
 * fallback is invisible without JavaScript.
 */

import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';
import {
  BAR_CLASS,
  BAR_STICKY_CLASS,
  CHIP_LIST_CLASS,
  CHIPS_SLOT_CLASS,
  FILTERS_BUTTON_CLASS,
  FORM_ROW_CLASS,
  FORM_TILE_CLASS,
  SEARCH_SLOT_CLASS,
  SKELETON_BOX_CLASS,
} from './filter-bar-classes';

/** Chip widths that read as words of different lengths. */
const CHIP_WIDTHS = ['w-12', 'w-20', 'w-16', 'w-24', 'w-14', 'w-18'] as const;

export interface FilterBarSkeletonProps {
  /** How many chip boxes to draw. */
  readonly chips?: number;
  readonly sticky?: boolean;
  /** As FilterBar.Root's: one row of parts, or a surface tile. */
  readonly density?: 'row' | 'bar';
}

/** The bar's boxes, marked busy. */
export function FilterBarSkeleton({
  chips = 5,
  sticky = false,
  density = 'row',
}: FilterBarSkeletonProps): ReactElement {
  return (
    <div
      aria-busy="true"
      aria-label="Loading filters"
      role="status"
      data-filter-part="bar"
      className={cn(BAR_CLASS, sticky && BAR_STICKY_CLASS)}
    >
      <div className={density === 'bar' ? FORM_TILE_CLASS : FORM_ROW_CLASS}>
        <div className={cn(SEARCH_SLOT_CLASS, 'rounded-lg border border-hairline bg-surface-1')} />
        <div aria-hidden="true" className={cn(FILTERS_BUTTON_CLASS, 'w-24')} />
        <div className={cn(CHIPS_SLOT_CLASS, 'hidden @min-[48rem]/page:flex')}>
          <div className={CHIP_LIST_CLASS}>
            {CHIP_WIDTHS.concat(CHIP_WIDTHS)
              .slice(0, chips)
              .map((width, index) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: placeholder boxes have no identity.
                  key={index}
                  data-filter-part="chip"
                  className={cn(SKELETON_BOX_CLASS, 'h-8', width)}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
