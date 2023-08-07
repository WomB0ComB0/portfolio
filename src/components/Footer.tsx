import React, { useEffect, useState} from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { scrollToElement } from './Hero'
type Props = {}
const Footer = (props: Props) => {
  const [isHidden, setIsHidden] = useState(true);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setIsHidden(true);
        } else {
          setIsHidden(false);
        }
      });
    });
    const section = document.querySelector('section');
    if (section) {
      observer.observe(section);
    }
    return () => {
      if (section) {
        observer.unobserve(section);
      }
    };
  }, []);
  return (
    <footer 
      className={`absolute z-20 flex items-center rounded-full justify-center w-[100px] bg-transparent cursor-pointer h-[100px] bottom-0 right-0 sm:justify-flex-end ${
        isHidden ? 'hidden' : 'visible'
      }`}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="flex items-center justify-center bg-[#d6b3f0]/50 w-[75px] h-[75px] rounded-lg hover:bg-transparent transition-all ">
            <>
              <Link 
                onClick={() => scrollToElement('hero')}
                href="/"
                className="w-10 h-10 overflow-hidden rounded-full">
                <Image 
                  className="w-full h-full filter grayscale hover:grayscale-0"
                  src="/MyLogo.svg" 
                  alt="Scroll to top" 
                  width={100} 
                  height={100} 
                />
              </Link>
            </>
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