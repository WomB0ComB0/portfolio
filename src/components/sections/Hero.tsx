'use client';

import { MapIcon, PhoneIcon, MapPinIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import { Cursor, useTypewriter } from 'react-simple-typewriter';

import { Buttons, github, linkedin, resume, styles } from '../../constants/index';
import { BackgroundCircles } from '../BackgroundCircles';
import { GoogleDriveIcon, LinkedInIcon, MailIcon } from '../fontawesome/index';
import { GithubIcon } from '../simpleicons/index';

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
  const element = document.getElementById(id.replace('#', '') || '');
  element?.scrollIntoView({ behavior: 'smooth' });
};

export const Hero = () => {
  const [text] = useTypewriter({
    words: ['Developer', 'Designer', 'Creator'],
    loop: true,
    deleteSpeed: 50,
    delaySpeed: 2000,
  });
  return (
    <div className="flex h-screen select-none flex-col items-center justify-center space-y-8 overflow-hidden text-center">
      <BackgroundCircles />
      <Image
        className="imageBorder relative mx-auto size-32 rounded-full object-cover "
        src="/assets/images/Profile.png"
        width={100}
        height={100}
        alt="profile picture"
      />
      <div className="z-20">
        <h2 className="pb-2 text-[16px] uppercase tracking-[15px] text-gray-500 contrast-100">Software Engineer</h2>
        <h1 className="px-10 text-3xl font-semibold sm:text-4xl md:text-5xl lg:text-6xl">
          <span className="mr-3">Mike Odnis: {text}</span>
          <Cursor cursorBlinking cursorColor="#7d16bf" />
        </h1>
        <div className="heroButtons mb-5 flex justify-center gap-2 pt-5">
          {Buttons.map((button) => (
            <button
              key={button.name}
              className="rounded-full border border-[#BA9BDD] px-6 py-2 text-sm uppercase tracking-widest text-[#BA9BDD] transition-all hover:border-[#BA9BDD]/40 hover:text-[#BA9BDD]/40"
              onClick={() => scrollToElement(button.name.toLowerCase())}
            >
              {button.name}
            </button>
          ))}
        </div>
        <div className="relative mx-auto flex flex-col items-center justify-center gap-3">
          <motion.div
            initial={{ x: -500, opacity: 0, scale: 0.5 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 1.5 }}
            className="mx-auto items-center text-gray-300 "
          >
            <div className="flex justify-center gap-5">
              <>
                <Link href={github} aria-label="Github" target="_blank" className="hero-icon ml-auto">
                  <GithubIcon />
                  <p className="hidden text-sm uppercase text-gray-400 md:inline-flex">Github</p>
                </Link>
                <Link href={linkedin} aria-label="Linkedin" target="_blank" className="hero-icon mr-auto sm:mr-2">
                  <LinkedInIcon />
                  <p className="hidden text-sm uppercase text-gray-400 md:inline-flex">LinkedIn</p>
                </Link>
                <Link
                  href={`#contact`}
                  rel="noopener noreferrer"
                  aria-label="Mail icon"
                  className="hero-icon sm:ml-2"
                  onClick={() => scrollToElement('contact')}
                >
                  <MailIcon className="cursor-pointer " href="#contact" />
                  <p className="hidden text-sm uppercase text-gray-400 md:inline-flex">Get in touch</p>
                </Link>
              </>
              <div>
                <Link href={resume} rel="noopener noreferrer" target={`_blank`} className={`hero-icon`}>
                  <GoogleDriveIcon />
                  <p className="hidden text-sm uppercase text-gray-400 md:inline-flex">Resume</p>
                </Link>
              </div>
            </div>
          </motion.div>
          <motion.div>
            <div className="flex space-x-5">
              {contactDetails.map((contact) => (
                <div key={contact.type} className="flex items-center justify-start space-x-5">
                  {contact.icon}
                  <a
                    href={contact.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden text-sm uppercase text-gray-400 md:inline-flex"
                  >
                    {contact.text}
                  </a>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
