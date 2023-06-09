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
      <h3 className='absolute uppercase top-0 tracking-[20px] text-gray-500 text-2xl'>About</h3>
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
      className='flex-shrink-0 object-cover w-56 h-56 mb-20 rounded-full md:mb-0 md:rounded-lg md:w-64 md-h-95 xl:w-[500px] xh:h-[600px]' src=
      "https://i.imgur.com/hN2C1XT.jpg" alt="profile picture"
      />
      <div className='px-0 space-y-10 md:px-10'>
        <h4 className="text-4xl font-semibold">
          Here is a{" "}<span className='underline decoration-[#f7ab0a]/50'>little </span> background
        </h4>
        <p className='text-base'>
          Lorem ipsum dolor sit amet consectetur, adipisicing elit. Cupiditate vitae nemo fugit? Neque libero voluptatem, ratione vel modi ab adipisci laudantium saepe, quidem recusandae quaerat, ipsa possimus tempore obcaecati laborum labore provident accusamus beatae? Excepturi, et tempore veniam ratione repellendus aliquam odit minus repellat! Provident quis consequatur enim explicabo fugit et, velit reiciendis rem iste, cupiditate natus cum ipsa omnis laborum ad eligendi nihil. Consequatur, illo tenetur labore quidem ducimus blanditiis ex quia quos iste adipisci ab sed inventore iure odio. Pariatur mollitia accusamus facilis exercitationem sint fugiat eligendi necessitatibus, totam hic fugit corrupti repudiandae possimus praesentium vero qui ullam labore debitis ab dolores. Atque, modi quae autem quo eos ad totam quidem distinctio temporibus velit doloribus rerum cumque corporis?
        </p>
      </div>
    </motion.div>
  )
}