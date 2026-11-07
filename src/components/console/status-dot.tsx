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
 * @file The Live Console status dot. Server-safe (no directive, no hooks).
 *
 * The dot is decorative: it is hidden from assistive tech and its colour never carries meaning
 * alone. The caller always shows the word next to it ('Live', 'Now', 'Down', ...).
 */

import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';

/** What a dot can signal. `idle` is the neutral, faint dot. */
export type StatusTone = 'live' | 'ongoing' | 'down' | 'info' | 'idle';

const TONE_CLASS = {
  live: 'bg-live',
  ongoing: 'bg-ongoing',
  down: 'bg-down',
  info: 'bg-info',
  idle: 'bg-faint',
} as const satisfies Record<StatusTone, string>;

const DOT_CLASS = 'inline-block size-2 shrink-0 rounded-full';

/** The ring that breathes around a live dot; the global reduced-motion rule also stills it. */
const PULSE_CLASS = 'motion-safe:animate-live-pulse';

export interface StatusDotProps {
  tone: StatusTone;
  /** Breathes while true. Only a `live` dot pulses; other tones ignore it. */
  pulse?: boolean;
  className?: string;
}

/**
 * A small coloured dot for a status. Pair it with the word it stands for.
 *
 * @example
 * <span className="tile-label inline-flex items-center gap-1.5 text-live">
 *   <StatusDot tone="live" pulse /> Live
 * </span>
 */
export function StatusDot({ tone, pulse = false, className }: StatusDotProps): ReactElement {
  return (
    <span
      aria-hidden="true"
      data-status-dot=""
      data-tone={tone}
      className={cn(
        DOT_CLASS,
        TONE_CLASS[tone],
        pulse && tone === 'live' && PULSE_CLASS,
        className,
      )}
    />
  );
}
