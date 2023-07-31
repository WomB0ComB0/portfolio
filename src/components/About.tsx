"use client"
import React from 'react'
import { motion } from 'framer-motion'
type Props = {}
export default function About({}: Props) {
  return (
    <motion.div 
    initial={{
      opacity: 0
    }}
    whileInView={{
      opacity: 1
    }}
    transition={{
      duration: 1.5
    }}
    className="relative flex flex-col items-center h-screen px-10 mx-auto text-center md:text-left md:flex-row max-w-7xl justify-evenly">
      <h3 className='absolute uppercase top-24 tracking-[20px] text-gray-500 text-2xl select-none'>About</h3>
      <motion.img 
      initial={{
        x: -200,
        opacity: 0
      }}
      transition={{
        duration:2.5
      }}
      whileInView={{
        x: 0,
        opacity: 1
      }}
      viewport={{
        once: true
      }}
      className='flex-shrink-0 object-cover w-56 h-56 rounded-full md:mb-0 md:rounded-lg md:w-64 md-h-95 xl:w-[500px] xl:h-[600px]' src=
      "https://i.imgur.com/hN2C1XT.jpg" alt="profile picture"
      />
      <div className='px-0 space-y-10 md:px-10'>
        <h4 className="text-4xl font-semibold">
          Here is a{" "}<span className='underline decoration-[#560BAD]/50'>little </span> background
        </h4>
        <p className='text-base leading-6'>
          Mike Odnis is an ambitious and driven undergraduate Computer Science student at 
          <strong>{' '}Farmingdale State College</strong>, specializing in web development and programming. With a solid foundation in HTML, CSS, and SCSS, I craft beautiful and user-friendly websites. His proficiency in 
          <strong>
          JavaScript  
          </strong>
          , including 
          <strong>
          TypeScript  
          </strong>
           and various frameworks like 
          <strong>
          {' React '}
          </strong>
           and 
          <strong>
          {` Redux `}
          </strong>
          , 
          <strong>
          {` NextJS `}
          </strong>
          , 
          <strong>
          {` jQuery `}
          </strong>
          , and 
          <strong>
          {` ViteJS `}  
          </strong>
          , enables him to create dynamic web applications. Mike&apos;s expertise also extends to modern web tools like 
          <strong>
          {` Tailwind CSS `}
          </strong>
           and handling 
          <strong>
          {` APIs `}  
          </strong>
           using 
          <strong>
          {` Axios `}
          </strong>
          . Additionally, his knowledge of 
          <strong>
          {` Python `}
          </strong>
          , 
          <strong>
          {` C++ `}
          </strong>
          , 
          <strong>
          {` C# `}
          </strong>
          , and 
          <strong>
          {` Java `}  
          </strong>
          equips him for diverse software development projects. As a quick learner, I embraces new technologies with enthusiasm and is always eager to expand his skill-set. My passion for coding and problem-solving drives him to deliver exceptional results, and as a 
          <strong>
          {` first-generation `}  
          </strong>
           student, I take pride in his achievements and aims to be a well-rounded addition to any team.
        </p>
      </div>
    </motion.div>
  )
}