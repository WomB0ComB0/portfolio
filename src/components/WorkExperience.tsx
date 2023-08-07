"use client";
import React from 'react';
import { motion } from 'framer-motion';
import ExperienceCard from './ExperienceCard';
import { WorkExperience as WorkExperiences} from '@/constants/index'; 
export default function WorkExperience() {
  return (
    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 1.5 }}
    className='relative flex flex-col items-center h-screen max-w-full px-10 mx-auto overflow-hidden text-left md:flex-row justify-evenly'>
      <h3 className='absolute uppercase top-24 tracking-[20px] text-gray-500 text-2xl select-none hidden'>
        Experience
      </h3>
      <div className='flex w-full p-10 space-x-5 overflow-x-scroll snap-x snap-mandatory scrollbar scrollbar-track-gray-400/20 scrollbar-thumb-[#560BAD]/80'>
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
  )
}