'use client';

import React from 'react';

import { COLORS } from '@/constants';
import { useLiveCursors } from '@/hooks/useLiveCursors';

import { Cursor } from './Cursor';

export const CursorCanvas = () => {
  const cursors = useLiveCursors();
  return (
    <>
      {cursors.map(({ x, y, connectionId }) => (
        <Cursor key={connectionId} color={COLORS[connectionId % COLORS.length]} x={x} y={y!} />
      ))}
    </>
  );
};
