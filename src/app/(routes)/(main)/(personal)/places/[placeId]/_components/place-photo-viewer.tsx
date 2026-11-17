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

import { AnimatePresence, motion, useMotionValue } from 'motion/react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
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
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPanningZoom, setIsPanningZoom] = useState(false);
  const [fullscreenMessage, setFullscreenMessage] = useState('');

  const fullscreenRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomX = useMotionValue(0);
  const zoomY = useMotionValue(0);

  const currentPhoto = photos[currentPhotoIndex];
  const imageUrl = currentPhoto?.url ?? '';

  const paginate = useCallback(
    (newDirection: number) => {
      if (zoom > 1) return;
      const newIndex = currentPhotoIndex + newDirection;
      if (newIndex >= 0 && newIndex < photos.length) {
        setPage([newIndex, newDirection]);
        setZoom(1);
        zoomX.set(0);
        zoomY.set(0);
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
      zoomX.set(0);
      zoomY.set(0);
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
      zoomX.set(0);
      zoomY.set(0);
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
      zoomX.set(0);
      zoomY.set(0);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [zoomX, zoomY]);

  const handleZoomIn = useCallback(() => {
    setZoom((prevZoom) => Math.min(prevZoom + 0.2, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prevZoom) => {
      const newZoom = Math.max(prevZoom - 0.2, 1);
      if (newZoom === 1) {
        zoomX.set(0);
        zoomY.set(0);
      }
      return newZoom;
    });
  }, [zoomX, zoomY]);

  const handlePanStart = useCallback(() => {
    if (zoom > 1) {
      setIsPanningZoom(true);
    }
  }, [zoom]);

  const handlePanEnd = useCallback(() => {
    setIsPanningZoom(false);
  }, []);

  const handlePan = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isPanningZoom && imageRef.current && containerRef.current) {
        const image = imageRef.current;
        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;
        // The <img> fills its box, and object-contain letterboxes the photo inside it. Clamp to the
        // photo as drawn, so a zoomed portrait can't be dragged out of view.
        const drawnScale =
          image.naturalWidth && image.naturalHeight
            ? Math.min(
                image.offsetWidth / image.naturalWidth,
                image.offsetHeight / image.naturalHeight,
              )
            : 1;
        const imageWidth =
          (image.naturalWidth ? image.naturalWidth * drawnScale : image.offsetWidth) * zoom;
        const imageHeight =
          (image.naturalHeight ? image.naturalHeight * drawnScale : image.offsetHeight) * zoom;

        const maxX = Math.max(0, (imageWidth - containerWidth) / 2);
        const maxY = Math.max(0, (imageHeight - containerHeight) / 2);

        const newX = zoomX.get() + event.movementX;
        const newY = zoomY.get() + event.movementY;

        zoomX.set(Math.max(-maxX, Math.min(maxX, newX)));
        zoomY.set(Math.max(-maxY, Math.min(maxY, newY)));
      }
    },
    [isPanningZoom, zoom, zoomX, zoomY],
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
                <div
                  ref={containerRef}
                  className={cn(
                    'relative select-none flex items-center justify-center w-full h-full',
                    zoom > 1 && 'cursor-move',
                    zoom === 1 && photos.length > 1 && 'cursor-grab active:cursor-grabbing',
                  )}
                  style={{ touchAction: zoom > 1 ? 'none' : 'pan-y' }}
                  onPointerDown={handlePanStart}
                  onPointerUp={handlePanEnd}
                  onPointerLeave={handlePanEnd}
                  onPointerMove={handlePan}
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
                    disabled={currentPhotoIndex === 0}
                    aria-label="Previous photo"
                  >
                    <FiChevronLeft aria-hidden="true" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => goTo(currentPhotoIndex + 1)}
                    disabled={currentPhotoIndex === photos.length - 1}
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
                disabled={zoom >= 3}
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
                disabled={zoom === 1}
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
export default PlacePhotoViewer;
