'use client';

// import { Providers } from '@/providers';
import type React from 'react';

const MainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

MainProvider.displayName = 'MainProvider';
export { MainProvider };
