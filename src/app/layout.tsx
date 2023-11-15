"use client"
import './globals.css'
import './global.scss'
import React, { useState, useEffect } from 'react';
import { Loader } from '@/components';
import Head from 'next/head';
import { Analytics } from '@vercel/analytics/react';
const RootLayout = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timeout);
  }, []);
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('scope is: ', registration.scope)
        })
        .catch((error) => console.error('Service Worker registration failed:', error));
    }
  }, []);
  return (
    <>
      <Head>
        <title>Mike Odnis</title>
      </Head>
      {isLoading ? (
        <Loader />
      ) : (
        <>
          {children}
          <Analytics />
        </>
      )}
    </>
  );
};
export default RootLayout;