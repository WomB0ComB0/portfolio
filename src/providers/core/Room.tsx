'use client';

import type React from 'react';

import { LiveObject } from '@liveblocks/client';
import type { ReactNode } from 'react';

import { RoomProvider } from '../../../liveblocks.config';

export const Room: React.FC<
  Readonly<{
    children: ReactNode;
  }>
> = ({ children }) => {
  return (
    <RoomProvider
      id="my-room-name"
      initialPresence={{
        cursor: null,
      }}
      initialStorage={{
        session: new LiveObject(),
      }}
    >
      {children}
    </RoomProvider>
  );
};
