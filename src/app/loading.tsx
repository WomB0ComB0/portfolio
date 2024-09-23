'use client';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
const Loading = React.memo(() => {
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
      </div>
    </>
  );
});
export default Loading;
