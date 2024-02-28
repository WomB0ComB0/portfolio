import { motion } from 'framer-motion';
import Image from 'next/image';
import React from 'react';

export const ExperienceCard: React.FC<ExperienceProps> = ({
  logo,
  company,
  title,
  type,
  location,
  startDate,
  endDate,
  description,
}) => {
  return (
    <article className="flex w-[500px] shrink-0 cursor-pointer snap-center flex-col items-center space-y-7 overflow-hidden rounded-lg bg-[#292929] p-10  opacity-40 transition-opacity duration-200 hover:opacity-100 hover:drop-shadow-lg md:w-[600px] xl:w-[900px]">
      <div className="px-0 sm:px-0 md:px-10">
        <div className="flex flex-row gap-14">
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2 }}
            viewport={{ once: true }}
            className="size-32 rounded-full object-cover object-center xl:size-[200px]"
          >
            <Image src={logo} alt={`${company} logo`} className="rounded-full" />
          </motion.div>
          <div className="">
            <h4 className="mt-1 text-3xl font-bold xl:text-4xl">{company}</h4>
            <div className="flex justify-between">
              <h4 className="font-light text-1xl xl:text-2xl">
                {title}
                {` `}
                <span className="font-bold">{type}</span>
              </h4>
            </div>
            <p className="text-gray-300 uppercase select-none">{location}</p>
          </div>
        </div>
        <p className="py-5 text-gray-300 uppercase">
          <span className="select-none">
            {startDate} - {endDate}
          </span>
        </p>
        <ul className="ml-5 space-y-4 text-lg list-disc">
          {description.map((item, index) => (
            <li key={index} className="hover:">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
};
