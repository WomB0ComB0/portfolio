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

import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { DraggableGalleryProps } from './draggable-gallery.types';

export const DraggableGallery = ({ images, className }: DraggableGalleryProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [dragConstraints, setDragConstraints] = useState({ left: 0, right: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Calculate drag constraints based on content width
  useEffect(() => {
    const updateConstraints = () => {
      if (containerRef.current && contentRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const contentWidth = contentRef.current.scrollWidth;
        const maxDrag = Math.min(0, containerWidth - contentWidth);
        setDragConstraints({ left: maxDrag, right: 0 });
      }
    };

    updateConstraints();
    window.addEventListener('resize', updateConstraints);
    return () => window.removeEventListener('resize', updateConstraints);
  }, []);

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
          dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
          className="flex gap-4 py-2"
        >
          {images.map((image, index) => (
            <motion.div
              key={index}
              className="relative shrink-0 w-80 h-56 rounded-xl overflow-hidden bg-muted border border-border group"
              onHoverStart={() => setHoveredIndex(index)}
              onHoverEnd={() => setHoveredIndex(null)}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <Image
                src={image?.url || '/assets/svgs/logo.svg'}
                alt={image?.alt || 'Gallery image'}
                fill
                className="object-cover pointer-events-none"
                draggable={false}
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
            Drag to explore
          </div>
        )}
      </div>

      <AnimatePresence>
        {hoveredIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setHoveredIndex(null)}
            />

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative max-w-5xl max-h-[85vh] w-full h-full"
            >
              <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src={images[hoveredIndex]?.url || '/assets/svgs/logo.svg'}
                  alt={images[hoveredIndex]?.alt || 'Expanded Image'}
                  fill
                  className="object-contain"
                  priority
                />
              </div>

              <button
                onClick={() => setHoveredIndex(null)}
                className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-background border-2 border-border hover:border-primary flex items-center justify-center transition-colors shadow-lg"
                aria-label="Close expanded view"
              >
                <X className="h-5 w-5 text-foreground" />
              </button>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="absolute -bottom-16 left-0 right-0 text-center"
              >
                <p className="text-white text-lg font-medium drop-shadow-lg">
                  {images[hoveredIndex]?.alt}
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
DraggableGallery.displayName = 'DraggableGallery';
export default DraggableGallery;
