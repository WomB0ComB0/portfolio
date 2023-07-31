"use client"
import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { SocialIcon } from 'react-social-icons'
import { scrollToElement } from './Hero'
type Props = {}
export default function Header({}: Props) {
  return (
    <header className='relative top-0 flex justify-between p-5 mx-auto bg-[#242424]/80 z-20 item-start max-w-7x1 xl:items-center'>
      <motion.div initial={{x: 500, opacity:0, scale: 0.5}} animate={{x:0,opacity:1, scale:1}} transition={{ duration: 1.5 }} className='items-center ml-auto mr-auto text-gray-300 bg-flex-row'>
        <Link href={`https://www.github.com/WomB0ComB0`} aria-label='Github' target='_blank'>
          <SocialIcon target='_blank' url='https://www.github.com/WomB0ComB0' fgColor='#BA9BDD' bgColor='Transparent'/>
        </Link>
        <Link href={`https://www.github.com/WomB0ComB0`} aria-label="Linkedin" target='_blank'>
          <SocialIcon target='_blank' url='https://www.linkedin.com/in/mikeodnis/' fgColor='#BA9BDD' bgColor='Transparent'/>
        </Link>
      </motion.div>
      <motion.div
        initial={{x: -500, opacity:0, scale: 0.5}} animate={{x:0,opacity:1, scale:1}} transition={{ duration: 1.5 }} className='items-center ml-auto mr-auto text-gray-300 bg-flex-row'
      >
        <div className='flex justify-center'>
          <div onClick={() => scrollToElement('contact')}>
            <SocialIcon className='cursor-pointer ' network='email' fgColor='#BA9BDD' bgColor='Transparent'/>
            <p className='hidden text-sm text-gray-400 uppercase md:inline-flex'>
              Get in touch  
            </p>
          </div>
          <div>
            <SocialIcon className='cursor-pointer ' network='' fgColor='#BA9BDD' bgColor='Transparent' target={`_blank`} url='https://docs.google.com/document/d/1TdPnmXtZCdSuI3p8_mtmR_o1VDhAKkXFlMVycL8cjpY/edit?usp=sharing'/>
            <p className='hidden text-sm text-gray-400 uppercase md:inline-flex'>
              Resume  
            </p>
          </div>
        </div>
      </motion.div>
    </header>
  )
}