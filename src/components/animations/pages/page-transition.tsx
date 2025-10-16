'use client';

import { AnimatePresence, motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

type PageTransitionProps = {
  children: ReactNode;
};

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
        initial="hidden"
        animate="enter"
        exit="exit"
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        className="min-h-screen"
      >
        {children}
      </motion.main>
    </AnimatePresence>
  );
};
