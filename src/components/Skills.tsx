"use client"
import React from 'react'
import { motion } from 'framer-motion'
import Skill from './Skill'
type Props = {}

export default function Skills({}: Props) {
  return (
    <div 
    className='relative flex flex-col text-center md:text-left xl:flex-row max-w-[2000px] xl:px-10 min-h-screen justify-center xl:space-y-0 mx-auto items-center'>
      <h3 className='absolute uppercase top-24 tracking-[20px] text-gray-500 text-2xl select-none'>
        Skills
      </h3>
      <div className='grid grid-cols-6 gap-5 '>
        <Skill />
      </div>
    </div>
  )
}