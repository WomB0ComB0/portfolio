import '../styles/globals.css';
import '../styles/global.scss';

import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

import { Button } from '@/components/ui/button';

const NotFound = () => {
  return (
    <>
      <div className="flex h-screen flex-col items-center justify-center bg-[rgb(36,36,36)] text-white">
        <div className="flex items-center justify-center">
          <div className="loader" />
          <Image
            className="absolute size-60 animate-pulse select-none"
            src="/assets/svgs/MyLogo.svg"
            alt="Loading..."
            width={100}
            height={100}
          />
        </div>
        <Link href={`/`}>
          <Button
            className={`mt-20 w-[200px] rounded-sm border border-purple-600 bg-transparent px-6 py-2 text-sm uppercase tracking-widest text-purple-400 transition-all hover:border-purple-600/40 hover:bg-transparent hover:text-purple-400/40`}
          >
            Go Home
          </Button>
        </Link>
      </div>
    </>
  );
};
export default NotFound;
