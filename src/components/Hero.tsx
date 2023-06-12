"use client"
import React from 'react'
import { Cursor, useTypewriter } from 'react-simple-typewriter'
import BackgroundCircles from './BackgroundCircles'
import Link from 'next/link'
import Image from 'next/image'
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
    <div className='flex flex-col items-center justify-center h-screen space-y-8 overflow-hidden text-center'>
      <BackgroundCircles />
      <img className='relative object-cover w-32 h-32 mx-auto rounded-full' src="https://www.github.com/WomB0ComB0.png?size=600" alt="profile picture"/>
      <div className='z-20'>
        <h2 className='pb-2 text-sm tracking-[15px] text-gray-500 uppercase'>
          Software Engineer
        </h2>
        <h1 className='px-10 text-5xl lg:text-6xl front-semibold'>
          <span className='mr-3'>Mike Odnis: {text}</span>
          <Cursor cursorBlinking cursorColor='#7d16bf'/>
        </h1>
        <div className='pt-5'>
          <button className="px-6 py-2 border border-[#242424] rounded-full uppercase text-sm tracking-widest text-gray-500 transition-all hover:border-[#F7AB0A]/40 hover:text-[#F7AB0A]/40" onClick={() => scrollToElement('about')}>About</button>
          <button className="px-6 py-2 border border-[#242424] rounded-full uppercase text-sm tracking-widest text-gray-500 transition-all hover:border-[#F7AB0A]/40 hover:text-[#F7AB0A]/40" onClick={() => scrollToElement('experience')}>Experience</button>
          <button className="px-6 py-2 border border-[#242424] rounded-full uppercase text-sm tracking-widest text-gray-500 transition-all hover:border-[#F7AB0A]/40 hover:text-[#F7AB0A]/40" onClick={() => scrollToElement('skills')}>Skills</button>
          <button className="px-6 py-2 border border-[#242424] rounded-full uppercase text-sm tracking-widest text-gray-500 transition-all hover:border-[#F7AB0A]/40 hover:text-[#F7AB0A]/40" onClick={() => scrollToElement('projects')}>Projects</button>
        </div>
      </div>
    </div>
  )
}