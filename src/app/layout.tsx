import '../styles/globals.css';
import '../styles/global.scss';

import { Analytics } from '@vercel/analytics/react';
import React from 'react';

import { constructMetadata, constructViewport } from '@/utils';

import { CursorCanvas } from './_components/CursorCanvas';
import { Room } from './Room';

export const metadata = constructMetadata();
export const viewport = constructViewport();

const RootLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => {
  return (
    <>
      <>
        <Room>
          {children}
          <CursorCanvas />
          <Analytics />
        </Room>
      </>
    </>
  );
};
export default RootLayout;
