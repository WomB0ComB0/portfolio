'use client';

import { AnimatePresence, motion, useMotionValue } from 'framer-motion';
import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiMaximize, FiX, FiZoomIn, FiZoomOut } from 'react-icons/fi';
import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlaces } from '@/hooks/sanity/use-sanity-query';
import { urlFor } from '@/lib/sanity/client';
import type { SanityImage } from '@/lib/sanity/types';
import { cn } from '@/lib/utils';

interface PhotoModalProps {
  params: Promise<{
    placeId: string;
  }>;
}

interface PhotoWithCaption extends SanityImage {
  caption?: string;
}

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

export default function PlacePhotosPage({ params }: PhotoModalProps) {
  const { placeId } = use(params);
  const { data: sanityPlaces, isLoading } = usePlaces();
  const [[currentPhotoIndex, direction], setPage] = useState([0, 0]);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPanningZoom, setIsPanningZoom] = useState(false);

  const fullscreenRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomX = useMotionValue(0);
  const zoomY = useMotionValue(0);

  const place = useMemo(
    () => sanityPlaces?.find((p) => p._id === placeId),
    [sanityPlaces, placeId],
  );

  const photos = useMemo(() => (place?.photos || []) as PhotoWithCaption[], [place]);

  const currentPhoto = photos[currentPhotoIndex];
  const imageUrl = currentPhoto?.asset
    ? urlFor(currentPhoto.asset).width(1600).height(1200).url()
    : '';

  const paginate = useCallback(
    (newDirection: number) => {
      if (zoom > 1) return; // Don't paginate when zoomed in
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
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

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
        const imageWidth = imageRef.current.offsetWidth * zoom;
        const imageHeight = imageRef.current.offsetHeight * zoom;
        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;

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

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
          <Card className="w-full max-w-7xl">
            <CardHeader className="space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-full max-w-md" />
            </CardHeader>
            <CardContent>
              <Skeleton className="w-full aspect-[16/9] rounded-lg" />
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!place || photos.length === 0) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
          <Card className="max-w-md">
            <CardContent className="flex flex-col items-center gap-6 p-12 text-center">
              <div className="space-y-3">
                <h2 className="text-2xl font-bold">No Photos Available</h2>
                <p className="text-muted-foreground">This place doesn't have any photos yet.</p>
              </div>
              <Link href="/places">
                <Button variant="outline" size="lg">
                  Back to Places
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen p-4 md:p-8"
      >
        <div className="w-full max-w-7xl mx-auto">
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <h1 className="text-3xl md:text-4xl font-bold">{place.name}</h1>
                  {place.description && (
                    <p className="text-muted-foreground leading-relaxed">{place.description}</p>
                  )}
                </div>
                <Link href="/places">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label="Close photo viewer"
                  >
                    <FiX className="h-5 w-5" />
                  </Button>
                </Link>
              </div>

              {photos.length > 1 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium">
                    Photo {currentPhotoIndex + 1} of {photos.length}
                  </span>
                  <span className="text-xs opacity-70">← Drag to navigate →</span>
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-6">
              <div
                ref={fullscreenRef}
                className={cn(
                  'relative w-full aspect-[16/9] bg-muted rounded-lg overflow-hidden',
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
                    className="absolute w-full h-full"
                  >
                    {imageUrl ? (
                      <div
                        ref={containerRef}
                        className={cn(
                          'w-full h-full select-none flex items-center justify-center',
                          zoom > 1 && 'cursor-move',
                          zoom === 1 && photos.length > 1 && 'cursor-grab active:cursor-grabbing',
                        )}
                        onPointerDown={handlePanStart}
                        onPointerUp={handlePanEnd}
                        onPointerLeave={handlePanEnd}
                        onPointerMove={handlePan}
                      >
                        <motion.img
                          ref={imageRef}
                          src={imageUrl}
                          alt={currentPhoto?.caption || `Photo of ${place.name}`}
                          className="object-contain max-w-full max-h-full"
                          style={{
                            scale: zoom,
                            x: zoomX,
                            y: zoomY,
                          }}
                          draggable={false}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-muted-foreground">No image available</p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <AnimatePresence>
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
                        <span className="px-2 text-sm font-medium min-w-[3rem] text-center">
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
                        {isFullscreen ? (
                          <FiX className="h-4 w-4" />
                        ) : (
                          <FiMaximize className="h-4 w-4" />
                        )}
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {currentPhoto?.caption && (
                <motion.div
                  key={`caption-${currentPhotoIndex}`}
                  initial={{ opacity: 0, y: 10 }}
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
                    <button
                      key={index}
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
          </Card>
        </div>
      </motion.div>
    </Layout>
  );
}
