import { createClient } from "@liveblocks/client";

import { createRoomContext } from "@liveblocks/react";


const client = createClient({

  throttle: 16,

  publicApiKey: process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY!,

});

type Presence = {
  cursor: { x: number; y: number } | null;
};

type Storage = {
  // animals: LiveList<string>,
};

export const { RoomProvider, useOthers, useMyPresence, useUpdateMyPresence } = createRoomContext<
  Presence,Storage
>(client);