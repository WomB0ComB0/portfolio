'use client';
import { motion } from 'motion/react';
import type React from 'react';
export const EnterAnimation: React.FC<
  Readonly<{
    children: React.ReactNode;
  }>
> = ({ children }) => {
  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ ease: 'easeInOut', duration: 0.25 }}
    >
      {children}
    </motion.div>
  );
};
