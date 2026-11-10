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
 * @file The photos of the past places shown, as the endless wall or a plain captioned grid (the
 * owner's "Keep A: wall first on a mouse, grid on touch"), with a visible Wall / Grid switch.
 * - A mouse or trackpad starts on the wall and switches in place.
 * - A touch screen starts on the grid; Wall opens the wall full screen, so a finger on the page
 *   always scrolls it.
 * - Without script: the grid alone, with a note, no switch (CSS, scripting: none).
 * - Fewer than WALL_MIN_PHOTOS photos, or a wall whose code failed to load: the grid alone.
 * Before hydration the server can't know the pointer, so it sends the grid and an empty wall
 * frame and CSS shows the right one by the same media query the script reads; once the script
 * knows, it keeps only that one, so nothing on screen changes and nothing shifts. The choice is
 * this visit's only: never stored, never in the URL. Both views open a photo in PhotoDialog.
 */

import { type ReactElement, type RefObject, useCallback, useEffect, useRef, useState } from 'react';

import { useFinePointer } from '@/hooks/use-fine-pointer';
import { useIsServerHtmlRender } from '@/hooks/use-is-server-html-render';
import type { WallPhoto } from '@/types/places';
import { photoCountLabel } from '../_lib/photo-labels';
import { PhotoDialog, preloadPhotoDialog } from './photo-dialog';
import { PhotoGrid } from './photo-grid';
import type { OpenPhoto, OpenRequest, PlacesById } from './photo-types';
import { PhotoWall, PhotoWallSheet } from './photo-wall';
import styles from './photos-view.module.css';

/** Below this many photos the wall would repeat a few across the whole window: grid only. */
export const WALL_MIN_PHOTOS = 12;

type ViewKind = 'wall' | 'grid';

const VIEWS: readonly { readonly value: ViewKind; readonly label: string }[] = [
  { value: 'wall', label: 'Wall' },
  { value: 'grid', label: 'Grid' },
];

export interface PhotosViewProps {
  /** The photos of the places shown, in the fixed shuffle. */
  readonly photos: readonly WallPhoto[];
  readonly places: PlacesById;
  /** How many places those photos come from. */
  readonly placeCount: number;
  /** Changes with the filtered set: the wall starts over and the grid folds back. */
  readonly resetKey?: string;
}

/**
 * Which view is on: null until the script knows the pointer (CSS picks meanwhile); then the grid
 * on touch, without a wall, or by choice, else the wall.
 */
function viewFor(
  ready: boolean,
  wallAllowed: boolean,
  fine: boolean,
  choice: ViewKind | null,
): ViewKind | null {
  if (!ready) return null;
  if (!wallAllowed || !fine) return 'grid';
  return choice ?? 'wall';
}

/**
 * Starts fetching the open view's code on the first sign of intent inside `root`: a pointer over
 * it or focus in it. Once is enough; the module stays loaded.
 */
function usePreloadOnIntent(root: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = root.current;
    if (!element) return undefined;
    const preload = (): void => {
      element.removeEventListener('pointerover', preload);
      element.removeEventListener('focusin', preload);
      preloadPhotoDialog();
    };
    element.addEventListener('pointerover', preload);
    element.addEventListener('focusin', preload);
    return () => {
      element.removeEventListener('pointerover', preload);
      element.removeEventListener('focusin', preload);
    };
  }, [root]);
}

/** The Wall / Grid switch and the photos in the view chosen, with the open photo. */
export function PhotosView({
  photos,
  places,
  placeCount,
  resetKey = '',
}: PhotosViewProps): ReactElement {
  const ready = !useIsServerHtmlRender();
  const fine = useFinePointer();
  const [choice, setChoice] = useState<ViewKind | null>(null);
  const [wallUnavailable, setWallUnavailable] = useState(false);
  const [dialogUnavailable, setDialogUnavailable] = useState(false);
  const [opened, setOpened] = useState<OpenRequest | null>(null);
  const wallButton = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  usePreloadOnIntent(rootRef);

  const wallAllowed = photos.length >= WALL_MIN_PHOTOS && !wallUnavailable;
  const view = viewFor(ready, wallAllowed, fine, choice);
  const sheetOpen = ready && !fine && wallAllowed && choice === 'wall';
  const pressed: ViewKind = view === 'wall' || sheetOpen ? 'wall' : 'grid';
  const showWall = view === null ? wallAllowed : view === 'wall';
  const showGrid = view === null || view === 'grid';

  const open = useCallback<OpenPhoto>(
    (request) => {
      const place = places.get(request.photo.placeId);
      if (place) setOpened({ ...request, place });
    },
    [places],
  );
  const closed = useCallback(() => setOpened(null), []);
  const closeSheet = useCallback(() => setChoice('grid'), []);
  const wallFailed = useCallback(() => setWallUnavailable(true), []);
  const dialogFailed = useCallback(() => {
    setDialogUnavailable(true);
    setOpened(null);
  }, []);

  return (
    <div
      ref={rootRef}
      className={styles.view}
      data-photos-view={view ?? 'auto'}
      data-ready={ready ? '' : undefined}
      data-wall={wallAllowed ? 'on' : 'off'}
    >
      <div className={styles.bar}>
        {wallAllowed ? (
          // biome-ignore lint/a11y/useSemanticElements: two toggle buttons, not form fields; a fieldset would add a legend and a form's semantics.
          <div role="group" aria-label="View" className={styles.switch} data-view-switch="">
            {VIEWS.map((item) => (
              <button
                key={item.value}
                ref={item.value === 'wall' ? wallButton : undefined}
                type="button"
                className={styles.option}
                aria-pressed={ready ? pressed === item.value : undefined}
                onClick={() => setChoice(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
        <p className={styles.note}>{photoCountLabel(photos.length)}</p>
      </div>
      {showWall ? (
        <div className={styles['wall-block']} data-wall-block="">
          <PhotoWall
            load={view === 'wall'}
            resetKey={resetKey}
            photos={photos}
            places={places}
            placeCount={placeCount}
            onOpen={open}
            onUnavailable={wallFailed}
          />
        </div>
      ) : null}
      {showGrid ? (
        <div className={styles['grid-block']} data-grid-block="">
          <PhotoGrid
            key={resetKey}
            photos={photos}
            places={places}
            onOpen={open}
            enhance={!dialogUnavailable}
          />
        </div>
      ) : null}
      {sheetOpen ? (
        <PhotoWallSheet
          photos={photos}
          places={places}
          placeCount={placeCount}
          onOpen={open}
          onClose={closeSheet}
          returnFocus={wallButton}
          onUnavailable={wallFailed}
        />
      ) : null}
      <PhotoDialog opened={opened} onClosed={closed} onUnavailable={dialogFailed} />
    </div>
  );
}
