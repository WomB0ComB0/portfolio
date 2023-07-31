"use client"
import React from 'react'
import Image from 'next/image'
import { Skills } from '../constants/index'
import Link from 'next/link'
export default function Skill() {
  return (
    <>
      {Skills.map((skill, index) => (
        <div key={skill.name} className='relative flex cursor-pointer group'>
          {skill.certificate ? (
            <Link href={skill.certificate} target='_blank' rel={`noopener noreferrer`}>
            <Image
              className={`object-contain h-24 transition duration-300 ease-in-out border ${skill.certificate? `border-[#BA9BDD]` : `border-gray-500`}  rounded-md w-[150px] xl:w-[100px] xl:h-[100px] filter grayscale-0 group-hover:grayscale md:w-28 md:h-28`}
              src={skill.image} alt={`${skill.name} skill badge`} width={200} height={200}/>
              </Link>
            ): (
              <Image
              className={`object-contain h-24 transition duration-300 ease-in-out border border-gray-500 rounded-md w-[150px] xl:w-[100px] xl:h-[100px] filter grayscale-0 group-hover:grayscale md:w-28 md:h-28`}
              src={skill.image} alt={`${skill.name} skill badge`} width={200} height={200}/>
            )}
        </div>
      ))}
    </>
  )
}