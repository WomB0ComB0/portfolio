"use client"
import React from 'react'
import Image from 'next/image'
type Props = {}
const Loader = (props: Props) => {
  return (
    <div className="flex items-center justify-center h-screen bg-[rgb(36,36,36)] text-white">
      <div className="flex flex-col items-center justify-center">
        <Image
          className="w-20 h-20 animate-spin"
          src="/MyLogo.png"
          alt="Loading..."
          width={80}
          height={80}
        />
        <p className="mt-2 text-sm">Loading...</p>
      </div>
    </div>
  )
}
export default Loader