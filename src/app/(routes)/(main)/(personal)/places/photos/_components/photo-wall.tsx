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
 * @file The photo wall's place in the page (the #632 lazy pattern). Its markup here is only the
 * empty frame, the same box the live wall fills, so the server HTML and the first paint never
 * shift. The wall itself (motion's animate, the pointer and keyboard model) lives in
 * photo-wall-live.tsx and the touch sheet in wall-sheet.tsx, each fetched only when it is shown:
 * the wall view on a mouse or trackpad, or the sheet a touch screen opens from Wall. A chunk that
 * fails to load resolves to WallUnavailable, which tells the view to stay on the grid, instead of
 * taking the page down to the route's error view.
 */

import { type ComponentType, lazy, type ReactElement, Suspense, useEffect } from 'react';

import { WALL_HINTS } from '../_lib/photo-labels';
import styles from './photo-wall.module.css';
import type { LiveWallProps } from './photo-wall-live';
import type { LiveWallSheetProps } from './wall-sheet';

interface Unavailable {
  /** Called once if the wall's code can't load: the view drops to the grid for good. */
  readonly onUnavailable: () => void;
}

/** Stands in for a wall whose code failed to load: renders nothing, and says so once. */
function WallUnavailable({ onUnavailable }: Unavailable): null {
  useEffect(() => {
    onUnavailable();
  }, [onUnavailable]);
  return null;
}

/**
 * The live wall, fetched the first time it is shown. lazy() rethrows a rejected import during
 * render and Suspense doesn't catch errors, so a failed chunk resolves to WallUnavailable.
 */
const LiveWallChunk = lazy<ComponentType<LiveWallProps & Unavailable>>(() =>
  import('./photo-wall-live').then(
    (module) => ({ default: module.LiveWall }),
    () => ({ default: WallUnavailable }),
  ),
);

/** The touch screen's full-screen wall, fetched when Wall is tapped. */
const LiveSheetChunk = lazy<ComponentType<LiveWallSheetProps & Unavailable>>(() =>
  import('./wall-sheet').then(
    (module) => ({ default: module.LiveWallSheet }),
    () => ({ default: WallUnavailable }),
  ),
);

/** The wall's box with no cards: the server's HTML and the Suspense fallback alike. */
export function WallFrame(): ReactElement {
  return (
    <div className={styles.wall} data-wall-frame="">
      <div className={styles.viewport} />
      <p className={styles.hint}>{WALL_HINTS.page}</p>
    </div>
  );
}

export interface PhotoWallProps extends Omit<LiveWallProps, 'mode'>, Unavailable {
  /** Whether to fetch and show the live wall; false draws only the frame. */
  readonly load: boolean;
  /** Changes with the filtered set: the live wall starts over, centred. */
  readonly resetKey: string;
}

/** The wall in the page: its frame, then the live wall once it is wanted and loaded. */
export function PhotoWall({ load, resetKey, ...wall }: PhotoWallProps): ReactElement {
  if (!load) return <WallFrame />;
  return (
    <Suspense fallback={<WallFrame />}>
      <LiveWallChunk key={resetKey} {...wall} mode="page" />
    </Suspense>
  );
}

/** The touch screen's full-screen wall, fetched and shown while the sheet is open. */
export function PhotoWallSheet(props: LiveWallSheetProps & Unavailable): ReactElement {
  return (
    <Suspense fallback={null}>
      <LiveSheetChunk {...props} />
    </Suspense>
  );
}
