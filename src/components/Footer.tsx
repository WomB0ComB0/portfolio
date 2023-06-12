import React from 'react'
import Image from 'next/image'
type Props = {}
const Footer = (props: Props) => {
  return (
    <footer className="sticky z-20 w-full cursor-pointer bottom-5">
      <button  className='flex items-center justify-center'>
        <a href="#hero" className="w-10 h-10 overflow-hidden rounded-full">
          <Image 
          className="w-full h-full filter grayscale hover:grayscale-0"
          src="/MyLogo.svg" alt="Scroll to top" width={100} height={100} />
        </a>
      </button>
    </footer>
  )
}
export default Footer