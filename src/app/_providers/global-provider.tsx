'use client';

import { Analytics } from '@vercel/analytics/react';
import type React from 'react';
import { useEffect } from 'react';
import WebVitals from '@/app/_components/web-vitals';
import { PageTransition, TailwindIndicator } from '@/components';
import { Events, GlobalStoreProvider, Providers, ScrollProvider } from '@/providers';

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
          [ScrollProvider, {}],
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
