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
 * @file The open view of one photo, loaded lazily by photo-dialog.tsx, inside the site's Radix
 * dialog (focus trapped, starting on Close, or Done in the full-screen layout; Escape and a click
 * outside close it; focus goes back to the opener). It shows the WHOLE photo at every width, at
 * its real shape (the no-crop rule from #574), never the lab's 4:3 crop.
 * - Wide windows: the photo flies from its card. The frame is laid out at its final box, then
 *   drawn at the card's box by a uniform scale and translate and clipped to the card (clip-path,
 *   photo-flight.ts), and springs to none on SPRING. Closing flies it back, interruptible.
 * - The full-screen layout (phones and short windows, COMPACT_QUERY) and reduced motion: a
 *   crossfade, opacity only. A close after the window crossed the layout crossfades too, as the
 *   frame's measured box no longer holds.
 * - Crossing the layout while open (a phone rotated, a window zoomed) hides the button with
 *   focus, so focus moves to the one now shown instead of falling out of the dialog.
 * The card's own image (a same-origin /_next/image URL) shows until the full photo loads.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { animate } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import {
  type CSSProperties,
  type ReactElement,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { FiArrowRight, FiX } from 'react-icons/fi';

import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import { DURATION_MS, EASE, prefersReducedMotion, SPRING, seconds } from '@/lib/design/motion';
import { formatDateRange } from '@/utils/date';
import { sameOriginImage } from '../_lib/card-placeholder';
import { COMPACT_QUERY } from '../_lib/dialog-layout';
import { type Box, clipPathOf, flightFrom, identityFlight } from '../_lib/photo-flight';
import { photoAlt, spokenDates } from '../_lib/photo-labels';
import styles from './photo-dialog.module.css';
import type { OpenRequest } from './photo-types';

/** The backdrop: canvas at 70%, no blur. */
const BACKDROP_OPACITY = 0.7;
const FADE_IN = { duration: seconds(DURATION_MS.base), ease: EASE.effect } as const;
const FADE_OUT = { duration: seconds(DURATION_MS.fast), ease: EASE.effect } as const;
/** The flight back has visibly landed by then (SPRING looks done in 250 ms). */
const CLOSE_SETTLE_MS = DURATION_MS.springIn;
/** The corner radii in px: the wall's and the grid's cards, and the open frame. */
const CARD_RADIUS = 10;
const FRAME_RADIUS = 8;
/** The frame's width at its widest; on a phone, the screen less its padding. */
const FULL_SIZES = '(max-width: 639px) calc(-2rem + 100vw), 52rem';

export interface LivePhotoDialogProps {
  readonly opened: OpenRequest;
  /** It has closed and landed: the view forgets the photo. */
  readonly onClosed: () => void;
}

/** An element's box on screen, or null when it is gone or has no size. */
const boxOf = (element: HTMLElement | null): Box | null => {
  if (!element?.isConnected) return null;
  const { left, top, width, height } = element.getBoundingClientRect();
  return width > 0 && height > 0 ? { left, top, width, height } : null;
};

/** The refs that are set. */
const present = (refs: readonly RefObject<HTMLElement | null>[]): HTMLElement[] =>
  refs.map((ref) => ref.current).filter((element): element is HTMLElement => element !== null);

interface PanelProps extends LivePhotoDialogProps {
  /** Hands the dialog the routine to run on a close request. */
  readonly register: (close: () => void) => void;
}

interface CompactLayout {
  /** Whether the full-screen layout shows: the whole photo, crossfaded, and Done. */
  readonly compact: boolean;
  /** The same, for the close routine, which runs outside a render. */
  readonly compactNow: RefObject<boolean>;
}

/**
 * The layout while the view is open. The stylesheet shows Close on a wide window and Done in the
 * full-screen layout by the same query, so when the window crosses it the button with focus is
 * hidden and the browser drops focus to the page, out of the dialog (Radix ignores that blur).
 * Focus moves to the button now shown, unless it is on a part both layouts show.
 */
function useCompactLayout(
  closeRef: RefObject<HTMLButtonElement | null>,
  doneRef: RefObject<HTMLButtonElement | null>,
): CompactLayout {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT_QUERY).matches);
  const compactNow = useRef(compact);
  useEffect(() => {
    const query = window.matchMedia(COMPACT_QUERY);
    /** The window crossed the layout: follow it, and keep focus on a button that shows. */
    const follow = ({ matches }: { readonly matches: boolean }): void => {
      compactNow.current = matches;
      setCompact(matches);
      const shown = matches ? doneRef.current : closeRef.current;
      const hidden = matches ? closeRef.current : doneRef.current;
      const active = document.activeElement;
      if (active === hidden || active === document.body || active === null) shown?.focus();
    };
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, [closeRef, doneRef]);
  return { compact, compactNow };
}

