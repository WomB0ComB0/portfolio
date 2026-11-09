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
 * @file The FilterBar's three glyphs, drawn in currentColor and hidden from screen readers (the
 * words beside them carry the meaning). Server-safe: no directive, no hooks.
 */

import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';

interface IconProps {
  readonly className?: string;
}

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function SearchIcon({ className }: IconProps): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={cn('size-4 shrink-0', className)}>
      <circle cx="7" cy="7" r="4.5" {...STROKE} />
      <path d="m10.5 10.5 3 3" {...STROKE} />
    </svg>
  );
}

export function ChevronIcon({ className }: IconProps): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={cn('size-3.5 shrink-0', className)}>
      <path d="m4 6 4 4 4-4" {...STROKE} />
    </svg>
  );
}

export function CrossIcon({ className }: IconProps): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={cn('shrink-0', className)}>
      <path d="m4.5 4.5 7 7m0-7-7 7" {...STROKE} />
    </svg>
  );
}
