'use client';

import type { PageTransitionProps } from './page-transition.types';

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
import { usePathname } from 'next/navigation';

const variants = {
  hidden: { opacity: 0, y: 20 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main
        key={pathname}
        variants={variants}
        initial={false}
        animate="enter"
        exit="exit"
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="min-h-screen"
      >
        {children}
      </motion.main>
    </AnimatePresence>
  );
};
PageTransition.displayName = 'PageTransition';
export default PageTransition;
