'use client';

import Image from 'next/image';
import React from 'react';

export const Loader: React.FC = () => {
  return (
    <>
      <div className="flex h-screen flex-col items-center justify-center bg-[rgb(36,36,36)] text-white">
        <>
          <div className="loader" />
        </>
        <Image
          className="absolute mt-2 transition-all select-none size-52 animate-pulse"
          src="/assets/svgs/MyLogo.svg"
          alt="Loading..."
          layout="fixed"
          objectFit="contain"
          priority={true}
          loading="eager"
          width={200}
          height={200}
        />
      </div>
    </>
  );
};
