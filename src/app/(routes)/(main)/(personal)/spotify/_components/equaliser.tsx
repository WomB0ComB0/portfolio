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
 * @file The /spotify art glyph: an art box holding the home now-playing tile's equaliser (its own
 * component, home/live/equaliser.tsx), for a track or an artist Spotify sent no image for, so a
 * missing cover looks alike on both pages. Server-safe (no directive, no hooks), decorative only.
 */

import type { ReactElement } from 'react';

import { Equaliser } from '@/app/_components/home/live/equaliser';
import { cn } from '@/lib/utils';

export interface ArtGlyphProps {
  /** The box's size and radius, the same classes as the art it stands in for. */
  readonly className: string;
  /** Moving bars while the track it stands in for plays; still otherwise. */
  readonly live?: boolean;
}

/** The art's box holding the large bars. Hidden from readers: the title or name is beside it. */
export function ArtGlyph({ className, live = false }: ArtGlyphProps): ReactElement {
  return (
    <span
      aria-hidden="true"
      data-art-glyph=""
      className={cn('grid shrink-0 place-items-center bg-surface-3', className)}
    >
      <Equaliser size="glyph" live={live} />
    </span>
  );
}
