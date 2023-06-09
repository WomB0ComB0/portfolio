/* eslint-disable react/jsx-key */
"use client"
import React from 'react'
import { motion } from 'framer-motion'
type Props = {}

function Projects({}: Props) {
  const projects = [1,2,3,4,5]
  return (
    <div className='relative z-0 flex flex-col items-center h-screen max-w-full mx-auto overflow-hidden text-left md:flex-row justify-evenly'>
      <h3 className='absolute uppercase top-24 tracking-[20px] text-gray-500 text-2xl'>Projects</h3>
      <div className='relative z-20 flex w-full overflow-x-scroll overflow-y-hidden snap-x snap-mandatory scrollbar-thin scrollbar-track-gray-400/20 scrollbar-thumb-[#f7ab0a]/80'>
        {projects.map((project, i) => (
          <motion.div 
          initial={{ opacity: 0}}
          whileInView={{ opacity: 1}}
          transition={{ duration: 1.5 }}
          className='flex flex-col items-center justify-center flex-shrink-0 w-screen h-screen p-20 space-y-5 snap-center md:p-4'>
            <motion.img 
            initial={{ y: -300, opacity: 0 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2 }}
            viewport={{once: true}}
            src="https://cdn.sanity.io/images/ltuexkre/production/af7ca99b5a796d0698cf9121a4a0795b5022b6be-666x375.png" alt="" />
          <div className='max-w-6xl px-0 space-y-10 md:px-10'>
            <h4 className='text-4xl font-semibold text-center'>
              <span className='underline decoration-[#f7ab0a]/50 '>
                Case Study {i + 1} of {projects.length}: example
              </span>
            </h4>
            <p className='text-lg text-center md:text-left'>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Eius laudantium nostrum, aliquam reprehenderit accusamus ducimus voluptates soluta veniam, quam, rerum velit explicabo commodi ratione labore. Architecto, natus. Praesentium consequatur assumenda doloribus obcaecati corporis saepe fugit.
            </p>
          </div>
          </motion.div>
        ))}
      </div>
      <div className='w-full absolute top-[30%] bg-[#f7ab0a]/10 left-0 h-[500px] -skew-y-12'/>
    </div>
  )
}

export default Projects