'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Analytics } from '@vercel/analytics/react';
import { KBarProvider } from 'kbar';
import type React from 'react';
import { useEffect } from 'react';
import { WebVitals } from '@/app/_components';
import { PageTransition } from '@/components/animations';
import { actions } from '@/lib';
import { CustomAnimatedCursor, Events, Providers, ThemeProvider } from '@/providers';
import { TailwindIndicator } from '@/providers/core';
import { createQueryClient } from '@/providers/server';

const GlobalProvider: React.FC<
  Readonly<{
    children: React.ReactNode;
  }>
> = ({ children }) => {
  useEffect(() => {
    const handleOffline = () => {
      if (!navigator.onLine) {
        console.log('Offline');
        window.location.href = '/offline';
      }
    };

    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, []);

  return (
    <>
      <Providers
        providers={[
          [Events, {}],
          [ThemeProvider, {}],
          [KBarProvider, { actions }],
          [QueryClientProvider, { client: createQueryClient() }],
        ]}
      >
        <PageTransition>{children}</PageTransition>
        <WebVitals />
        <Analytics />
        <TailwindIndicator />
        <CustomAnimatedCursor />
        <ReactQueryDevtools initialIsOpen={false} />
      </Providers>
    </>
  );
};

GlobalProvider.displayName = 'GlobalProvider';
export { GlobalProvider };