/** The overlay and the panel, mounted inside the portal so their layout effect sees them laid out. */
function FlyingPanel({ opened, register, onClosed }: PanelProps): ReactElement {
  const { photo, place, source } = opened;
  const [placeholder] = useState(() => sameOriginImage(opened.placeholder, window.location.origin));
  const frameRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const { compact, compactNow } = useCompactLayout(closeRef, doneRef);
  /** The latest callbacks: the flight runs once per mount, whatever re-renders around it. */
  const callbacks = useRef({ register, onClosed });
  callbacks.current = { register, onClosed };

  // biome-ignore lint/correctness/useExhaustiveDependencies: one flight per mount (keyed by photo).
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    /** The full-screen layout or reduced motion when it opens: a crossfade both ways. */
    const still = prefersReducedMotion() || compact;
    const chrome = (): HTMLElement[] => present([surfaceRef, captionRef, closeRef, doneRef]);
    /** The frame's layout box, measured before it first moves. */
    const frameBox = boxOf(frame);
    const from = still ? null : boxOf(source);
    const flies = Boolean(from && frameBox);

    if (from && frameBox) {
      if (source) source.dataset.flying = 'true';
      const start = flightFrom(from, frameBox, photo.focus, CARD_RADIUS, FRAME_RADIUS);
      const startClip = clipPathOf(start.clip);
      frame.style.transform = `translate(${start.x}px, ${start.y}px) scale(${start.scale})`;
      frame.style.clipPath = startClip;
      animate(
        frame,
        {
          x: [start.x, 0],
          y: [start.y, 0],
          scale: [start.scale, 1],
          clipPath: [startClip, clipPathOf(identityFlight(FRAME_RADIUS).clip)],
        },
        SPRING,
      );
    } else {
      frame.style.opacity = '0';
      animate(frame, { opacity: [0, 1] }, FADE_IN);
    }
    if (overlayRef.current)
      animate(overlayRef.current, { opacity: [0, BACKDROP_OPACITY] }, FADE_IN);
    animate(
      chrome(),
      { opacity: [0, 1] },
      { ...FADE_IN, delay: flies ? seconds(DURATION_MS.instant) : 0 },
    );

    let closing = false;
    callbacks.current.register(() => {
      if (closing) return;
      closing = true;
      // Only back into the card from the layout it flew out into: a window that has since
      // become full screen measures another frame.
      const back = still || compactNow.current ? null : boxOf(source);
      animate(chrome(), { opacity: 0 }, FADE_OUT);
      // The backdrop lifts with the photo: over the flight back, or with the crossfade.
      if (overlayRef.current) {
        animate(overlayRef.current, { opacity: 0 }, back && frameBox ? FADE_IN : FADE_OUT);
      }
      let landed = false;
      const land = (): void => {
        if (landed) return;
        landed = true;
        if (source) delete source.dataset.flying;
        callbacks.current.onClosed();
      };
      if (back && frameBox) {
        // From wherever the flight is now: motion carries the values it is animating.
        const target = flightFrom(back, frameBox, photo.focus, CARD_RADIUS, FRAME_RADIUS);
        animate(
          frame,
          { x: target.x, y: target.y, scale: target.scale, clipPath: clipPathOf(target.clip) },
          SPRING,
        ).then(land, land);
        window.setTimeout(land, CLOSE_SETTLE_MS);
      } else {
        animate(frame, { opacity: 0 }, FADE_OUT).then(land, land);
      }
    });

    return () => {
      if (source) delete source.dataset.flying;
    };
  }, []);

  const shownDates = formatDateRange(place.startDate, place.endDate);
  const heardDates = spokenDates(place.startDate, place.endDate);
  return (
    <>
      <DialogPrimitive.Overlay ref={overlayRef} className={styles.overlay} />
      <div className={styles.layer}>
        <DialogPrimitive.Content
          className={styles.panel}
          style={{ '--ratio': String(photo.ratio) } as CSSProperties}
          data-photo-dialog={photo.key}
          data-compact={compact ? 'true' : undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (compact ? doneRef : closeRef).current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opened.returnFocus?.focus({ preventScroll: true });
          }}
        >
          <div ref={surfaceRef} className={styles.surface} />
          <div ref={frameRef} className={styles.frame} data-photo-frame="">
            {placeholder ? (
              // The card's own image, already decoded: shown at once and crossfaded out when the
              // full photo has loaded over it. Same-origin /_next/image only (CSP img-src 'self').
              // biome-ignore lint/performance/noImgElement: a same-origin URL already in the cache.
              <img src={placeholder} alt="" className={styles.placeholder} />
            ) : null}
            <Image
              src={photo.full}
              alt={photoAlt(photo, place)}
              fill
              sizes={FULL_SIZES}
              loading="eager"
              className={styles.full}
              onLoad={(event) => {
                event.currentTarget.dataset.loaded = 'true';
              }}
            />
          </div>
          <div ref={captionRef} className={styles.caption}>
            <div className={styles['caption-text']}>
              <DialogTitle className={styles.title}>{place.name}</DialogTitle>
              <DialogDescription className={styles.meta}>
                <span aria-hidden="true">
                  {shownDates ? `${place.category} · ${shownDates}` : place.category}
                </span>
                <span className="sr-only">
                  {heardDates ? `${place.category}, ${heardDates}` : place.category}
                </span>
              </DialogDescription>
              {photo.caption ? <p className={styles.words}>{photo.caption}</p> : null}
            </div>
            <Link
              href={`/places/${encodeURIComponent(photo.placeId)}`}
              prefetch={false}
              className={styles['open-link']}
            >
              Open place
              <FiArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <DialogClose ref={closeRef} className={styles.close} aria-label="Close">
            <FiX aria-hidden="true" className="size-4" />
          </DialogClose>
          <DialogClose ref={doneRef} className={styles.done}>
            Done
          </DialogClose>
        </DialogPrimitive.Content>
      </div>
    </>
  );
}

/** The open photo, in a modal Radix dialog that closes by flying (or fading) back. */
export function LivePhotoDialog({ opened, onClosed }: LivePhotoDialogProps): ReactElement {
  const closeRoutine = useRef<(() => void) | null>(null);
  const register = useCallback((close: () => void) => {
    closeRoutine.current = close;
  }, []);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (open) return;
        if (closeRoutine.current) closeRoutine.current();
        else onClosed();
      }}
    >
      <DialogPortal>
        <FlyingPanel
          key={opened.photo.key}
          opened={opened}
          register={register}
          onClosed={onClosed}
        />
      </DialogPortal>
    </Dialog>
  );
}
