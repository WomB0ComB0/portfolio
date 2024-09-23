'use client';

import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

const NotFound = () => {
  return (
    <>
      <div className="flex items-center justify-center h-screen bg-[rgb(36,36,36)] text-white flex-col">
        <div className="flex items-center justify-center">
          <div className="loader" />
          <style jsx>{`
            .loader {
              width: 400px;
              height: 400px;
              border-radius: 50%;
              position: relative;
              background: conic-gradient([#ba9bdd], purple);
              animation: 2s rotate linear infinite;
              border: 5px solid #242424;
              transition: 0.5s;
            }
            .loader:before {
              position: absolute;
              content: '';
              width: calc(100% - 5px);
              height: calc(100% - 5px);
              background: #242424;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              border-radius: 50%;
            }
            .loader:after {
              position: absolute;
              content: '';
              z-index: -3;
              width: calc(100% + 10px);
              height: calc(100% + 10px);
              background: inherit;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              filter: blur(25px);
              border-radius: 50%;
            }
            @media only screen and (max-width: 600px) {
              .loader {
                width: 300px;
                height: 300px;
              }
            }
            @media only screen and (min-width: 600px) {
              .loader {
                width: 350px;
                height: 350px;
              }
            }
            @media only screen and (min-width: 768px) {
              .loader {
                width: 400px;
                height: 400px;
              }
            }
          `}</style>
          <Image
            className="absolute select-none h-60 w-60 animate-pulse"
            src="/assets/svgs/MyLogo.svg"
            alt="Loading..."
            width={100}
            height={100}
          />
        </div>
        <Link href={`/`}>
          <Button
            className={`mt-20 w-[200px] bg-transparent px-6 py-2 border border-purple-600 rounded-sm uppercase text-sm tracking-widest text-purple-400 transition-all hover:border-purple-600/40 hover:text-purple-400/40 hover:bg-transparent`}
          >
            Go Home
          </Button>
        </Link>
      </div>
    </>
  );
};

export default NotFound;
