/**
 * Copyright 2025 Mike Odnis
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
 * @file A row of figures for a page header (22 projects, 15 roles), and the number formatting
 * every console figure shares. Server-safe (no directive, no hooks): server tiles and the
 * LiveNumber island both format through numberFormatter, so their text always agrees.
 *
 * The type is the refined set (globals.css): each figure is Geist (figure-sm, tabular) with its
 * label under it (figure-unit), hairlines between the items; no mono face, no capitals.
 */

import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

import { destinationOf, SrOnlyWords } from '@/components/console/tile-link';
import { cn } from '@/lib/utils';

/** Every console number is formatted in this locale, so the server and the browser agree. */
export const NUMBER_LOCALE = 'en-US';

/** Format option sets are written in code, so a few cover the site; the cap only bounds misuse. */
const FORMATTER_CACHE_LIMIT = 32;

const formatters = new Map<string, Intl.NumberFormat>();

/**
 * The cache key for `format`: its defined entries sorted by name. Plain JSON.stringify follows
 * insertion order, so `{ a, b }` and `{ b, a }` would get two formatters, and LiveNumber, whose
 * effect depends on the instance, would restart its glide. Intl ignores an undefined option, so
 * the key does too. Every NumberFormatOptions value is a primitive, so one level is enough.
 */
function formatterKey(format: Intl.NumberFormatOptions = {}): string {
  // Object keys are unique, so the comparator never meets a tie.
  const entries = Object.entries(format)
    .filter(([, option]) => option !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return JSON.stringify(entries);
}

/**
 * The shared en-US formatter for `format`. Equal options return the same instance, whatever
 * their key order, so a caller can pass an inline options object and still get a stable
 * formatter (and stable effect deps).
 */
export function numberFormatter(format?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = formatterKey(format);
  const cached = formatters.get(key);
  if (cached) return cached;
  if (formatters.size >= FORMATTER_CACHE_LIMIT) formatters.clear();
  const formatter = new Intl.NumberFormat(NUMBER_LOCALE, format);
  formatters.set(key, formatter);
  return formatter;
}

/** A number in en-US (1234 -> '1,234'); a string is already display text and passes through. */
export function formatStatValue(value: number | string, format?: Intl.NumberFormatOptions): string {
  return typeof value === 'number' ? numberFormatter(format).format(value) : value;
}

/**
 * The value to show, or null when there is none: null, undefined, a blank string and a
 * non-finite number (a division by zero upstream) all count as missing. StatTile and StatStrip
 * both go through it, so neither ever prints 'NaN', '∞' or an empty figure.
 */
export function presentValue(value: number | string | null | undefined): number | string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return value.trim() === '' ? null : value;
}

/** An em dash is shown only next to a word that says why. */
const UNAVAILABLE_DASH = '—';
const UNAVAILABLE_LABEL = 'unavailable';

/** How many placeholder items a loading strip shows unless told. */
const DEFAULT_PLACEHOLDERS = 4;

/**
 * Equal columns on a phone; on wide screens each item is as wide as its figure or label. Three
 * items fit figures of up to three digits from a 320px phone (measured on /certifications: the
 * middle column holds a four-digit figure from about 340px). A figure never wraps, so one wider
 * than its column runs into the next: a strip with larger figures needs fewer items.
 */
const STRIP_CLASS = 'grid grid-flow-col auto-cols-[minmax(0,1fr)] md:auto-cols-max';
const ITEM_CLASS =
  'flex min-w-0 flex-col gap-1 border-l border-hairline px-3 first:border-l-0 first:pl-0 last:pr-0 md:px-6';
const VALUE_CLASS = 'order-1 figure-sm text-foreground';
const LABEL_CLASS = 'order-2 figure-unit text-muted-foreground';
const UNIT_CLASS = 'ml-0.5 figure-unit text-muted-foreground';
const BAR_CLASS = 'block rounded-sm bg-surface-3 motion-safe:animate-pulse forced-colors:outline';

export interface StatStripItem {
  /** Read after the value ("22 projects"). Labels key the items, so keep them unique. */
  label: string;
  /**
   * A missing value (null, a blank string or a non-finite number) is shown as an em dash that
   * screen readers hear as 'unavailable'.
   */
  value: number | string | null;
  /** Shown right after the value, e.g. 'h' or '%'. */
  unit?: string;
  /** Makes the value a link (prefetch off). An empty or '#' href is ignored. */
  href?: string;
}

export interface StatStripProps {
  items: readonly StatStripItem[];
  /** Shows placeholder items instead and marks the list busy. */
  loading?: boolean;
  /** How many placeholders loading shows (4 unless given): as many as the loaded strip's items. */
  placeholderCount?: number;
  className?: string;
  'aria-label'?: string;
}

function StripValue({ label, value, unit, href }: StatStripItem): ReactNode {
  const shown = presentValue(value);
  if (shown === null) {
    return (
      <>
        <span aria-hidden="true">{UNAVAILABLE_DASH}</span>
        <span className="sr-only">{UNAVAILABLE_LABEL}</span>
      </>
    );
  }

  const text = (
    <>
      {formatStatValue(shown)}
      {unit && <span className={UNIT_CLASS}>{unit}</span>}
    </>
  );
  const destination = destinationOf(href);
  if (destination === null) return text;

  // A bare number makes a poor link name out of context, so the label rides along for readers.
  return (
    <Link href={destination} prefetch={false} className="underline-offset-4 hover:underline">
      {text}
      <SrOnlyWords>{label}</SrOnlyWords>
    </Link>
  );
}

/** A figure bar (the figure's 28px line) over a label bar inside the label's 20px line. */
function PlaceholderItem(): ReactElement {
  return (
    <div aria-hidden="true" data-placeholder="" className={ITEM_CLASS}>
      <dt className="order-2 py-[3px]">
        <span className={cn(BAR_CLASS, 'h-3.5 w-16')} />
      </dt>
      <dd className="order-1">
        <span className={cn(BAR_CLASS, 'h-7 w-10')} />
      </dd>
    </div>
  );
}

/**
 * Figures in a description list. Each label comes first in the DOM, so a screen reader hears
 * "Projects, 22", while CSS order shows the figure first with its label under it.
 *
 * @example
 * <StatStrip aria-label="At a glance" items={[{ label: 'projects', value: 22, href: '/projects' }]} />
 */
export function StatStrip({
  items,
  loading = false,
  placeholderCount = DEFAULT_PLACEHOLDERS,
  className,
  'aria-label': ariaLabel,
}: StatStripProps): ReactElement {
  return (
    <dl
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      className={cn(STRIP_CLASS, className)}
    >
      {loading
        ? Array.from({ length: placeholderCount }, (_, index) => (
            // The placeholders are identical and never reorder, so the index is their identity.
            <PlaceholderItem key={`placeholder-${Number(index)}`} />
          ))
        : items.map((item) => (
            <div key={item.label} className={ITEM_CLASS}>
              <dt className={LABEL_CLASS}>{item.label}</dt>
              <dd className={VALUE_CLASS}>
                <StripValue {...item} />
              </dd>
            </div>
          ))}
    </dl>
  );
}
