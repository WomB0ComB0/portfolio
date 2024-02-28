'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import React from 'react';
import { SocialIcon } from 'react-social-icons';

import { scrollToElement } from './Hero';

export const Header = () => {
  return (
    <header className="item-start max-w-7x1 relative top-0 z-20 mx-auto flex justify-between bg-[#242424]/80 p-5 xl:items-center">
      <motion.div
        initial={{ x: 500, opacity: 0, scale: 0.5 }}
        animate={{ x: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 1.5 }}
        className="bg-flex-row mx-auto items-center text-gray-300"
      >
        <Link href={`https://www.github.com/WomB0ComB0`} aria-label="Github" target="_blank">
          <SocialIcon target="_blank" url="https://www.github.com/WomB0ComB0" fgColor="#BA9BDD" bgColor="Transparent" />
        </Link>
        <Link href={`https://www.github.com/WomB0ComB0`} aria-label="Linkedin" target="_blank">
          <SocialIcon
            target="_blank"
            url="https://www.linkedin.com/in/mikeodnis/"
            fgColor="#BA9BDD"
            bgColor="Transparent"
          />
        </Link>
      </motion.div>
      <motion.div
        initial={{ x: -500, opacity: 0, scale: 0.5 }}
        animate={{ x: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 1.5 }}
        className="bg-flex-row mx-auto items-center text-gray-300"
      >
        <div className="flex justify-center">
          <div onClick={() => scrollToElement('contact')}>
            <SocialIcon className="cursor-pointer " network="email" fgColor="#BA9BDD" bgColor="Transparent" />
            <p className="hidden text-sm uppercase text-gray-400 md:inline-flex">Get in touch</p>
          </div>
          <div>
            <SocialIcon
              className="cursor-pointer "
              network=""
              fgColor="#BA9BDD"
              bgColor="Transparent"
              target={`_blank`}
              url="https://docs.google.com/document/d/1ItV1Ugn87fBE8RvKji7_a5pZ8zbA59eZGVojnCoGiQA/edit?usp=sharing"
            />
            <p className="hidden text-sm uppercase text-gray-400 md:inline-flex">Resume</p>
          </div>
        </div>
      </motion.div>
    </header>
  );
};
