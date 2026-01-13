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
import { AnimatePresence, motion } from 'framer-motion';
import { Filter, Search, X } from 'lucide-react';
import type { ReactNode } from 'react';

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
}

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
    <div className={cn('sticky top-24 z-30 -mx-4 px-4 md:mx-0 md:px-0', className)}>
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
              <SelectTrigger className="w-full lg:w-[200px] bg-transparent border-transparent hover:bg-white/5 focus:bg-white/10 transition-all duration-300 h-10 rounded-xl">
                <div className="flex items-center gap-2 w-full overflow-hidden">
                  <div className="text-muted-foreground shrink-0">{filter.icon}</div>
                  <span className="truncate">
                    <SelectValue placeholder={filter.placeholder} />
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">{filter.placeholder}</SelectItem>
                {filter.options.map((option) => {
                  const value = typeof option === 'string' ? option : option.value;
                  const label = typeof option === 'string' ? option : option.label;
                  return (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          ))}

          {/* Clear Filters Button */}
          <AnimatePresence>
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

      {/* Results Count */}
      <AnimatePresence>
        {hasActiveFilters && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute -bottom-8 left-4 flex items-center gap-2 text-sm text-muted-foreground font-medium"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>
              Showing {resultsCount} of {totalCount} {entityName}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
