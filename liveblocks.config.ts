declare global {
  interface Liveblocks {
    Presence: {
      cursor: {
        x: number;
        y: number;
      } | null;
      message: string;
    };
    RoomEvent: {
      x: number;
      y: number;
      value: string;
    };
  }
}

import { createClient } from '@liveblocks/client';
import { createRoomContext } from '@liveblocks/react';

export const client = createClient({
  publicApiKey: process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY!,
});

export const {
  RoomProvider,
  useRoom,
  useMyPresence,
  useOthers,
  useBroadcastEvent,
  useEventListener,
} = createRoomContext(client);
