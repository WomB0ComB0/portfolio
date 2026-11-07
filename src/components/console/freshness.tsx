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

'use client';

/**
 * @file "updated 5 min ago": how old a figure is, kept current while the page stays open.
 *
 * The server and the browser read the clock at different moments, so the text can differ on
 * hydration. The <time> element suppresses that one warning and holds nothing but its text; keep
 * it a leaf. React leaves a suppressed mismatch unpatched, so a layout effect brings the text up
 * to the browser's clock right after hydration. It re-reads the clock every 30 s.
 *
 * The wording lives in format-age.ts, which has no directive, so server code can call formatAge.
 */

import { type ReactElement, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { formatAge, type Timestamp, toTime } from '@/components/console/format-age';
import { cn } from '@/lib/utils';

/** How often an open page re-reads the clock. */
const REFRESH_MS = 30_000;

const DEFAULT_PREFIX = 'updated';

/** The current time, re-read every `intervalMs`. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

export interface FreshnessProps {
  at: Timestamp;
  /** The word before the age; '' shows the age alone. */
  prefix?: string;
  className?: string;
}

/**
 * The age of a figure as a <time> element, e.g. "updated 5 min ago", in the meta style (Geist
 * 13/18 with tabular figures, so the age never jitters as it changes). Renders nothing for an
 * invalid `at`.
 *
 * @example
 * <Freshness at={data.fetchedAt} />
 */
export function Freshness({
  at,
  prefix = DEFAULT_PREFIX,
  className,
}: FreshnessProps): ReactElement | null {
  const now = useNow(REFRESH_MS);
  const timeRef = useRef<HTMLTimeElement>(null);
  const time = toTime(at);
  const age = formatAge(time, now);
  // One string, so the <time> holds a single text node for suppressHydrationWarning to cover.
  const text = age && prefix ? `${prefix} ${age}` : age;

  // After hydration the DOM may still hold the server's text; React thinks it holds `text`.
  useLayoutEffect(() => {
    const node = timeRef.current;
    if (node && node.textContent !== text) node.textContent = text;
  }, [text]);

  if (!Number.isFinite(time)) return null;

  return (
    <time
      ref={timeRef}
      dateTime={new Date(time).toISOString()}
      suppressHydrationWarning
      className={cn('tile-meta', className)}
    >
      {text}
    </time>
  );
}
