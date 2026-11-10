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
 * @file The photo wall on a touch screen: a full-screen sheet opened from the view's Wall button,
 * loaded lazily with the wall. In the page a finger drag would have to pick between panning the
 * wall and scrolling the page; here there is no page to scroll, so every drag pans. The site's
 * Radix dialog: focus starts on Done and is trapped, Escape or Done closes it, and focus goes
 * back to the Wall button. A photo opened from it stacks the open view on top (Escape closes only
 * that). It fades in by opacity.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { type ReactElement, type RefObject, useRef } from 'react';

import { Dialog, DialogClose, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import type { WallPhoto } from '@/types/places';
import { photoCountLabel, visitCountLabel } from '../_lib/photo-labels';
import type { OpenPhoto, PlacesById } from './photo-types';
import { LiveWall } from './photo-wall-live';
import styles from './wall-sheet.module.css';

export interface LiveWallSheetProps {
  readonly photos: readonly WallPhoto[];
  readonly places: PlacesById;
  readonly placeCount: number;
  readonly onOpen: OpenPhoto;
  /** Done or Escape: the view goes back to the grid. */
  readonly onClose: () => void;
  /** Focus goes back here on close: the view's Wall button. */
  readonly returnFocus: RefObject<HTMLElement | null>;
}

/** The wall full screen, with its title and Done. */
export function LiveWallSheet({
  photos,
  places,
  placeCount,
  onOpen,
  onClose,
  returnFocus,
}: LiveWallSheetProps): ReactElement {
  const doneRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content
          className={styles.sheet}
          aria-describedby={undefined}
          data-wall-sheet=""
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            doneRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus({ preventScroll: true });
          }}
        >
          <div className={styles.bar}>
            <DialogTitle className={styles.title}>
              {photoCountLabel(photos.length)}
              <span className={styles.sub}>from {visitCountLabel(placeCount)}</span>
            </DialogTitle>
            <DialogClose ref={doneRef} className={styles.done}>
              Done
            </DialogClose>
          </div>
          <LiveWall
            photos={photos}
            places={places}
            placeCount={placeCount}
            mode="sheet"
            onOpen={onOpen}
          />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
