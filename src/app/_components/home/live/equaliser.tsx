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
 * @file The now-playing equaliser: three bars on equaliser.module.css, moving in the live colour
 * while a track plays and still and faint otherwise (still under reduced motion too). The home
 * now-playing tile draws it, and so does /spotify. No directive and no hooks, so a server
 * component renders it on the server and the client tile bundles it as a plain module: importing
 * it from the tile's 'use client' module would make every export a client reference on the server.
 */

import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';
import styles from './equaliser.module.css';

/** The bars in order: each one's rest pose and speed (equaliser.module.css). */
const BAR_POSES = ['low', 'high', 'mid'] as const;

export interface EqualiserProps {
  /** 'inline' beside text (12px), or 'glyph' in an art box's place (20px). */
  readonly size: 'inline' | 'glyph';
  /** Moving, in the live colour; otherwise still and faint. */
  readonly live: boolean;
}

/**
 * Three bars: the live cue while a track plays, a still glyph otherwise. Decorative, so hidden
 * from assistive technology; the words beside it say what plays.
 *
 * @example
 * <Equaliser size="inline" live />
 */
export function Equaliser({ size, live }: EqualiserProps): ReactElement {
  const isGlyph = size === 'glyph';
  return (
    <span
      aria-hidden="true"
      data-equaliser={live ? 'live' : 'still'}
      className={cn(styles.bars, isGlyph && styles.glyph)}
    >
      {BAR_POSES.map((pose) => (
        <span
          key={pose}
          className={cn(
            styles.bar,
            isGlyph && styles.thick,
            live ? styles.live : styles.still,
            styles[pose],
          )}
        />
      ))}
    </span>
  );
}
