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

import { config } from '@/config';
import { createClient } from '@liveblocks/client';
import { createRoomContext } from '@liveblocks/react';

export const client = createClient({
  publicApiKey: config.liveblocks.publicKey,
});

export const {
  RoomProvider,
  useRoom,
  useMyPresence,
  useOthers,
  useBroadcastEvent,
  useEventListener,
} = createRoomContext(client);
