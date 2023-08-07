"use client"
import React from 'react'
import { Cursor, useTypewriter } from 'react-simple-typewriter'
import BackgroundCircles from './BackgroundCircles'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Buttons } from '../constants/index'
import { GoogleDriveIcon, MailIcon
,LinkedInIcon } from './fontawesome/index'
import { GithubIcon } from './simpleicons/index'
import { PhoneIcon, MapPinIcon } from '@heroicons/react/24/solid'
type Props = {}
type ContactDetail = {
  type: string;
  icon: JSX.Element;
  text: string;
  link?: string;
};
const styles = 'text-[#560BAD] h-7 w-7 animate-pulse'
export const contactDetails: ContactDetail[] = [
  {
    type: 'phone',
    icon: <PhoneIcon height={24} width={24} className={`${styles}`} />,
    text: '+1 (934)-218-7852',
    link: 'tel:+1-934-218-7852',
  },
  {
    type: 'location',
    icon: <MapPinIcon height={24} width={24} className={`${styles}`} />,
    text: 'Brentwood, NY',
    link: 'https://www.google.com/maps/place/Brentwood,+NY/@40.7809543,-73.3350217,12z/data=!4m6!3m5!1s0x89e8319349a7a5e1:0xfc8ed3b854bd231a!8m2!3d40.7812093!4d-73.2462273!16zL20vMHk4MzM?entry=ttu',
  },
];
export const scrollToElement = (id: string) => {
  const element = document.getElementById(id.replace('#', '') || '')
  element?.scrollIntoView({behavior: 'smooth'})
}
const resume = "https://docs.google.com/document/d/1TdPnmXtZCdSuI3p8_mtmR_o1VDhAKkXFlMVycL8cjpY/edit?usp=sharing" 
const github = "https://www.github.com/WomB0ComB0" 
const linkedin = "https://www.linkedin.com/in/mikeodnis/"
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
        <h2 className='pb-2 text-[16px] tracking-[15px] text-gray-500 uppercase filter contrast-100'>
          Software Engineer
        </h2>
        <h1 className='px-10 text-3xl font-semibold md:text-5xl lg:text-6xl sm:text-4xl'>
          <span className='mr-3'>Mike Odnis: {text}</span>
          <Cursor cursorBlinking cursorColor='#7d16bf'/>
        </h1>
        <div className='flex justify-center gap-2 pt-5 mb-5 heroButtons'>
          {Buttons.map((button) => (
            <button key={button.name} className="px-6 py-2 border border-[#BA9BDD] rounded-full uppercase text-sm tracking-widest text-[#BA9BDD] transition-all hover:border-[#BA9BDD]/40 hover:text-[#BA9BDD]/40" onClick={() => scrollToElement(button.name.toLowerCase())}>{button.name}</button>
          ))}
        </div>
      <div className='relative flex flex-col items-center justify-center gap-3 ml-auto mr-auto'>
      <motion.div
      initial={{x: -500, opacity:0, scale: 0.5}} animate={{x:0,opacity:1, scale:1}} transition={{ duration: 1.5 }} className='items-center ml-auto mr-auto text-gray-300 '
      >
        <div className='flex justify-center gap-5'>
          <>
          <Link href={github} aria-label='Github' target='_blank' className='ml-auto hero-icon'>
            <GithubIcon/>
              <p className='hidden text-sm text-gray-400 uppercase md:inline-flex'>
                Github  
              </p>
          </Link>
          <Link href={linkedin} aria-label="Linkedin" target='_blank' className='mr-auto sm:mr-2 hero-icon'>
            <LinkedInIcon/>
              <p className='hidden text-sm text-gray-400 uppercase md:inline-flex'>
                LinkedIn  
              </p>
            </Link>
            <Link href={`#contact`} rel='noopener noreferrer' aria-label="Mail icon" className='hero-icon sm:ml-2' onClick={() => scrollToElement('contact')}>
              <MailIcon className='cursor-pointer 'href='#contact'/>
              <p className='hidden text-sm text-gray-400 uppercase md:inline-flex'>
                Get in touch  
              </p>
            </Link>
          </>
          <div>
            <Link href={resume} rel='noopener noreferrer' target={`_blank`} className={`hero-icon`}>
              <GoogleDriveIcon/>
              <p className='hidden text-sm text-gray-400 uppercase md:inline-flex'>
                Resume  
              </p>
            </Link>
          </div>
        </div>
      </motion.div>
      <motion.div>
        <div className='flex space-x-5'> 
          {contactDetails.map((contact) => (
            <div key={contact.type} className="flex items-center justify-start space-x-5">
              {contact.icon}
              <a href={contact.link} target="_blank" rel="noopener noreferrer" className="hidden text-sm text-gray-400 uppercase md:inline-flex">
                {contact.text}
              </a>
            </div>
          ))}
        </div>
      </motion.div>
      </div>
      </div>
    </div>
  )
}