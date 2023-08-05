"use client"
import './globals.css'
import './global.scss'
import React, { useState, useEffect } from 'react';
import { Footer, Loader } from '@/components';
import { Analytics } from '@vercel/analytics/react';

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timeout);
  }, []);
  return (
    <>
      {/* {isLoading ? (
        <Loader />
      ) : ( */}
        <>
          {children}
          <Analytics />
        </>
      {/* )}  */}
    </>
  );
};

export default RootLayout;
