"use client"
import React from 'react'
import { Cursor, useTypewriter } from 'react-simple-typewriter'
import BackgroundCircles from './BackgroundCircles'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { SocialIcon } from 'react-social-icons'
import { Buttons } from '../constants/index'
type Props = {}
export const scrollToElement = (id: string) => {
  const element = document.getElementById(id)
  element?.scrollIntoView({behavior: 'smooth'})
}
export default function Hero({}: Props) {
  const [text, count] = useTypewriter({
    words: [ "Developer", "Designer", "Creator" ], 
    loop: true,
    deleteSpeed: 50,
    delaySpeed: 2000,
  })
  return (
    <div className='flex flex-col items-center justify-center h-screen space-y-8 overflow-hidden text-center select-none'>
      <BackgroundCircles />
        <Image className='relative object-cover w-32 h-32 mx-auto rounded-full imageBorder ' src="/Profile.png" width={100} height={100} alt="profile picture"/>
      <div className='z-20'>
        <h2 className='pb-2 text-sm tracking-[15px] text-gray-500 uppercase'>
          Software Engineer
        </h2>
        <h1 className='px-10 text-5xl lg:text-6xl front-semibold'>
          <span className='mr-3'>Mike Odnis: {text}</span>
          <Cursor cursorBlinking cursorColor='#7d16bf'/>
        </h1>
        <div className='flex justify-center gap-2 pt-5 '>
          {Buttons.map((button) => (
            <button key={button.name} className="px-6 py-2 border border-[#BA9BDD] rounded-full uppercase text-sm tracking-widest text-[#BA9BDD] transition-all hover:border-[#BA9BDD]/40 hover:text-[#BA9BDD]/40" onClick={() => scrollToElement(button.name.toLowerCase())}>{button.name}</button>
          ))}
        </div>
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
      </div>
    </div>
  )
}