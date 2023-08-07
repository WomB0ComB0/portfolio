import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
type Props = {
  logo?: string | any;
  company: string;
  title: string;
  type: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string[];
};
export default function ExperienceCard({ logo, company, title, type, location, startDate, endDate, description,}: Props) {
  return (
    <article className='flex flex-col items-center flex-shrink-0 rounded-lg space-y-7 w-[500px] md:w-[600px] xl:w-[900px] snap-center bg-[#292929] p-10  hover:opacity-100 opacity-40 cursor-pointer transition-opacity duration-200 overflow-hidden hover:drop-shadow-lg'>
      <div className='px-0 md:px-10 sm:px-0'>
        <div className='flex flex-row gap-14'>
          <motion.div
            initial={{ y: -100, opacity: 0,}}
            whileInView={{ opacity: 1, y: 0,}}
            transition={{  duration: 1.2,}}
            viewport={{  once: true,}}
            className='w-32 h-32 rounded-full xl:w-[200px] xl:h-[200px] object-cover object-center'
          >
            <Image src={logo} alt={`${company} logo`} className='rounded-full' />
          </motion.div>
          <div className=''>
            <h4 className='mt-1 text-3xl font-bold xl:text-4xl'>{company}</h4>
            <div className='flex justify-between'>
              <h4 className='font-light text-1xl xl:text-2xl'>{title}{` `}<span className='font-bold'>{type}</span></h4>
            </div>
            <p className='text-gray-300 uppercase select-none'>{location}</p>
          </div>
        </div>
        <p className='py-5 text-gray-300 uppercase'>
          <span className='select-none'>
            {startDate} - {endDate}
          </span>
        </p>
        <ul className='ml-5 space-y-4 text-lg list-disc'>
          {description.map((item, index) => (
            <li key={index}className='hover:'>{item}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}