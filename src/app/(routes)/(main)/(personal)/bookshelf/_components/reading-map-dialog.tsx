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

'use client';

/**
 * @file The reading map's place in the page (the #632 lazy pattern): the stage's header and the
 * detail's open it. Its code (reading-map-dialog-live.tsx, with the site's Radix dialog) is
 * fetched when a visitor points at or focuses a 'Reading map' button (preloadReadingMap), or on
 * the first open, so none of it is in the page's first load. A chunk that fails to load resolves
 * to ReadingMapUnavailable, which closes the map again instead of taking the page down to the
 * route's error view; focus never left the button. Guarded by
 * tests/unit/bookshelf/reading-map-dialog.test.tsx, reading-map-chunk-failure.test.tsx and
 * scale-budgets.test.ts.
 */

import { type ComponentType, lazy, type ReactElement, Suspense, useEffect } from 'react';
import type { ReadingMapDialogLiveProps } from './reading-map-dialog-live';

export interface ReadingMapDialogProps extends ReadingMapDialogLiveProps {
  readonly open: boolean;
}

/** Fetches the open map's code; the same module every time. */
const loadReadingMap = () => import('./reading-map-dialog-live');

/** Starts fetching the open map's code, so the first open has it. Failures wait for the open. */
export function preloadReadingMap(): void {
  loadReadingMap().catch(() => undefined);
}

/** Stands in for a map whose code failed to load: renders nothing, and closes the map once. */
function ReadingMapUnavailable({ onClose }: ReadingMapDialogLiveProps): null {
  useEffect(() => {
    onClose();
  }, [onClose]);
  return null;
}

/**
 * The open map, fetched on intent or on the first open. lazy() rethrows a rejected import during
 * render and Suspense doesn't catch errors, so a failed chunk resolves to ReadingMapUnavailable.
 */
const LiveReadingMap = lazy<ComponentType<ReadingMapDialogLiveProps>>(() =>
  loadReadingMap().then(
    (module) => ({ default: module.ReadingMapDialogLive }),
    () => ({ default: ReadingMapUnavailable }),
  ),
);

/** The reading map: nothing while closed, the live dialog once open and loaded. */
export function ReadingMapDialog({ open, ...map }: ReadingMapDialogProps): ReactElement | null {
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <LiveReadingMap {...map} />
    </Suspense>
  );
}
