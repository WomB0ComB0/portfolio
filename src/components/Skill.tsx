'use client';

import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

import { Skills } from '../constants/index';

export const Skill: React.FC = () => {
  return (
    <>
      {Skills.map((skill) => (
        <div key={skill.name} className="group relative inline-block cursor-pointer transition-all">
          {skill.certificate ? (
            <Link href={skill.certificate} target="_blank" rel={`noopener noreferrer`}>
              <Image
                className={`h-[50px] border border-gray-500 object-contain transition duration-300 ease-in-out ${skill.certificate ? `hover:bg-[#BA9BDD]` : ``}  w-[50px] rounded-md grayscale-0 group-hover:grayscale sm:size-20 md:size-28 xl:size-[100px]`}
                src={skill.image}
                alt={`${skill.name} skill badge`}
                width={200}
                height={200}
              />
            </Link>
          ) : (
            <Image
              className={`size-[50px] rounded-md border border-gray-500 object-contain grayscale-0 transition duration-300 ease-in-out group-hover:grayscale sm:size-20 md:size-28 xl:size-[100px]`}
              src={skill.image}
              alt={`${skill.name} skill badge`}
              width={200}
              height={200}
            />
          )}
        </div>
      ))}
    </>
  );
};
