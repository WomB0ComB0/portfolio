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
 * @file The one stale treatment on /stats, outside the stat tiles: the kit's own (StatTile's stale
 * note), so the GitHub hero, the stat tiles and the repository table read alike. A clock, 'Stale
 * ·' and the age without 'updated' ('⏲ Stale · 1 h ago'): the note says the figure is old, so
 * the word would only repeat it. The clock sits the kit's 8px before the words, in the kit's
 * meta colour and glyph size. After the dot comes a plain space, as on either side of a context
 * line's own dots, rather than the kit's 8px gap. That keeps the note within about 7px of the
 * fresh age's room at its widest (github-hero.tsx). Server-safe (no directive); the age is
 * PresentAge.
 */

import { Clock } from 'lucide-react';
import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';
import { PresentAge } from './present-age';

/** The note before the age, as the kit's StatTile words it. */
const STALE_NOTE = 'Stale ·';

/** The clock, then the words, on one line, the kit's 8px apart (StatTile's meta row). */
const STALE_AGE_CLASS =
  'inline-flex shrink-0 items-center gap-x-2 whitespace-nowrap text-muted-foreground';
/** The kit's glyph size for a meta line's icon. */
const GLYPH_CLASS = 'size-3.5 shrink-0';

export interface StaleAgeProps {
  /** When the figure was read (an ISO time). */
  readonly at: string;
  readonly className?: string;
}

/** '⏲ Stale · 1 h ago': a stale figure's age, worded as the kit's stat tiles word theirs. */
export function StaleAge({ at, className }: StaleAgeProps): ReactElement {
  return (
    <span data-stale="" className={cn(STALE_AGE_CLASS, className)}>
      <Clock aria-hidden="true" className={GLYPH_CLASS} />
      <span>
        <span>{STALE_NOTE}</span> <PresentAge at={at} prefix="" />
      </span>
    </span>
  );
}
