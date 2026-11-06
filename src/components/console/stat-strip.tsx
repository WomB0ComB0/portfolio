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
 * @file A row of small figures for a page header ("22 projects · 15 roles"), and the number
 * formatting every console figure shares. Server-safe (no directive, no hooks): server tiles and
 * the LiveNumber island both format through numberFormatter, so their text always agrees.
 */

import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

import { hasDestination, SrOnlyWords } from '@/components/console/tile-link';
import { cn } from '@/lib/utils';

/** Every console number is formatted in this locale, so the server and the browser agree. */
export const NUMBER_LOCALE = 'en-US';

/** Format option sets are written in code, so a few cover the site; the cap only bounds misuse. */
const FORMATTER_CACHE_LIMIT = 32;

const formatters = new Map<string, Intl.NumberFormat>();

/**
 * The shared en-US formatter for `format`. Equal options return the same instance, so a caller
 * can pass an inline options object and still get a stable formatter (and stable effect deps).
 */
export function numberFormatter(format?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(format ?? {});
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

const PLACEHOLDER_KEYS = ['first', 'second', 'third', 'fourth'] as const;

const STRIP_CLASS = 'flex flex-wrap gap-x-5 gap-y-2 font-mono text-meta text-muted-foreground';
const ITEM_CLASS = 'flex items-baseline gap-1.5';
const VALUE_CLASS = 'order-1 font-semibold text-foreground tabular-nums';
const BAR_CLASS = 'block h-3 rounded-sm bg-surface-3 motion-safe:animate-pulse';

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
  /** Shows four placeholder items and marks the list busy. */
  loading?: boolean;
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
      {unit && <span className="ml-0.5 font-normal text-muted-foreground">{unit}</span>}
    </>
  );
  if (!hasDestination(href)) return text;

  // A bare number makes a poor link name out of context, so the label rides along for readers.
  return (
    <Link href={href} prefetch={false} className="underline-offset-4 hover:underline">
      {text}
      <SrOnlyWords>{label}</SrOnlyWords>
    </Link>
  );
}

function PlaceholderItem(): ReactElement {
  return (
    <div aria-hidden="true" data-placeholder="" className={ITEM_CLASS}>
      <dt className="order-2">
        <span className={cn(BAR_CLASS, 'w-16')} />
      </dt>
      <dd className="order-1">
        <span className={cn(BAR_CLASS, 'w-8')} />
      </dd>
    </div>
  );
}

/**
 * Small figures in a description list. Each label comes first in the DOM, so a screen reader
 * hears "Projects, 22", while CSS order shows the value first ("22 projects").
 *
 * @example
 * <StatStrip aria-label="At a glance" items={[{ label: 'projects', value: 22, href: '/projects' }]} />
 */
export function StatStrip({
  items,
  loading = false,
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
        ? PLACEHOLDER_KEYS.map((key) => <PlaceholderItem key={key} />)
        : items.map((item) => (
            <div key={item.label} className={ITEM_CLASS}>
              <dt className="order-2">{item.label}</dt>
              <dd className={VALUE_CLASS}>
                <StripValue {...item} />
              </dd>
            </div>
          ))}
    </dl>
  );
}
