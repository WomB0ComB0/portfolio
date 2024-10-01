'use client';

import { COLORS } from '@/constants';
import { useOthers, useUpdateMyPresence } from "@liveblocks/react";
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useMemo, useRef } from 'react';
import { RoomProvider } from '../../../liveblocks.config';
import Cursor from '@/app/_components/liveblocks/Cursor';

export default function LiveRoom() {
  const others = useOthers();
  const updateMyPresence = useUpdateMyPresence();
  const roomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      updateMyPresence({
        cursor: {
          x: event.clientX,
          y: event.clientY,
        },
      });
    };

    const onPointerLeave = () => {
      updateMyPresence({
        cursor: null,
      });
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerleave", onPointerLeave);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [updateMyPresence]);

  return (
    <div ref={roomRef} className="fixed inset-0 z-50 pointer-events-none">
      {others.map(({ connectionId, presence }) => {
        if (presence.cursor) {
          return (
            <Cursor
              key={`cursor-${connectionId}`}
              color={COLORS[connectionId % COLORS.length] ?? ''}
              x={presence.cursor.x}
              y={presence.cursor.y}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

function LiveBlocksProviderInner({ children }: { children: React.ReactNode }) {
  const roomId = useExampleRoomId('mike-odnis-portfolio-cursors');

  return (
    <RoomProvider
      id={roomId}
      initialPresence={() => ({
        cursor: null,
        message: '',
      })}
    >
      {children}
      <LiveRoom />
    </RoomProvider>
  );
}

export const LiveBlocksProvider = ({ children }: { children: React.ReactNode }) => {
  return <LiveBlocksProviderInner>{children}</LiveBlocksProviderInner>;
};

function useExampleRoomId(roomId: string) {
  const searchParams = useSearchParams();
  const exampleId = searchParams?.get('exampleId');

  const exampleRoomId = useMemo(() => {
    return exampleId ? `${roomId}-${exampleId}` : roomId;
  }, [exampleId, roomId]);

  return exampleRoomId;
}
