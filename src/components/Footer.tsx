import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { scrollToElement } from './Hero'
type Props = {}
const Footer = (props: Props) => {
  return (
    <footer 
      className="absolute z-20 flex items-center rounded-full justify-center w-[200px] bg-transparent cursor-pointer h-[100px] bottom-0 right-0 sm:justify-flex-end">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="flex items-center justify-center bg-purple-500/50 w-[75px] h-[75px] rounded-full hover:bg-transparent transition-all">
            <button  
              className='flex items-center justify-center bg-purple-500/30 w-[75px] h-[75px] rounded-full hover:bg-transparent'>
              <Link 
                onClick={() => scrollToElement('hero')}
                href="#"
                className="w-10 h-10 overflow-hidden rounded-full">
                <Image 
                  className="w-full h-full filter grayscale hover:grayscale-0"
                  src="/MyLogo.svg" 
                  alt="Scroll to top" 
                  width={100} 
                  height={100} 
                />
              </Link>
            </button>
          </TooltipTrigger>
          <TooltipContent sideOffset={5} className="text-xs ">
            Scroll to top
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </footer>
  )
}
export default Footer