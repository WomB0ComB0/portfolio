"use client"
import React from 'react'
import { motion } from 'framer-motion'
import { SocialIcon } from 'react-social-icons'
import { scrollToElement } from './Hero'
type Props = {}
export default function Header({}: Props) {
  return (
    <header className='sticky top-0 z-20 flex justify-between p-5 mx-auto bg-black/40 item-start max-w-7x1 xl:items-center'>
      <motion.div initial={{x: -500, opacity: 0, scale: 0.5}} animate={{x:0, opacity: 1, scale:1}} transition={{duration: 1.5,}} className='flex flex-row items-center'>
        <SocialIcon url='https://www.github.com/WomB0ComB0' fgColor='gray' bgColor='Transparent'></SocialIcon>
        <SocialIcon url='https://www.linkedin.com/in/mike-odnis-23a303228/' fgColor='gray' bgColor='Transparent'></SocialIcon>
      </motion.div>
      <motion.div initial={{x: 500, opacity:0, scale: 0.5}} animate={{x:0,opacity:1, scale:1}} transition={{ duration: 1.5 }} className='items-center text-gray-300 bg-flex-row ' onClick={() => scrollToElement('contact')}>  
        <SocialIcon className='cursor-pointer ' network='email' fgColor='gray' bgColor='Transparent'></SocialIcon>
        <p className='hidden text-sm text-gray-400 uppercase md:inline-flex'>
        Get in touch  
        </p>
      </motion.div>
    </header>
  )
}