"use client"
import './globals.css'
import './global.scss'
import React, { useState, useEffect } from 'react';
import { Loader } from '@/components';
import Head from 'next/head';
// import { RoomProvider, useMyPresence } from '../../liveblocks.config';
// import LiveCursors from '@/components/cursor/LiveCursors';
// import { useRouter } from 'next/router';
// import { useMemo, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';


const RootLayout = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  // const roomId = useOverrideRoomId("nextjs-live-cursors-advanced");
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timeout);
  }, []);
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('scope is: ', registration.scope)
        })
        .catch((error) => console.error('Service Worker registration failed:', error));
    }
  }, []);
  return (
    <>
      <Head>
        <title>Mike Odnis</title>
      </Head>
      {isLoading ? (
        <Loader />
      ) : (
        <>
          {/* <RoomProvider
              id={roomId}
              Initialize the cursor position to null when joining the room
              initialPresence={{
                cursor: null,
              }}
           > */}
          {children}
          <Analytics />
          {/* </RoomProvider> */}
        </>
      )}
    </>
  );
};
export default RootLayout;

// function Example() {
//   const cursorPanel = useRef(null);
//   const [{ cursor }] = useMyPresence();

//   return (
//     <main ref={cursorPanel} className={styles.main}>
//       <LiveCursors cursorPanel={cursorPanel} />
//       <div className={styles.text}>
//         {cursor
//           ? `${cursor.x} × ${cursor.y}`
//           : "Move your cursor to broadcast its position to other people in the room."}
//       </div>
//     </main>
//   );
// }

// function useOverrideRoomId(roomId: string) {
//   const { query } = useRouter();
//   const overrideRoomId = useMemo(() => {
//     return query?.roomId ? `${roomId}-${query.roomId}` : roomId;
//   }, [query, roomId]);

//   return overrideRoomId;
// }