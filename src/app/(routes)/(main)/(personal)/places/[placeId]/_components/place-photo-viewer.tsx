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
import Image from 'next/image';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { FiMaximize, FiX, FiZoomIn, FiZoomOut } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ViewerPhoto } from '../page.types';

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
 * The photo frame's rendered width, so next/image fetches a candidate as wide as it is drawn. The
 * frame is main minus the page's p-4 (p-8 from md), the card's 1 px border and CardContent's px-6:
 * main is the viewport below lg, then the viewport minus the 64 px rail, capped at max-w-shell
 * (1200 px) from a 1264 px viewport, where the frame stops at 1086 px. The old 50vw, set for the
 * 60% column, picked a 640-750 w file for that 1086 px frame and upscaled it.
 *
 * Each calc puts 100vw after a space on purpose: next/image trims its srcset by the smallest vw
 * length in `sizes`, but only spots one that follows a space or starts the string. Written
 * calc(100vw - 82px) it finds none and lists the 16-40 w icon sizes as well, which made the
 * preload selector too long for jsdom in place-details-page.test.tsx.
 */
const FRAME_SIZES =
  '(max-width: 767px) calc(-82px + 100vw), (max-width: 1023px) calc(-114px + 100vw), (max-width: 1263px) calc(-178px + 100vw), 1086px';

interface PlacePhotoViewerProps {
  /** At least one photo, with URLs built on the server. */
  photos: readonly ViewerPhoto[];
  /** The card header's content above the "Photo n of m" line: the place's summary. */
  summary: ReactNode;
}

/**
 * The place page's photo carousel: swipe or the dots to move between photos, zoom and pan, and
 * fullscreen. It renders the card's header (the summary passed in, then the photo position) and
 * its content; the page renders the card around it.
 */
export function PlacePhotoViewer({ photos, summary }: PlacePhotoViewerProps) {
  const [[currentPhotoIndex, direction], setPage] = useState([0, 0]);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPanningZoom, setIsPanningZoom] = useState(false);

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

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      fullscreenRef.current?.requestFullscreen();
      setIsFullscreen(true);
      setZoom(1);
      zoomX.set(0);
      zoomY.set(0);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
      setZoom(1);
      zoomX.set(0);
      zoomY.set(0);
    }
  }, [zoomX, zoomY]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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
    <>
      <CardHeader className="space-y-4">
        {summary}

        {photos.length > 1 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {/* Geist's digits are proportional: tabular-nums stops the hint beside it shifting. */}
            <span className="font-medium tabular-nums">
              Photo {currentPhotoIndex + 1} of {photos.length}
            </span>
            {/* text-faint, not opacity-70: the darker muted token at 70% fell below 4.5:1 here. */}
            <span className="text-xs text-faint">← Drag to navigate →</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        <div
          ref={fullscreenRef}
          className={cn(
            'relative w-full aspect-video bg-muted rounded-lg overflow-hidden',
            isFullscreen && 'fixed inset-0 z-50 bg-black rounded-none aspect-auto',
          )}
        >
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
              onDragEnd={(_e, { offset, velocity }) => {
                if (zoom === 1) {
                  const swipe = swipePower(offset.x, velocity.x);

                  if (swipe < -swipeConfidenceThreshold) {
                    paginate(1);
                  } else if (swipe > swipeConfidenceThreshold) {
                    paginate(-1);
                  }
                }
              }}
              className="absolute inset-0" // ensure it truly fills the wrapper
            >
              {imageUrl ? (
                <div
                  ref={containerRef}
                  // Fill the frame so object-contain shows every photo whole and centred. A
                  // fixed 4:3 box overflowed the 16:9 frame and clipped the bottom quarter.
                  className={cn(
                    'relative select-none flex items-center justify-center w-full h-full',
                    zoom > 1 && 'cursor-move',
                    zoom === 1 && photos.length > 1 && 'cursor-grab active:cursor-grabbing',
                  )}
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
                    priority={true} // optional
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-muted-foreground">No image available</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* initial={false}: the controls are in the server HTML, so they show at once rather
              than sit invisible (yet focusable) at opacity 0 until hydration fades them in. */}
          <AnimatePresence initial={false}>
            {imageUrl && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-4 right-4 flex items-center gap-2 pointer-events-auto z-10"
              >
                <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-lg p-1 shadow-lg">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleZoomIn}
                    disabled={zoom >= 3}
                    aria-label="Zoom in"
                  >
                    <FiZoomIn className="h-4 w-4" />
                  </Button>
                  <span className="px-2 text-sm font-medium min-win-12 text-center tabular-nums">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleZoomOut}
                    disabled={zoom === 1}
                    aria-label="Zoom out"
                  >
                    <FiZoomOut className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  size="icon"
                  variant="secondary"
                  onClick={toggleFullscreen}
                  className="shadow-lg"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  {isFullscreen ? <FiX className="h-4 w-4" /> : <FiMaximize className="h-4 w-4" />}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {currentPhoto?.caption && (
          <motion.div
            key={`caption-${currentPhotoIndex}`}
            // direction is 0 only before the first move: the server-rendered caption shows at once.
            initial={direction === 0 ? false : CAPTION_ENTER}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-muted/50 rounded-lg p-6"
          >
            <p className="text-sm text-muted-foreground leading-relaxed italic text-center">
              {currentPhoto.caption}
            </p>
          </motion.div>
        )}

        {photos.length > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            {photos.map((_, index) => (
              <Button
                key={`${+index}`}
                onClick={() => {
                  const newDirection = index > currentPhotoIndex ? 1 : -1;
                  setPage([index, newDirection]);
                  setZoom(1);
                  zoomX.set(0);
                  zoomY.set(0);
                }}
                className={cn(
                  'h-2 rounded-full transition-all',
                  index === currentPhotoIndex
                    ? 'w-8 bg-primary'
                    : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50',
                )}
                aria-label={`Go to photo ${index + 1}`}
              />
            ))}
          </div>
        )}
      </CardContent>
    </>
  );
}

PlacePhotoViewer.displayName = 'PlacePhotoViewer';
export default PlacePhotoViewer;
