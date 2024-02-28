'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import React, { useState } from 'react';

import { highlightWords, paragraphContent } from '@/constants';

export const About = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const handleMouseMove = (e: any) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  };
  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
  };
  const highlightText = (text: string, words: string[]) => {
    const regex = new RegExp(`\\b(${words.join('|')})\\b`, 'gi');
    return text.replace(regex, (match) => `<span style="color: #BA9BDD;font-weight: bold;">${match}</span>`);
  };
  const highlightedContent = highlightText(paragraphContent, highlightWords);
  const { x, y } = mousePosition;
  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      whileInView={{
        opacity: 1,
      }}
      transition={{
        duration: 1.5,
      }}
      className="relative mx-auto flex h-screen max-w-7xl flex-col items-center justify-evenly px-10 text-center md:flex-row md:text-left"
    >
      <h3 className="absolute top-24 hidden select-none text-2xl uppercase tracking-[20px] text-gray-500">About</h3>
      <div
        onMouseMove={handleMouseMove}
        onMouseOut={handleMouseLeave}
        className={`ThreeD md-h-95 ThreeD size-56 shrink-0 rounded-full md:mb-0 md:w-64 md:rounded-lg xl:h-[600px] xl:w-[500px]`}
        style={{
          transform: `
              scale3d(1.07, 1.07, 1.07)
              rotate3d(${(y - window.innerHeight / 2) / 100},
              ${-(x - window.innerWidth / 2) / 100}, 
              0, 
              ${Math.log(Math.sqrt((y - (window.innerHeight % 2)) ** 2 + (x - window.innerWidth / 2) ** 2)) * 2}deg)`,
        }}
      >
        <Image
          className="md-h-95 size-56 shrink-0 rounded-full object-cover md:mb-0 md:w-64 md:rounded-lg xl:h-[600px] xl:w-[500px]"
          src="/assets/images/AboutMe.png"
          alt="profile picture"
          layout="contain"
          width={1080}
          height={1080}
        />
      </div>
      <div className="space-y-10 px-0 md:px-10">
        <h4 className="text-4xl font-semibold">
          Here is a <span className="underline decoration-[#560BAD]/50">little </span> background
        </h4>
        <p className="text-base leading-6" dangerouslySetInnerHTML={{ __html: highlightedContent }} />
      </div>
    </motion.div>
  );
};
