'use client';

import { Analytics } from '@vercel/analytics/react';
import type React from 'react';
import { useEffect } from 'react';
import { WebVitals } from '@/app/_components';
import { PageTransition, TailwindIndicator } from '@/components';
import { Events, GlobalStoreProvider, Providers } from '@/providers';

const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
          [GlobalStoreProvider, {}],
          [Events, {}],
        ]}
      >
        <PageTransition>{children}</PageTransition>
        <WebVitals />
        <Analytics />
        <TailwindIndicator />
      </Providers>
    </>
  );
};

GlobalProvider.displayName = 'GlobalProvider';
export { GlobalProvider };
