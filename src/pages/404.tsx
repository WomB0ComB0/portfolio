import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import '../app/globals.css'
import '../app/global.scss'
type Props = {}
const NotFound = (props: Props) => {
  return (
    <>
      <div className="flex items-center justify-center h-screen bg-[rgb(36,36,36)] text-white flex-col">
        <div className='flex items-center justify-center'>
          <div className="loader"/>
          <Image
            className="absolute select-none h-60 w-60 animate-pulse"
            src="/MyLogo.svg"
            alt="Loading..."
            width={100}
            height={100}
          />
        </div>
        <Link href={`/`}>
          <Button className={`mt-20 w-[200px] bg-transparent px-6 py-2 border border-purple-600 rounded-sm uppercase text-sm tracking-widest text-purple-400 transition-all hover:border-purple-600/40 hover:text-purple-400/40 hover:bg-transparent`}>
            Go Home
          </Button>
        </Link>
      </div>

    </>
  )
}
export default NotFound