'use client';

import { COLORS } from '@/constants/index';
import { useLiveCursors } from '@/hooks/useLiveCursors';
import React from 'react';

import { Cursor } from './Cursor';

export const CursorCanvas = () => {
  const cursors: { x: number; y: number | undefined; connectionId: number }[] = useLiveCursors();
  return (
    <>
      {cursors.map(({ x, y, connectionId }) => (
        <Cursor key={connectionId} color={COLORS[connectionId % COLORS.length]!} x={x} y={y!} />
      ))}
    </>
  );
};
