"use client"
import React from 'react'
import Image from 'next/image'
import { Skills } from '../constants/index'
import Link from 'next/link'
export default function Skill() {
  return (
    <>
      {Skills.map((skill) => (
        <div key={skill.name} className='relative inline-block transition-all cursor-pointer group'>
          {skill.certificate ? (
            <Link href={skill.certificate} target='_blank' rel={`noopener noreferrer`}>
            <Image
              className={`object-contain h-[50px] transition duration-300 ease-in-out border border-gray-500 ${skill.certificate? `hover:bg-[#BA9BDD]` : ``}  rounded-md w-[50px] xl:w-[100px] xl:h-[100px] filter grayscale-0 group-hover:grayscale md:w-28 md:h-28 sm:h-20 sm:w-20`}
              src={skill.image} alt={`${skill.name} skill badge`} width={200} height={200}/>
              </Link>
            ): (
              <Image
              className={`object-contain h-[50px] transition duration-300 ease-in-out border border-gray-500 rounded-md w-[50px] xl:w-[100px] xl:h-[100px] filter grayscale-0 group-hover:grayscale md:w-28 md:h-28 sm:h-20 sm:w-20`}
              src={skill.image} alt={`${skill.name} skill badge`} width={200} height={200}/>
            )}
        </div>
      ))}
    </>
  )
}