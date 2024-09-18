'use client';

import { useEffect } from 'react';

import { useOthers, useUpdateMyPresence } from '../../liveblocks.config';

export const useLiveCursors = () => {
  const updateMyPresence = useUpdateMyPresence();
  useEffect(() => {
    const scroll = {
      x: window.scrollX,
      y: window.scrollY,
    };
    let lastPosition: { x: number; y: number } | null = null;
    function transformPosition(cursor: { x: number; y: number }) {
      return {
        x: cursor.x / window.innerWidth,
        y: cursor.y,
      };
    }
    function onPointerMove(event: PointerEvent) {
      const position = {
        x: event.pageX,
        y: event.pageY,
      };
      lastPosition = position;
      updateMyPresence({
        cursor: transformPosition(position),
      });
    }
    function onPointerLeave() {
      lastPosition = null;
      updateMyPresence({ cursor: null });
    }
    function onDocumentScroll() {
      if (lastPosition) {
        const offsetX = window.scrollX - scroll.x;
        const offsetY = window.scrollY - scroll.y;
        const position = {
          x: lastPosition.x + offsetX,
          y: lastPosition.y + offsetY,
        };
        lastPosition = position;
        updateMyPresence({
          cursor: transformPosition(position),
        });
      }
      scroll.x = window.scrollX;
      scroll.y = window.scrollY;
    }
    document.addEventListener('scroll', onDocumentScroll);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerleave', onPointerLeave);
    return () => {
      document.removeEventListener('scroll', onDocumentScroll);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [updateMyPresence]);
  const others = useOthers();
  const cursors = others
    .filter(({ presence }) => presence?.cursor)
    .map(({ connectionId, presence }) => ({
      x: presence?.cursor ? (presence.cursor.x * window.innerWidth ?? 0) : 0,
      y: presence?.cursor?.y,
      connectionId,
    }));
  return cursors;
};
