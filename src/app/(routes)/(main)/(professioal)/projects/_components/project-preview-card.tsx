'use client';

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
 * @file The /projects hover preview's card: one 288 x 162 card that motion moves (x and y) and
 * fades (opacity, scale), holding one layer per row seen so far. The shown layer fades in over
 * the one before it, so a crossfade never dips to the card's surface; a cover fades in once it
 * has loaded (React state, not a DOM write), over the typographic card (the kind and the title)
 * that a project without a cover keeps. Decorative: aria-hidden, since each row's link text
 * names its project. It never sets rotate (no lean).
 */

import { type MotionValue, motion } from 'motion/react';
import Image from 'next/image';
import { type ReactElement, useState } from 'react';

import type { PreviewItem } from '../_lib/project-index';
import styles from './project-preview.module.css';
import { CARD_H, CARD_W, type CardState } from './project-preview-geometry';

/** A layer's part in the crossfade. */
type LayerState = 'shown' | 'previous' | 'rest';

/** The layer of row `id`: shown, the one before it (kept whole underneath), or at rest. */
function layerStateOf(state: CardState, id: string): LayerState {
  if (state.shown === id) return 'shown';
  if (state.previous === id) return 'previous';
  return 'rest';
}

interface LayerProps {
  readonly item: PreviewItem;
  readonly layer: LayerState;
}

/** One row's layer: the typographic card, and its cover over it once loaded. */
function PreviewLayer({ item, layer }: LayerProps): ReactElement {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={styles.layer} data-state={layer}>
      <div className={styles.typographic}>
        <span className="tile-label text-muted-foreground">{item.kind}</span>
        <span className="tile-title-lg text-balance text-foreground">{item.title}</span>
      </div>
      {item.cover && (
        <Image
          src={item.cover}
          alt=""
          width={CARD_W}
          height={CARD_H}
          sizes={`${CARD_W}px`}
          loading="eager"
          className={styles.cover}
          data-loaded={loaded ? 'true' : undefined}
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}

export interface PreviewCardProps {
  readonly items: Readonly<Record<string, PreviewItem>>;
  readonly state: CardState;
  readonly x: MotionValue<number>;
  readonly y: MotionValue<number>;
  readonly opacity: MotionValue<number>;
  readonly scale: MotionValue<number>;
}

/** The card, with a layer for every row seen; data-active (and will-change) only while shown. */
export function PreviewCard({
  items,
  state,
  x,
  y,
  opacity,
  scale,
}: PreviewCardProps): ReactElement {
  return (
    <motion.div
      aria-hidden="true"
      className={styles.card}
      style={{ x, y, opacity, scale }}
      data-preview-card=""
      data-shown={state.shown ?? ''}
      data-active={state.shown === null ? undefined : ''}
    >
      <div className={styles.layers}>
        {state.seen.map((id) => {
          const item = items[id];
          return item ? (
            <PreviewLayer key={id} item={item} layer={layerStateOf(state, id)} />
          ) : null;
        })}
      </div>
    </motion.div>
  );
}
