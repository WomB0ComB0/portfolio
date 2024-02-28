'use client';

import { motion } from 'framer-motion';
import React from 'react';

import { WorkExperience as WorkExperiences } from '@/constants/index';

import { ExperienceCard } from '../ExperienceCard';

export const WorkExperience = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 1.5 }}
      className="relative flex flex-col items-center h-screen max-w-full px-10 mx-auto overflow-hidden text-left justify-evenly md:flex-row"
    >
      <h3 className="absolute top-24 hidden select-none text-2xl uppercase tracking-[20px] text-gray-500">
        Experience
      </h3>
      <div className="scrollbar scrollbar-track-gray-400/20 scrollbar-thumb-[#560BAD]/80 flex w-full snap-x snap-mandatory space-x-5 overflow-x-scroll p-10">
        {WorkExperiences.map((experience) => (
          <ExperienceCard
            key={experience.company}
            logo={experience.logo}
            company={experience.company}
            title={experience.title}
            type={experience.type}
            location={experience.location}
            startDate={experience.startDate}
            endDate={experience.endDate}
            description={experience.description}
          />
        ))}
      </div>
    </motion.div>
  );
};
