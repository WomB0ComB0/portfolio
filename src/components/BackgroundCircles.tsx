'use client';

import { motion } from 'framer-motion';
import React from 'react';

export const BackgroundCircles: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{
        scale: [1, 2, 2, 3, 1],
        opacity: [0.1, 0.2, 0.4, 0.8, 0.1, 1.0],
        borderRadius: ['20%', '20%', '50%', '50%', '20%'],
      }}
      transition={{ duration: 2.5 }}
      className="relative flex items-center justify-center"
    >
      <div className="absolute mt-52 size-[200px] animate-pulse rounded-full border border-[#333333]" />
      <div className="absolute mt-52 size-[300px] animate-pulse rounded-full border border-[#333333]" />
      <div className="absolute mt-52 size-[500px] animate-pulse rounded-full border border-[#333333]" />
      <div className="absolute mt-52 size-[650px] animate-pulse rounded-full border border-[#560BAD] opacity-20" />
      <div className="absolute mt-52 size-[800px] animate-pulse rounded-full border border-[#333333]" />
    </motion.div>
  );
};
