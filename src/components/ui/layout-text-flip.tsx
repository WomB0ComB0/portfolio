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
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

export const LayoutTextFlip = ({
  text = 'Build Amazing',
  words = ['Landing Pages', 'Component Blocks', 'Page Sections', '3D Shaders'],
  duration = 3000,
  className,
}: {
  text: string;
  words: string[];
  duration?: number;
  className?: string;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % words.length);
    }, duration);

    return () => clearInterval(interval);
  }, [words, duration]);

  return (
    <div className={cn('flex items-center gap-x-2', className)}>
      <motion.span
        layoutId="subtext"
        className="text-2xl font-bold tracking-tight drop-shadow-lg md:text-4xl"
      >
        {text}
      </motion.span>

      {/* === MODIFICATION IS ON THIS ELEMENT'S CLASSNAME === */}
      <motion.div
        layout
        className="relative w-fit overflow-hidden rounded-md border border-white/10  backdrop-blur-sm px-4 py-2 font-sans text-2xl font-bold tracking-tight text-black shadow-sm ring shadow-black/10 ring-black/10 drop-shadow-lg md:text-4xl dark:bg-neutral-900/50 dark:text-white dark:shadow-sm dark:ring-1 dark:shadow-white/10 dark:ring-white/10"
      >
        <AnimatePresence mode="popLayout">
          <motion.span
            key={currentIndex}
            initial={{ y: -40, filter: 'blur(10px)' }}
            animate={{
              y: 0,
              filter: 'blur(0px)',
            }}
            exit={{ y: 50, filter: 'blur(10px)', opacity: 0 }}
            transition={{
              duration: 0.5,
            }}
            className={cn('inline-block whitespace-nowrap')}
          >
            {words[currentIndex]}
          </motion.span>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
