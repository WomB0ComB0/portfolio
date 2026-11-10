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
 * @file The live photo wall (the infinite-card-grid pattern, our own rewrite from the lab),
 * loaded lazily by photo-wall.tsx. A pool of cards a little larger than the window is laid on a
 * lattice that repeats forever (wall-geometry.ts); the pan is two motion values and each card's
 * place is a transform computed from them, wrapped modulo the pool, so nothing is laid out again
 * while panning and React re-renders a card only when it wraps to a new cell. Input is
 * use-wall-input.ts. The wall is one Tab stop (role="application") with a polite live region of
 * its own, inside the wall so a modal sheet around it doesn't hide it.
 */

import { type MotionValue, motion, useMotionValue, useTransform } from 'motion/react';
import Image from 'next/image';
import {
  type CSSProperties,
  memo,
  type ReactElement,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { cn } from '@/lib/utils';
import type { WallPhoto } from '@/types/places';
import { placeholderOf } from '../_lib/card-placeholder';
import {
  focusPosition,
  photosFromVisits,
  WALL_HINTS,
  type WallMode,
  wallAnnouncement,
} from '../_lib/photo-labels';
import {
  type Cell,
  cellFor,
  colFor,
  type Geometry,
  geometryFor,
  panToCentre,
  photoAt,
  poolSize,
  rowFor,
  sameCell,
  stagger,
} from '../_lib/wall-geometry';
import type { OpenPhoto, PlacesById } from './photo-types';
import styles from './photo-wall.module.css';
import { useWallInput } from './use-wall-input';

/** Cards drawn 152 px wide in a narrow window, 240 px wider (the source covers 480 x 360). */
const CARD_SIZES = '(max-width: 639px) 152px, 240px';
/** A live region repeats only on a change: it is cleared first, then filled this much later. */
const ANNOUNCE_GAP_MS = 60;

export interface LiveWallProps {
  readonly photos: readonly WallPhoto[];
  readonly places: PlacesById;
  readonly placeCount: number;
  /** In the page (a mouse or trackpad) or in a touch screen's full-screen sheet. */
  readonly mode: WallMode;
  readonly onOpen: OpenPhoto;
}

interface SlotProps {
  readonly i: number;
  readonly j: number;
  readonly g: Geometry;
  readonly panX: MotionValue<number>;
  readonly panY: MotionValue<number>;
  readonly photos: readonly WallPhoto[];
  readonly active: Cell | null;
}

/** One card of the pool. It re-renders only when the pan wraps it to another cell. */
const WallSlot = memo(function WallSlot({
  i,
  j,
  g,
  panX,
  panY,
  photos,
  active,
}: SlotProps): ReactElement {
  const cellRef = useRef<Cell>(cellFor(i, j, panX.get(), panY.get(), g));
  const [cell, setCell] = useState<Cell>(cellRef.current);
  const x = useTransform([panX, panY], ([px = 0]: number[]) => colFor(i, px, g) * g.cellW + px);
  const y = useTransform([panX, panY], ([px = 0, py = 0]: number[]) => {
    const c = colFor(i, px, g);
    return rowFor(j, c, py, g) * g.cellH + py + stagger(c, g);
  });

  useEffect(() => {
    const update = (): void => {
      const next = cellFor(i, j, panX.get(), panY.get(), g);
      if (next.c === cellRef.current.c && next.r === cellRef.current.r) return;
      cellRef.current = next;
      setCell(next);
    };
    update();
    const offX = panX.on('change', update);
    const offY = panY.on('change', update);
    return () => {
      offX();
      offY();
    };
  }, [g, i, j, panX, panY]);

  const index = photoAt(cell, g, photos.length);
  const photo = index === null ? undefined : photos[index];
  return (
    <motion.div className={styles.slot} style={{ x, y }}>
      <div
        className={styles.card}
        data-cell={`${cell.c}:${cell.r}`}
        data-index={index ?? undefined}
        data-active={sameCell(active, cell) ? 'true' : undefined}
      >
        <div className={styles['card-clip']}>
          {photo ? (
            <Image
              src={photo.thumb}
              alt=""
              fill
              sizes={CARD_SIZES}
              className={styles['card-img']}
              style={{ objectPosition: focusPosition(photo) }}
              draggable={false}
            />
          ) : null}
        </div>
      </div>
    </motion.div>
  );
});

/** The wall's own polite live region, re-announced even when the text repeats. */
function useAnnouncer(): readonly [string, (text: string) => void] {
  const [text, setText] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const announce = useCallback((next: string) => {
    window.clearTimeout(timer.current);
    setText('');
    timer.current = window.setTimeout(() => setText(next), ANNOUNCE_GAP_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [text, announce];
}

/**
 * Measures the wall's box and keeps its geometry, first centring cell 0:0; a resize keeps the
 * pan and swaps the geometry only when the pool changes shape.
 */
function useWallGeometry(
  viewportRef: RefObject<HTMLDivElement | null>,
  panX: MotionValue<number>,
  panY: MotionValue<number>,
  count: number,
): Geometry | null {
  const [g, setG] = useState<Geometry | null>(null);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    let first = true;
    const measure = (): void => {
      const next = geometryFor(viewport.clientWidth, viewport.clientHeight, count);
      if (first) {
        first = false;
        const start = panToCentre({ c: 0, r: 0 }, next);
        panX.set(start.x);
        panY.set(start.y);
      }
      setG((current) =>
        current &&
        current.width === next.width &&
        current.height === next.height &&
        current.cols === next.cols
          ? current
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [count, panX, panY, viewportRef]);
  return g;
}

/** The endless wall of every photo given, with its keyboard model and live region. */
export function LiveWall({
  photos,
  places,
  placeCount,
  mode,
  onOpen,
}: LiveWallProps): ReactElement {
  const hintId = useId();
  const [announcement, say] = useAnnouncer();
  const viewportRef = useRef<HTMLDivElement>(null);
  const panX = useMotionValue(0);
  const panY = useMotionValue(0);
  const g = useWallGeometry(viewportRef, panX, panY, photos.length);

  const photoIn = (cell: Cell): WallPhoto | undefined => {
    const index = g ? photoAt(cell, g, photos.length) : null;
    return index === null ? undefined : photos[index];
  };

  const announce = (cell: Cell): void => {
    const photo = photoIn(cell);
    const place = photo ? places.get(photo.placeId) : undefined;
    if (photo && place) say(wallAnnouncement(photo, place));
  };

  const openCell = (cell: Cell): void => {
    const viewport = viewportRef.current;
    const card = viewport?.querySelector<HTMLElement>(`[data-cell="${cell.c}:${cell.r}"]`);
    const photo = photoIn(cell);
    if (!viewport || !card || !photo) return;
    onOpen({ photo, source: card, placeholder: placeholderOf(card), returnFocus: viewport });
  };

  const { active, handlers } = useWallInput({
    viewportRef,
    geometry: g,
    panX,
    panY,
    onOpenCell: openCell,
    onAnnounce: announce,
  });

  const slots = g
    ? Array.from({ length: poolSize(g) }, (_, k) => ({ i: k % g.cols, j: Math.floor(k / g.cols) }))
    : [];
  const sizeVars = g
    ? ({ '--card-w': `${g.cardW}px`, '--card-h': `${g.cardH}px` } as CSSProperties)
    : undefined;

  return (
    <div className={cn(styles.wall, mode === 'sheet' && styles['wall-sheet'])}>
      <div
        ref={viewportRef}
        className={cn(styles.viewport, mode === 'sheet' && styles['viewport-sheet'])}
        style={sizeVars}
        role="application"
        aria-roledescription="photo wall"
        aria-label={photosFromVisits(photos.length, placeCount)}
        aria-describedby={hintId}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: role="application" is a widget with its own keyboard model (one Tab stop, arrow keys inside); Biome counts it as non-interactive.
        tabIndex={0}
        data-photo-wall={mode}
        {...handlers}
      >
        <div aria-hidden="true">
          {g
            ? slots.map(({ i, j }) => (
                <WallSlot
                  key={`${g.width}x${g.height}:${i}:${j}`}
                  i={i}
                  j={j}
                  g={g}
                  panX={panX}
                  panY={panY}
                  photos={photos}
                  active={active}
                />
              ))
            : null}
        </div>
      </div>
      <p id={hintId} className={styles.hint}>
        {WALL_HINTS[mode]}
      </p>
      <p className="sr-only" aria-live="polite" data-wall-announce="">
        {announcement}
      </p>
    </div>
  );
}
