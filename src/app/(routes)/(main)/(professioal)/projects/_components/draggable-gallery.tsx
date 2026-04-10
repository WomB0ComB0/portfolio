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

import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface DraggableGalleryProps {
  images: Array<{ url: string; alt: string }>;
  className?: string;
}

export const DraggableGallery = ({ images, className }: DraggableGalleryProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [dragConstraints, setDragConstraints] = useState({ left: 0, right: 0 });
  const [dragStartX, setDragStartX] = useState(0);
  const [hasDragged, setHasDragged] = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateConstraints = useCallback(() => {
    if (containerRef.current && contentRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const contentWidth = contentRef.current.scrollWidth;
      const maxDrag = Math.min(0, containerWidth - contentWidth);
      setDragConstraints({ left: maxDrag, right: 0 });
    }
  }, []);

  useEffect(() => {
    updateConstraints();
    window.addEventListener('resize', updateConstraints);
    return () => window.removeEventListener('resize', updateConstraints);
  }, [updateConstraints]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (selectedIndex === null) {
      document.body.style.overflow = '';
    } else {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedIndex]);

  if (!images || images.length === 0) {
    return <div className="w-full p-8 text-center text-muted-foreground">No images to display</div>;
  }

  const modalContent = selectedIndex !== null && (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-9999 flex items-center justify-center p-4 md:p-8"
        onClick={() => setSelectedIndex(null)}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          className="relative z-10 w-[95vw] h-[90vh] flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative w-full h-full rounded-2xl shadow-2xl ring-2 ring-white/20 overflow-hidden bg-black/80">
            <Image
              src={images[selectedIndex]?.url || '/assets/svgs/logo.svg'}
              alt={images[selectedIndex]?.alt || 'Expanded Image'}
              fill
              className="object-contain p-2"
              priority
              sizes="95vw"
            />
          </div>

          {images[selectedIndex]?.alt && (
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="absolute -bottom-12 left-0 right-0 text-center px-4"
            >
              <p className="text-white/90 text-base md:text-lg font-medium drop-shadow-lg">
                {images[selectedIndex].alt}
              </p>
            </motion.div>
          )}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="absolute top-6 left-1/2 -translate-x-1/2 text-white/60 text-sm pointer-events-none hidden md:block"
        >
          Click outside or press ESC to close
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return (
    <>
      <div
        ref={containerRef}
        className={cn(
          'relative w-full overflow-hidden cursor-grab active:cursor-grabbing',
          className,
        )}
      >
        <motion.div
          ref={contentRef}
          drag="x"
          dragConstraints={dragConstraints}
          dragElastic={0.1}
          onPointerDown={(e) => {
            setDragStartX(e.clientX);
            setHasDragged(false);
          }}
          onDrag={(_e, info) => {
            const dragDistance = Math.abs(info.point.x - dragStartX);
            if (dragDistance > 5) {
              setHasDragged(true);
            }
          }}
          onPointerUp={() => {
            setTimeout(() => setHasDragged(false), 100);
          }}
          dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
          className="flex gap-4 py-2"
        >
          {images.map((image, index) => (
            <motion.div
              key={`image-${+index}`}
              className="relative shrink-0 w-80 h-56 md:w-96 md:h-64 lg:w-[480px] lg:h-80 xl:w-[560px] xl:h-96 rounded-xl overflow-hidden bg-muted border border-border group cursor-pointer"
              onClick={() => {
                if (!hasDragged) {
                  setSelectedIndex(index);
                }
              }}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <Image
                src={image?.url || '/assets/svgs/logo.svg'}
                alt={image?.alt || 'Gallery image'}
                fill
                className="object-cover pointer-events-none"
                draggable={false}
                sizes="320px"
              />

              <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-white text-sm font-medium line-clamp-2">{image.alt}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {images.length > 2 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-background/80 backdrop-blur-sm border border-border rounded-full text-xs text-muted-foreground pointer-events-none">
            Drag to explore • Click to expand
          </div>
        )}
      </div>

      {/* Render modal in portal to escape parent constraints */}
      {mounted && globalThis.window !== undefined && createPortal(modalContent, document.body)}
    </>
  );
};
DraggableGallery.displayName = 'DraggableGallery';
export default DraggableGallery;
