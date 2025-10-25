"use client"

import { motion, AnimatePresence } from "motion/react"
import Image from "next/image"
import { useState, useRef, useEffect } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { urlFor } from "@/lib"

interface DraggableGalleryProps {
  images: Array<{
    url: string
    alt: string
  }>
  className?: string
}

export const DraggableGallery = ({ images, className }: DraggableGalleryProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [dragConstraints, setDragConstraints] = useState({ left: 0, right: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Calculate drag constraints based on content width
  useEffect(() => {
    const updateConstraints = () => {
      if (containerRef.current && contentRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        const contentWidth = contentRef.current.scrollWidth
        const maxDrag = Math.min(0, containerWidth - contentWidth)
        setDragConstraints({ left: maxDrag, right: 0 })
      }
    }

    updateConstraints()
    window.addEventListener("resize", updateConstraints)
    return () => window.removeEventListener("resize", updateConstraints)
  }, [images])

  return (
    <>
      {/* Gallery Container */}
      <div
        ref={containerRef}
        className={cn("relative w-full overflow-hidden cursor-grab active:cursor-grabbing", className)}
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
              className="relative flex-shrink-0 w-80 h-56 rounded-xl overflow-hidden bg-muted border border-border group"
              onHoverStart={() => setHoveredIndex(index)}
              onHoverEnd={() => setHoveredIndex(null)}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <Image

                src={urlFor(image.url).width(1200).height(675).url() || '/placeholder.svg'}
                alt={image.alt}
                fill
                className="object-cover pointer-events-none"
                draggable={false}
              />

              {/* Overlay hint */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-white text-sm font-medium line-clamp-2">{image.alt}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Drag hint */}
        {images.length > 2 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-background/80 backdrop-blur-sm border border-border rounded-full text-xs text-muted-foreground pointer-events-none">
            Drag to explore
          </div>
        )}
      </div>

      {/* Expanded Image Overlay */}
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
            {/* Dark backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setHoveredIndex(null)}
            />

            {/* Expanded image */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-5xl max-h-[85vh] w-full h-full"
            >
              <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src={images[hoveredIndex]!.url || "/placeholder.svg"}
                  alt={images[hoveredIndex]!.alt}
                  fill
                  className="object-contain"
                  priority
                />
              </div>

              {/* Close button */}
              <button
                onClick={() => setHoveredIndex(null)}
                className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-background border-2 border-border hover:border-primary flex items-center justify-center transition-colors shadow-lg"
                aria-label="Close expanded view"
              >
                <X className="h-5 w-5 text-foreground" />
              </button>

              {/* Image caption */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="absolute -bottom-16 left-0 right-0 text-center"
              >
                <p className="text-white text-lg font-medium drop-shadow-lg">{images[hoveredIndex]!.alt}</p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
DraggableGallery.displayName = "DraggableGallery"
export default DraggableGallery