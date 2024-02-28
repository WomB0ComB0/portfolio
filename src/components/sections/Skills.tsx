'use client';

import React from 'react';

import { Skill } from '../Skill';

export const Skills = () => {
  return (
    <div className="relative mx-auto flex min-h-screen max-w-[2000px] select-none flex-col items-center justify-center text-center md:text-left xl:flex-row xl:space-y-0 xl:px-10">
      <h3 className="absolute top-24 hidden select-none text-2xl uppercase tracking-[20px] text-gray-500">Skills</h3>
      <div className="grid grid-cols-8 gap-5">
        <Skill />
      </div>
    </div>
  );
};
