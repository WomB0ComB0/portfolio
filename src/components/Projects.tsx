/* eslint-disable react/jsx-key */
"use client"
import React, {useState} from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Projects as PersonalProjects } from '@/constants/index'
import { Badge } from './ui/badge'
import { GlobeAltIcon } from './heroicons/GlobeAltIcon'
import { DevpostIcon, GithubIcon,
FigmaIcon } from './simpleicons/index'
type Props = {
  name: string;
  description: string[];
  techStack: string[];
  link?: string | any;
  image?: string | any; 
  imageAlt: string;
  github?: string;
  devpost?: string;
  figma?: string;
}
export default function Projects() {
  return (
    <div className='relative z-0 flex flex-col items-center h-screen max-w-full mx-auto overflow-hidden text-left transition-all md:flex-row justify-evenly'>
      <h3 className='absolute uppercase top-24 tracking-[20px] text-gray-500 text-2xl select-none'>Projects</h3>
      <div className='relative z-20 flex w-full overflow-x-scroll overflow-y-scroll snap-x snap-mandatory scrollbar-thin scrollbar-track-gray-400/20 scrollbar-thumb-[#f7ab0a]/80 space-x-[45px] [&>*:first-child]:ml-[45px] [&>*:last-child]:mr-[45px] customScroll'>
        {PersonalProjects.map((project) => (
          <ProjectCard key={project.name} name={project.name} description={project.description} techStack={project.tech} link={project.link} image={project.image} imageAlt={project.imageAlt} github={project.github} devpost={project.devpost} figma={project.figma}
          />
        ))}
      </div>
      <div className='w-full absolute top-[30%] bg-[#560BAD]/10 left-0 h-[500px] -skew-y-12'/>
    </div>
  );
}
export const ProjectCard = ({name, description, techStack, link, image, imageAlt, github, devpost, figma}: Props) => {
  return (
    <>
      <motion.div initial={{  opacity: 0}}whileInView={{   opacity: 1}}transition={{   duration: 1.5 }}
          className='flex flex-col items-center justify-around flex-shrink-0 w-[80%] h-full p-20 sm:p-5 space-y-5 snap-center md:p-4 bg-[#292929] hover:drop-shadow-lg rounded-lg max-w-[900px] min-w-[500px] max-h-[800px] min-h-[629px] hover:opacity-100 opacity-40 transition-opacity duration-200 overflow-hidden'>
            <div
              className='object-contain  h-1/2 max-w- max-h-[500px] flex justify-center items-center flex-row gap-5'  
            >
              <Image 
                src={image}
                alt={imageAlt} 
                width={512} 
                height={512} 
                className={`h-[200px] w-[200px] object-contain rounded-lg`}
              />
              <div className=''>
                <h4 className='text-4xl font-semibold text-center '>
                  <span 
                    className='underline decoration-[#560BAD]/50 '>
                    {name}
                  </span>
                </h4>
                <div className='flex items-center gap-2 mt-4 justify-flex-start transition-color'>
                  {[
                    { icon: github, href: github, IconComponent: GithubIcon },
                    { icon: link, href: link, IconComponent: GlobeAltIcon },
                    { icon: devpost, href: devpost, IconComponent: DevpostIcon },
                    { icon: figma, href: figma, IconComponent: FigmaIcon },
                  ].map((item) => (
                    item.icon && (
                      <>
                        <Link
                          key={item.href}
                          href={item.href}
                          target='_blank'
                          rel='noopener noreferrer'
                          className={`cursor-pointer`}
                        >
                          <item.IconComponent width={30}>
                            {item.href}
                          </item.IconComponent>
                        </Link>
                      </>
                    )
                  ))}
                </div>
              </div>
            </div>
            <div>
              <div className='flex flex-wrap justify-center w-full mb-[30px] space-x-2'>
                {techStack.map((technologies) => (
                  <Badge key={technologies} className='h-[35px] cursor-pointer hover:shadow-md border-2 bg-transparent hover:bg-transparent border-[#BA9BDD] text-[#BA9BDD] transition-all hover:border-[#BA9BDD]/40 hover:text-[#BA9BDD]/40 mb-[5px]'>
                    {technologies}
                  </Badge>
                ))}
              </div>
              <div className='w-full space-y-2 sm:w-[90%] mx-auto'>
                {description.map((paragraph) => (
                  <ul key={paragraph} className='text-lg text-left list-disc sm:text-md'>
                    <li className='hover:text-[#BA9BDD] cursor-pointer transition-colors'>
                      {paragraph} 
                    </li>
                  </ul>
                ))}
              </div>
            </div>
          </motion.div>
    </>
  )
}