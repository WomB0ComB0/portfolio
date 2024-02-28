/* eslint-disable react/jsx-key */

'use client';

import React from 'react';

import { Projects as PersonalProjects } from '@/constants/index';

import { ProjectCard } from '../ProjectCard';

export const Projects = () => {
  return (
    <div className="relative z-0 mx-auto flex h-screen max-w-full flex-col items-center justify-evenly overflow-hidden text-left transition-all md:flex-row">
      <h3 className="absolute top-24 hidden select-none text-2xl uppercase tracking-[20px] text-gray-500">Projects</h3>
      <div className="scrollbar-thin scrollbar-track-gray-400/20 scrollbar-thumb-[#f7ab0a]/80 customScroll relative z-20 flex w-full snap-x snap-mandatory space-x-[45px] overflow-scroll [&>*:first-child]:ml-[45px] [&>*:last-child]:mr-[45px]">
        {PersonalProjects.map((project) => (
          <ProjectCard
            key={project.name}
            name={project.name}
            description={project.description}
            techStack={project.tech}
            link={project.link}
            image={project.image}
            imageAlt={project.imageAlt}
            github={project.github}
            devpost={project.devpost}
            figma={project.figma}
          />
        ))}
      </div>
      <div className="absolute left-0 top-[30%] h-[500px] w-full -skew-y-12 bg-[#560BAD]/10" />
    </div>
  );
};
