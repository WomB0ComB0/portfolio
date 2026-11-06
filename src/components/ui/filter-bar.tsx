/**
 * Copyright (c) 2026 Mike Odnis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Filter, Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  value: string;
  onChange: (value: string) => void;
  options: (FilterOption | string)[];
  placeholder: string;
  icon: ReactNode;
  /** The select's accessible name. Defaults to "Filter by …" built from the placeholder. */
  label?: string;
}

/** The value of the "every option" item each select lists first, labelled with its placeholder. */
const ALL_VALUE = 'all';

/**
 * The bar's outer box. Static below lg: sticky there, the bar (163 px tall when its controls
 * stack) stayed on screen with the bottom bar and left a phone a few hundred pixels of content,
 * and there is no top nav for an offset to clear. From lg it sticks 1rem from the top; z-30 keeps
 * it under the rail's z-40 flyouts. `relative` anchors the results count to the bar at every
 * width. projects-skeleton.tsx repeats this string (a server file cannot import a constant from
 * this client module); filter-bar-sticky.test.tsx checks the two match.
 */
const FRAME_CLASS = 'relative -mx-4 px-4 md:mx-0 md:px-0 lg:sticky lg:top-4 lg:z-30';

/**
 * The results count hangs just below the bar, out of flow so showing it never moves the list. It
 * sits over the cards whenever the bar sticks, so it is an opaque chip, never bare text on a card.
 * At -bottom-7 a 24 px chip keeps 4 px clear of the bar and of /places' map 32 px below it.
 */
const RESULTS_COUNT_CLASS =
  'absolute -bottom-7 left-4 flex items-center gap-2 rounded-full border border-hairline bg-surface-1 px-3 py-0.5 text-meta font-medium text-muted-foreground shadow-tile';

/**
 * The select's accessible name. A combobox is not named by its text (that is its value), so
 * without one axe reports an unnamed button: "All Categories" gives "Filter by categories".
 */
const triggerLabel = ({ label, placeholder }: FilterConfig): string =>
  label ?? `Filter by ${placeholder.replace(/^all\s+/i, '').toLowerCase()}`;

const optionValue = (option: FilterOption | string): string =>
  typeof option === 'string' ? option : option.value;

const optionLabel = (option: FilterOption | string): string =>
  typeof option === 'string' ? option : option.label;

/**
 * The text the closed select shows for its current value. Radix copies the chosen item's text into
 * the trigger through a portal that exists only after hydration, so the server HTML (and the page
 * without JavaScript) had a blank, unnamed combobox; given as SelectValue's children, the label is
 * in the server HTML too, and Radix then skips the portal. A value the options lack shows as is.
 */
const selectedLabel = ({ value, options, placeholder }: FilterConfig): string => {
  if (value === '' || value === ALL_VALUE) return placeholder;
  const selected = options.find((option) => optionValue(option) === value);
  return selected === undefined ? value : optionLabel(selected);
};

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters: FilterConfig[];
  onClear: () => void;
  hasActiveFilters: boolean;
  resultsCount: number;
  totalCount: number;
  entityName: string;
  className?: string;
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters,
  onClear,
  hasActiveFilters,
  resultsCount,
  totalCount,
  entityName,
  className,
}: Readonly<FilterBarProps>) {
  return (
    <div className={cn(FRAME_CLASS, className)}>
      <div className="bg-background/60 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-lg shadow-black/5">
        <div className="flex flex-col lg:flex-row gap-2">
          {/* Search Input */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-transparent border-transparent hover:bg-white/5 focus:bg-white/10 transition-all duration-300 h-10 rounded-xl"
            />
          </div>

          {filters.length > 0 && <div className="h-px lg:h-10 lg:w-px bg-white/10 mx-2" />}

          {/* Dynamic Filters */}
          {filters.map((filter, index) => (
            <Select
              key={`filter-${Number(index)}`}
              value={filter.value}
              onValueChange={filter.onChange}
            >
              <SelectTrigger
                aria-label={triggerLabel(filter)}
                className="w-full lg:w-[200px] bg-transparent border-transparent hover:bg-white/5 focus:bg-white/10 transition-all duration-300 h-10 rounded-xl"
              >
                <div className="flex items-center gap-2 w-full overflow-hidden">
                  <div className="text-muted-foreground shrink-0">{filter.icon}</div>
                  <span className="truncate">
                    <SelectValue placeholder={filter.placeholder}>
                      {selectedLabel(filter)}
                    </SelectValue>
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value={ALL_VALUE}>{filter.placeholder}</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={optionValue(option)} value={optionValue(option)}>
                    {optionLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}

          {/* Clear Filters Button. initial={false}: a filter already in the URL renders it in
              place (server HTML never hides it); only a filter chosen later animates it in. */}
          <AnimatePresence initial={false}>
            {hasActiveFilters && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, width: 0 }}
                animate={{ opacity: 1, scale: 1, width: 'auto' }}
                exit={{ opacity: 0, scale: 0.9, width: 0 }}
                className="overflow-hidden"
              >
                <Button
                  variant="ghost"
                  onClick={onClear}
                  className="h-10 px-4 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl whitespace-nowrap"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Results Count, in place when the filter came from the URL (see the Clear button). */}
      <AnimatePresence initial={false}>
        {hasActiveFilters && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={RESULTS_COUNT_CLASS}
          >
            <Filter className="h-3.5 w-3.5" />
            {/* Geist's digits are proportional; tabular-nums keeps the count steady as it updates. */}
            <span className="tabular-nums">
              Showing {resultsCount} of {totalCount} {entityName}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
