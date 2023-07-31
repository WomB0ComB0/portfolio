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
            className="absolute select-none h-60 w-60 animate-pulse"
            src="/MyLogo.svg"
            alt="Loading..."
            width={100}
            height={100}
          />
      </div>
    </>
  )
}
export default Loader