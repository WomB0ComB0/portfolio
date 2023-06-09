"use client"
import React from 'react'
import { motion } from 'framer-motion'
type Props = {}

export default function ExperienceCard({}: Props) {
  return (
    <article className='flex flex-col items-center flex-shrink-0 rounded-lg space-y-7 w-[500px] md:w-[600px] xl:w-[900px] snap-center bg-[#292929] p-10 hover:opacity-100 opacity-40 cursor-pointer transition-opacity duration-200 overflow-hidden'>
      <motion.img 
      initial={{
        y: -100,
        opacity: 0
      }}
      whileInView={{
        opacity: 1,
        y: 0
      }}
      transition={{
        duration: 1.2
      }}
      viewport={{
        once: true
      }}
      className='w-32 h-32 rounded-full  xl:w-[200px] xl:h-[200px] object-cover object-center' src="https://media.licdn.com/dms/image/C4E0BAQGRbWOnYJRhng/company-logo_200_200/0/1662659299117?e=1694044800&v=beta&t=MDMoureXliu6yRYBDnLXJS7VOV-wVeofLJenBykUHfM" alt="" />
      <div className='px-0 md:px-10'>
        <h4 className='text-4xl font-light'>Webmaster</h4>
        <p className='mt-1 text-2xl font-bold'>District 1 Youth Advisory Board</p>
        <div className='flex my-2 space-x-2'>
          <img className="w-10 h-10 rounded-full"src="" alt="" />
          <img className="w-10 h-10 rounded-full"src="" alt="" />
          <img className="w-10 h-10 rounded-full"src="" alt="" />
        </div>
        <p className='py-5 text-gray-300 uppercase'>
          <span>September 2020 - Present</span>
        </p>
        <ul className='ml-5 space-y-4 text-lg list-disc'>
          <li>Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat, optio?</li>
          <li>Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat, optio?</li>
          <li>Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat, optio?</li>
          <li>Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat, optio?</li>
          <li>Lorem ipsum dolor sit amet consectetur adipisicing elit. Repellat, optio?</li>
        </ul>
      </div>
    </article>
  )
}