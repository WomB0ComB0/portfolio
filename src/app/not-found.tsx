'use client';

import Particles from '@/components/magicui/particles';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

const NotFound = () => {
  return (
    <div className="relative flex items-center justify-center h-screen bg-[#242424] text-white overflow-hidden">
      <Particles
        className="absolute inset-0 z-0"
        quantity={100}
        ease={80}
        color={'#ba9bdd'}
        refresh={false}
        staticity={50}
        size={0.8}
      />
      <div className="relative z-10 flex flex-col items-center justify-center">
        <div className="relative">
          <div className="loader" />
          <Image
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 select-none w-60 h-60 animate-pulse"
            src="/assets/svgs/logo-client.svg"
            alt="404 Not Found"
            width={240}
            height={240}
            priority
          />
        </div>
        <h1 className="mt-8 text-4xl font-bold text-purple-300">404 - Not Found</h1>
        <p className="mt-4 text-xl text-purple-200">
          Oops! The page you're looking for doesn't exist.
        </p>
        <Link href={'/'}>
          <Button className="mt-8 w-[200px] bg-transparent px-6 py-2 border border-purple-600 rounded-sm uppercase text-sm tracking-widest text-purple-400 transition-all hover:border-purple-600/40 hover:text-purple-400/40 hover:bg-transparent">
            Go Home
          </Button>
        </Link>
      </div>
      <style jsx>{`
        .loader {
          width: 400px;
          height: 400px;
          border-radius: 50%;
          position: relative;
          background: conic-gradient(#ba9bdd, purple);
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
          z-index: -1;
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
        @media only screen and (min-width: 601px) and (max-width: 767px) {
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
        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default NotFound;
