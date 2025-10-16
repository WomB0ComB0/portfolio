
'use client';

import Cursor from '@/app/_components/liveblocks/cursor';
import { COLORS } from '@/constants';
import { useOthers, useUpdateMyPresence } from '@liveblocks/react';
import { useSearchParams } from 'next/navigation';
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { RoomProvider } from '../../../liveblocks.config';

/**
 * LiveRoom component renders and synchronizes users' cursor positions in real-time using Liveblocks.
 * Displays colored cursors for all connected users based on their presence data.
 *
 * @function
 * @returns {React.ReactElement} React element rendering the synchronized cursors overlay
 * @see {@link https://liveblocks.io/docs/api-reference/react} Liveblocks React API
 * @web
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 * @example
 * <LiveRoom />
 */
export default function LiveRoom(): React.ReactElement {
  const others = useOthers();
  const updateMyPresence = useUpdateMyPresence();
  const roomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /**
     * Handles pointer movement, updating user presence with current cursor coordinates.
     * @private
     * @param {PointerEvent} event - The pointer movement event.
     */
    const onPointerMove = (event: PointerEvent) => {
      updateMyPresence({
        cursor: {
          x: event.clientX,
          y: event.clientY,
        },
      });
    };

    /**
     * Handles pointer leaving the window, updating user presence to clear the cursor.
     * @private
     */
    const onPointerLeave = () => {
      updateMyPresence({
        cursor: null,
      });
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerleave', onPointerLeave);

    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
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

/**
 * Inner provider component for Liveblocks multiuser presence/cursor experience.
 *
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - The children to wrap with Liveblocks context
 * @returns {React.ReactElement} Component wrapping children with Liveblocks RoomProvider and the LiveRoom cursor overlay
 * @web
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 * @example
 * <LiveBlocksProviderInner>
 *   <MainApp />
 * </LiveBlocksProviderInner>
 */
function LiveBlocksProviderInner({ children }: { children: React.ReactNode }): React.ReactElement {
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

/**
 * Provides Liveblocks multi-user context and synchronized cursors to child components.
 *
 * @function
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Children to be wrapped within the Liveblocks provider
 * @returns {React.ReactElement} Component enabled with Liveblocks context and shared cursor features
 * @web
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 * @see LiveBlocksProviderInner
 * @example
 * <LiveBlocksProvider>
 *   <App />
 * </LiveBlocksProvider>
 */
export const LiveBlocksProvider = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement => {
  return <LiveBlocksProviderInner>{children}</LiveBlocksProviderInner>;
};

/**
 * Creates a room id for Liveblocks, optionally appending a search parameter for example-specific sessions.
 *
 * @function
 * @param {string} roomId - The base room id for the Liveblocks session
 * @returns {string} The room id, possibly suffixed with the exampleId from search params for unique session
 * @see {@link https://nextjs.org/docs/app/api-reference/functions/use-search-params} Next.js useSearchParams
 * @web
 * @private
 * @author Mike Odnis
 * @version 1.0.0
 * @example
 * const roomId = useExampleRoomId('portfolio-room');
 */
function useExampleRoomId(roomId: string): string {
  const searchParams = useSearchParams();
  const exampleId = searchParams?.get('exampleId');

  const exampleRoomId = useMemo(() => {
    return exampleId ? `${roomId}-${exampleId}` : roomId;
  }, [exampleId, roomId]);

  return exampleRoomId;
}

