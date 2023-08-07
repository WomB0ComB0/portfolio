"use client"
import React, {useState} from 'react'
import { motion } from 'framer-motion'
import { highlightWords, paragraphContent } from '@/constants'
import Image from 'next/image'
type Props = {}
export default function About({}: Props) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const handleMouseMove = (e: any) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  };
  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
  };
  const highlightText = (text: string, words: string[]) => {
    const regex = new RegExp(`\\b(${words.join('|')})\\b`, 'gi');
    return text.replace(regex, (match) => `<span style="color: #BA9BDD;font-weight: bold;">${match}</span>`);
  };
  const highlightedContent = highlightText(paragraphContent, highlightWords);
  const { x, y } = mousePosition;
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
      <h3 className='absolute uppercase top-24 tracking-[20px] text-gray-500 text-2xl select-none hidden'>About</h3>
      <div
        onMouseMove={handleMouseMove}
        onMouseOut={handleMouseLeave}
        className={`ThreeD w-56 h-56 rounded-full md:mb-0 md:rounded-lg md:w-64 md-h-95 xl:w-[500px] xl:h-[600px] flex-shrink-0 ThreeD`} // Add the styles.ThreeD class here
        style={{
          transform: `
              scale3d(1.07, 1.07, 1.07)
              rotate3d(${(y - window.innerHeight / 2) / 100},
              ${-(x - window.innerWidth / 2) / 100}, 
              0, 
              ${Math.log(
                Math.sqrt(Math.pow(y - window.innerHeight % 2, 2) + Math.pow(x - window.innerWidth / 2, 2))
              ) * 2}deg)`,
        }}
      >
        <Image
          className='flex-shrink-0 object-cover w-56 h-56 rounded-full md:mb-0 md:rounded-lg md:w-64 md-h-95 xl:w-[500px] xl:h-[600px]' 
          src="/AboutMe.png" 
          alt="profile picture"
          layout="contain"
          width={1080}
          height={1080}
        />
      </div>
      <div className='px-0 space-y-10 md:px-10'>
        <h4 className="text-4xl font-semibold">
          Here is a{" "}<span className='underline decoration-[#560BAD]/50'>little </span> background
        </h4>
        <p className="text-base leading-6" dangerouslySetInnerHTML={{ __html: highlightedContent }} />
      </div>
    </motion.div>
  )
}