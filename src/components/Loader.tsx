"use client"
import React from 'react'
import Image from 'next/image'
type Props = {}
const Loader = (props: Props) => {
  return (
    <>
      <div className="flex items-center justify-center h-screen bg-[rgb(36,36,36)] text-white flex-col">
        <>
          <div className="loader"/>
        </>
        <Image
          className="absolute mt-2 transition-all select-none animate-pulse h-52 w-52"
          src="/MyLogo.svg"
          alt="Loading..."
          layout='fixed'
          objectFit="contain"
          priority={true}
          loading='eager'
          width={200}
          height={200}
        />
      </div>
    </>
  )
}
export default Loader