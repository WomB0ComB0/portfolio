'use client';

/**
 * Copyright 2025 Mike Odnis
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

import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react';
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  FiChevronLeft,
  FiChevronRight,
  FiMaximize,
  FiX,
  FiZoomIn,
  FiZoomOut,
} from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import Image from '@/components/ui/cdn-image';
import { prefersReducedMotion, SPRING } from '@/lib/design/motion';
import { cn } from '@/lib/utils';
import type { ViewerPhoto } from '../page.types';
import { PhotoStrip } from './photo-strip';
import styles from './place-photo-viewer.module.css';

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

const variants = {
  enter: (direction: number) => {
    return {
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    };
  },
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => {
    return {
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
    };
  },
};

const MotionImage = motion.create(Image);

/** The caption's entrance when the photo changes. The first photo's is server content: no fade. */
const CAPTION_ENTER = { opacity: 0, y: 10 };

/**
 * Image area inside the stage's 1px border: PageShell uses clamp(16px, 8px + 2vw, 32px)
 * gutters, then the 64px desktop rail and 1200px shell cap. Keep the vw term visible to Next's
 * srcset sizing so full-width photographs never receive an icon-sized source.
 */
const FRAME_SIZES =
  '(max-width: 400px) calc(-34px + 100vw), (max-width: 1023px) calc(-18px + 96vw), (max-width: 1199px) calc(-82px + 96vw), (max-width: 1263px) calc(-130px + 100vw), 1134px';

/** The zoom the photo opens at, and the furthest Zoom in goes. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

/** How far one arrow key press pans a zoomed photo, in CSS pixels. */
export const PAN_STEP_PX = 40;

/** A press that ends further than this from where it began was a drag, not a click to centre. */
const CLICK_SLOP_PX = 6;

/**
 * Which way each arrow key moves the photo. A key moves the view, as it scrolls a page: Right
 * shows more of the photo's right side, so the photo itself moves left.
 */
const PAN_KEYS: ReadonlyMap<string, readonly [x: number, y: number]> = new Map([
  ['ArrowLeft', [1, 0]],
  ['ArrowRight', [-1, 0]],
  ['ArrowUp', [0, 1]],
  ['ArrowDown', [0, -1]],
]);

/**
 * What the zoomed photo's surface tells everyone, on screen and as its description. A tap centres
 * a spot as a click does, so the words name both.
 */
const PAN_HINT =
  'Drag the photo, click or tap a spot to centre it, or use the arrow keys to move around.';

/** The pan surface's name while zoomed: what it is, and the photo it holds. */
const zoomedPhotoLabel = (alt: string | undefined): string =>
  alt ? `Zoomed photo: ${alt}` : 'Zoomed photo';

const clampPan = (value: number, limit: number): number => Math.max(-limit, Math.min(limit, value));

interface PlacePhotoViewerProps {
  /** At least one photo, with URLs built on the server. */
  photos: readonly ViewerPhoto[];
  /** Names the photo strip ("Photos of <place>"). */
  placeName: string;
  /** Optional context for an embedded viewer; the detail page uses a server PageShell. */
  summary?: ReactNode;
}

/** A whole-photo journal stage; the page surrounds it, fullscreen surrounds only its controls. */
export function PlacePhotoViewer({ photos, placeName, summary }: PlacePhotoViewerProps) {
  const [[currentPhotoIndex, direction], setPage] = useState([0, 0]);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPanningZoom, setIsPanningZoom] = useState(false);
  const [fullscreenMessage, setFullscreenMessage] = useState('');
  const panHintId = useId();

  const fullscreenRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Where the current press began, so its click can tell a drag from a click to centre. */
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  /** Where a glide still under way will leave the photo, so quick key presses add up. */
  const panGoalRef = useRef({ x: 0, y: 0 });
  const zoomX = useMotionValue(0);
  const zoomY = useMotionValue(0);

  const currentPhoto = photos[currentPhotoIndex];
  const imageUrl = currentPhoto?.url ?? '';
  const isZoomed = zoom > MIN_ZOOM;

  const paginate = useCallback(
    (newDirection: number) => {
      if (zoom > 1) return;
      const newIndex = currentPhotoIndex + newDirection;
      if (newIndex >= 0 && newIndex < photos.length) {
        setPage([newIndex, newDirection]);
        setZoom(1);
        zoomX.jump(0);
        zoomY.jump(0);
      }
    },
    [currentPhotoIndex, photos.length, zoom, zoomX, zoomY],
  );

  /** Shows photo `index` (the strip's pick), sliding in from its side, at 100% zoom. */
  const goTo = useCallback(
    (index: number) => {
      if (index === currentPhotoIndex || index < 0 || index >= photos.length) return;
      setPage([index, index > currentPhotoIndex ? 1 : -1]);
      setZoom(1);
      zoomX.jump(0);
      zoomY.jump(0);
    },
    [currentPhotoIndex, photos.length, zoomX, zoomY],
  );

  const toggleFullscreen = useCallback(async () => {
    const target = fullscreenRef.current;
    if (!target) return;
    setFullscreenMessage('');
    try {
      if (document.fullscreenElement === target) await document.exitFullscreen();
      else await target.requestFullscreen();
      setIsFullscreen(document.fullscreenElement === target);
      setZoom(1);
      zoomX.jump(0);
      zoomY.jump(0);
    } catch {
      // Unsupported or denied fullscreen leaves the ordinary gallery fully usable.
      setFullscreenMessage(
        'Fullscreen is unavailable in this browser. You can still zoom the photo.',
      );
    }
  }, [zoomX, zoomY]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === fullscreenRef.current);
      setZoom(1);
      zoomX.jump(0);
      zoomY.jump(0);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [zoomX, zoomY]);

  const handleZoomIn = useCallback(() => {
    setZoom((prevZoom) => Math.min(prevZoom + 0.2, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prevZoom) => {
      const newZoom = Math.max(prevZoom - 0.2, MIN_ZOOM);
      if (newZoom === MIN_ZOOM) {
        // jump, not set: it also stops a glide (panTo) still under way.
        zoomX.jump(0);
        zoomY.jump(0);
      }
      return newZoom;
    });
  }, [zoomX, zoomY]);

  /**
   * How far the zoomed photo may move from centre each way before an edge comes into view, or null
   * before the photo is laid out. The <img> fills its box, and object-contain letterboxes the photo
   * inside it. Clamp to the photo as drawn, so a zoomed portrait can't be moved out of view.
   */
  const panLimits = useCallback((): { maxX: number; maxY: number } | null => {
    const image = imageRef.current;
    const container = containerRef.current;
    if (!image || !container) return null;
    const drawnScale =
      image.naturalWidth && image.naturalHeight
        ? Math.min(image.offsetWidth / image.naturalWidth, image.offsetHeight / image.naturalHeight)
        : 1;
    const imageWidth =
      (image.naturalWidth ? image.naturalWidth * drawnScale : image.offsetWidth) * zoom;
    const imageHeight =
      (image.naturalHeight ? image.naturalHeight * drawnScale : image.offsetHeight) * zoom;
    return {
      maxX: Math.max(0, (imageWidth - container.offsetWidth) / 2),
      maxY: Math.max(0, (imageHeight - container.offsetHeight) / 2),
    };
  }, [zoom]);

  /** Where the photo is headed: the end of a glide still under way, else where it is. */
  const panPosition = useCallback(
    () => ({
      x: zoomX.isAnimating() ? panGoalRef.current.x : zoomX.get(),
      y: zoomY.isAnimating() ? panGoalRef.current.y : zoomY.get(),
    }),
    [zoomX, zoomY],
  );

  /**
   * Moves the zoomed photo to (x, y), clamped to its edges as a drag is: a short glide on the
   * no-bounce spring, so the eye can follow where it went, or at once under reduced motion.
   */
  const panTo = useCallback(
    (x: number, y: number) => {
      const limits = panLimits();
      if (!limits) return;
      const goal = { x: clampPan(x, limits.maxX), y: clampPan(y, limits.maxY) };
      panGoalRef.current = goal;
      if (prefersReducedMotion()) {
        zoomX.jump(goal.x);
        zoomY.jump(goal.y);
        return;
      }
      animate(zoomX, goal.x, SPRING);
      animate(zoomY, goal.y, SPRING);
    },
    [panLimits, zoomX, zoomY],
  );

  /**
   * A zoom step changes how far the photo may move, so a pan past the new edges (one made at a
   * higher zoom, by any means) comes back to them in the same step: zooming out from an edge at
   * 300% leaves the photo's corner on the stage's, not off in a corner until the next pan. The
   * zoom itself steps at once, so the pan jumps with it; a glide still under way is sent to the
   * new edge instead, on its spring (or at once under reduced motion, as panTo does).
   */
  useEffect(() => {
    const limits = panLimits();
    if (!limits) return;
    const { x, y } = panPosition();
    const goal = { x: clampPan(x, limits.maxX), y: clampPan(y, limits.maxY) };
    if (goal.x === x && goal.y === y) return;
    if (zoomX.isAnimating() || zoomY.isAnimating()) {
      panTo(goal.x, goal.y);
      return;
    }
    panGoalRef.current = goal;
    zoomX.jump(goal.x);
    zoomY.jump(goal.y);
  }, [panLimits, panPosition, panTo, zoomX, zoomY]);

  /** The arrow keys pan a zoomed photo a step a press; modified arrows stay the browser's. */
  const handlePanKey = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = PAN_KEYS.get(event.key);
      if (!isZoomed || !step || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const { x, y } = panPosition();
      panTo(x + step[0] * PAN_STEP_PX, y + step[1] * PAN_STEP_PX);
    },
    [isZoomed, panPosition, panTo],
  );

  /**
   * A click or tap on a zoomed photo brings that spot to the centre: panning with one pointer and
   * no drag. A press that moved before it was let go was a drag, and its click is ignored.
   */
  const handleCentre = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const start = pressStartRef.current;
      pressStartRef.current = null;
      if (!isZoomed) return;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) {
        return;
      }
      const box = event.currentTarget.getBoundingClientRect();
      const { x, y } = panPosition();
      panTo(
        x - (event.clientX - (box.left + box.width / 2)),
        y - (event.clientY - (box.top + box.height / 2)),
      );
    },
    [isZoomed, panPosition, panTo],
  );

  const handlePanStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      pressStartRef.current = { x: event.clientX, y: event.clientY };
      if (zoom > 1) {
        // A drag takes over from a glide still under way.
        zoomX.stop();
        zoomY.stop();
        setIsPanningZoom(true);
      }
    },
    [zoom, zoomX, zoomY],
  );

  const handlePanEnd = useCallback(() => {
    setIsPanningZoom(false);
  }, []);

  const handlePan = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const limits = isPanningZoom ? panLimits() : null;
      if (!limits) return;
      zoomX.set(clampPan(zoomX.get() + event.movementX, limits.maxX));
      zoomY.set(clampPan(zoomY.get() + event.movementY, limits.maxY));
    },
    [isPanningZoom, panLimits, zoomX, zoomY],
  );

  return (
    <figure className={styles.journal} aria-label={`Photos from ${placeName}`}>
      {summary}
      <div
        ref={fullscreenRef}
        className={cn(styles.viewer, isFullscreen && styles.fullscreen)}
        data-place-photo-viewer=""
      >
        <div className={styles.stage} data-place-photo-stage="">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={currentPhotoIndex}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: 'spring', stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
              }}
              drag={zoom === 1 && photos.length > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={1}
              onDragEnd={(_event, { offset, velocity }) => {
                if (zoom !== 1) return;
                const swipe = swipePower(offset.x, velocity.x);
                if (swipe < -swipeConfidenceThreshold) paginate(1);
                else if (swipe > swipeConfidenceThreshold) paginate(-1);
              }}
              className="absolute inset-0"
            >
              {imageUrl ? (
                // Zoomed, the photo is a pan surface: a Tab stop the arrow keys move around
                // (application, so screen readers hand it the keys), named and described by the
                // hint under the controls. At 100% it is just the photo; tabIndex -1 keeps it
                // focusable then, so focus is not dropped when the zoom resets under it. The stage
                // clips the site's outer ring, so the surface draws its own inside (pan-surface).
                // biome-ignore lint/a11y/noStaticElementInteractions: role="application" while zoomed (arrow keys pan, a click centres); Biome cannot follow the conditional role, and at 100% both handlers do nothing.
                // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-label is set only with role="application" (while zoomed); Biome cannot follow the conditional role.
                <div
                  ref={containerRef}
                  role={isZoomed ? 'application' : undefined}
                  aria-label={isZoomed ? zoomedPhotoLabel(currentPhoto?.alt) : undefined}
                  aria-describedby={isZoomed ? panHintId : undefined}
                  tabIndex={isZoomed ? 0 : -1}
                  className={cn(
                    'relative select-none flex items-center justify-center w-full h-full',
                    styles['pan-surface'],
                    zoom > 1 && 'cursor-move',
                    zoom === 1 && photos.length > 1 && 'cursor-grab active:cursor-grabbing',
                  )}
                  style={{ touchAction: zoom > 1 ? 'none' : 'pan-y' }}
                  onPointerDown={handlePanStart}
                  onPointerUp={handlePanEnd}
                  onPointerLeave={handlePanEnd}
                  onPointerMove={handlePan}
                  onClick={handleCentre}
                  onKeyDown={handlePanKey}
                >
                  <MotionImage
                    src={imageUrl}
                    alt={currentPhoto?.alt ?? ''}
                    ref={imageRef}
                    fill
                    className="object-contain"
                    sizes={isFullscreen ? '100vw' : FRAME_SIZES}
                    draggable={false}
                    style={{ scale: zoom, x: zoomX, y: zoomY }}
                    loading="eager"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-muted-foreground">No image available</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* At an end or a zoom limit a button is aria-disabled, not disabled: a browser drops focus
            from a button that turns disabled under it. Its click is then a no-op (goTo and the zoom
            steps ignore a move past the limit), and it looks disabled (Button, and the CSS). */}
        <div className={styles.controls} data-place-photo-controls="">
          <div className={styles.position}>
            {photos.length > 1 && (
              <>
                <span
                  className="tile-label text-muted-foreground tabular-nums"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  Photo {currentPhotoIndex + 1} of {photos.length}
                </span>
                <div className={styles.buttons}>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => goTo(currentPhotoIndex - 1)}
                    aria-disabled={currentPhotoIndex === 0}
                    aria-label="Previous photo"
                  >
                    <FiChevronLeft aria-hidden="true" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => goTo(currentPhotoIndex + 1)}
                    aria-disabled={currentPhotoIndex === photos.length - 1}
                    aria-label="Next photo"
                  >
                    <FiChevronRight aria-hidden="true" />
                  </Button>
                </div>
              </>
            )}
          </div>
          {imageUrl && (
            <div className={styles.buttons}>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleZoomIn}
                aria-disabled={zoom >= MAX_ZOOM}
                aria-label="Zoom in"
              >
                <FiZoomIn aria-hidden="true" />
              </Button>
              <span className="min-w-10 text-center tile-label tabular-nums text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleZoomOut}
                aria-disabled={zoom === MIN_ZOOM}
                aria-label="Zoom out"
              >
                <FiZoomOut aria-hidden="true" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? <FiX aria-hidden="true" /> : <FiMaximize aria-hidden="true" />}
              </Button>
            </div>
          )}
        </div>
        {isZoomed && imageUrl && (
          <p id={panHintId} className="tile-meta text-muted-foreground">
            {PAN_HINT}
          </p>
        )}
        {fullscreenMessage && (
          <p role="status" className="tile-meta text-muted-foreground">
            {fullscreenMessage}
          </p>
        )}
      </div>

      {photos.length > 1 && (
        <PhotoStrip
          photos={photos}
          index={currentPhotoIndex}
          onPick={goTo}
          label={`Photos of ${placeName}`}
        />
      )}

      {currentPhoto?.caption && (
        <figcaption className={styles.caption}>
          <motion.p
            key={`caption-${currentPhotoIndex}`}
            initial={direction === 0 ? false : CAPTION_ENTER}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {currentPhoto.caption}
          </motion.p>
        </figcaption>
      )}
    </figure>
  );
}

PlacePhotoViewer.displayName = 'PlacePhotoViewer';
