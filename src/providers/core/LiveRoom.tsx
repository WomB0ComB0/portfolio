'use client';

import { ChatHint } from '@/app/_components/liveblocks/ChatHint';
import Cursor from '@/app/_components/liveblocks/Cursor';
import FlyingReaction from '@/app/_components/liveblocks/FlyingReaction';
import ReactionSelector from '@/app/_components/liveblocks/ReactionSelector';
import { COLORS } from '@/constants';
import { useIntervals } from '@/hooks';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RoomProvider,
  useBroadcastEvent,
  useEventListener,
  useMyPresence,
  useOthers,
} from '../../../liveblocks.config';

enum CursorMode {
  Hidden = 0,
  Chat = 1,
  ReactionSelector = 2,
  Reaction = 3,
}

type CursorState =
  | {
      mode: CursorMode.Hidden;
    }
  | {
      mode: CursorMode.Chat;
      message: string;
      previousMessage: string | null;
    }
  | {
      mode: CursorMode.ReactionSelector;
    }
  | {
      mode: CursorMode.Reaction;
      reaction: string;
      isPressed: boolean;
    };

type Reaction = {
  value: string;
  timestamp: number;
  point: { x: number; y: number };
};

type ReactionEvent = {
  x: number;
  y: number;
  value: string;
};

export default function LiveRoom() {
  const others = useOthers();
  const [{ cursor }, updateMyPresence] = useMyPresence();
  useEffect(() => {
    console.log('points', {
      x: cursor?.x ?? 0,
      y: cursor?.y ?? 0,
    });
  }, []);
  const broadcast = useBroadcastEvent();
  const [state, setState] = useState<CursorState>({ mode: CursorMode.Hidden });
  const [reactions, setReactions] = useState<Reaction[]>([]);

  const setReaction = useCallback((reaction: string) => {
    setState({ mode: CursorMode.Reaction, reaction, isPressed: false });
  }, []);

  useIntervals(() => {
    setReactions((reactions) =>
      reactions.filter((reaction) => reaction.timestamp > Date.now() - 4000),
    );
  }, 1000);

  useIntervals(() => {
    if (state.mode === CursorMode.Reaction && state.isPressed && cursor) {
      setReactions((reactions) =>
        reactions.concat([
          {
            point: { x: cursor.x, y: cursor.y },
            value: state.reaction,
            timestamp: Date.now(),
          },
        ]),
      );
      broadcast({
        x: cursor.x,
        y: cursor.y,
        value: state.reaction,
      });
    }
  }, 100);

  useEffect(() => {
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === '/') {
        setState({ mode: CursorMode.Chat, previousMessage: null, message: '' });
      } else if (e.key === 'Escape') {
        updateMyPresence({ message: '' });
        setState({ mode: CursorMode.Hidden });
      } else if (e.key === 'E' && e.shiftKey) {
        setState({ mode: CursorMode.ReactionSelector });
      }
    }

    window.addEventListener('keyup', onKeyUp);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === '/') {
        e.preventDefault();
      }
    }

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [updateMyPresence]);

  useEventListener((eventData) => {
    const event = eventData.event as ReactionEvent;
    setReactions((reactions) =>
      reactions.concat([
        {
          point: { x: event.x, y: event.y },
          value: event.value,
          timestamp: Date.now(),
        },
      ]),
    );
  });

  return (
    <>
      <ChatHint />
      <div
        className="fixed inset-0 z-[9999] pointer-events-none"
        id={`liveblocks-tag`}
        style={{
          cursor:
            state.mode === CursorMode.Chat ? 'none' : 'url(/assets/svgs/cursor.svg) 0 0, auto',
          pointerEvents: 'none',
        }}
      >
        <div
          className="w-full h-full"
          onPointerMove={(event) => {
            event.preventDefault();
            if (cursor == null || state.mode !== CursorMode.ReactionSelector) {
              updateMyPresence({
                cursor: {
                  x: Math.round(event.clientX),
                  y: Math.round(event.clientY),
                },
              });
            }
          }}
          onPointerLeave={() => {
            setState({
              mode: CursorMode.Hidden,
            });
            updateMyPresence({
              cursor: null,
            });
          }}
          onPointerDown={(event) => {
            updateMyPresence({
              cursor: {
                x: Math.round(event.clientX),
                y: Math.round(event.clientY),
              },
            });
            setState((state) =>
              state.mode === CursorMode.Reaction ? { ...state, isPressed: true } : state,
            );
          }}
          onPointerUp={() => {
            setState((state) =>
              state.mode === CursorMode.Reaction ? { ...state, isPressed: false } : state,
            );
          }}
        >
          {reactions.map((reaction) => {
            return (
              <FlyingReaction
                key={reaction.timestamp.toString()}
                x={reaction.point.x}
                y={reaction.point.y}
                timestamp={reaction.timestamp}
                value={reaction.value}
              />
            );
          })}
          {cursor && (
            <div
              className="absolute top-0 left-0"
              style={{
                transform: `translateX(${cursor.x}px) translateY(${cursor.y}px)`,
              }}
            >
              {state.mode === CursorMode.Chat && (
                <>
                  <Image src="/assets/svgs/cursor.svg" alt="Cursor" width={20} height={20} />

                  <div
                    className="absolute top-5 left-2 bg-blue-500 px-4 py-2 text-sm leading-relaxed text-white"
                    onKeyUp={(e) => e.stopPropagation()}
                    style={{
                      borderRadius: 20,
                      pointerEvents: 'auto',
                    }}
                  >
                    {state.previousMessage && <div>{state.previousMessage}</div>}
                    <input
                      className="w-60 border-none	bg-transparent text-white placeholder-blue-300 outline-none"
                      autoFocus={true}
                      onChange={(e) => {
                        updateMyPresence({ message: e.target.value });
                        setState({
                          mode: CursorMode.Chat,
                          previousMessage: null,
                          message: e.target.value,
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setState({
                            mode: CursorMode.Chat,
                            previousMessage: state.message,
                            message: '',
                          });
                        } else if (e.key === 'Escape') {
                          setState({
                            mode: CursorMode.Hidden,
                          });
                        }
                      }}
                      placeholder={state.previousMessage ? '' : 'Say something…'}
                      value={state.message}
                      maxLength={50}
                    />
                  </div>
                </>
              )}
              {state.mode === CursorMode.ReactionSelector && (
                <ReactionSelector
                  setReaction={(reaction) => {
                    setReaction(reaction);
                  }}
                />
              )}
              {state.mode === CursorMode.Reaction && (
                <div className="pointer-events-none absolute top-3.5 left-1 select-none">
                  {state.reaction}
                </div>
              )}
            </div>
          )}

          {others.map(({ connectionId, presence }) => {
            if (presence == null || !presence.cursor) {
              return null;
            }

            return (
              <Cursor
                key={connectionId}
                color={COLORS[connectionId % COLORS.length] || 'defaultColor'}
                x={presence.cursor.x}
                y={presence.cursor.y}
                message={presence.message}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
export const LiveBlocksProvider = ({ children }: { children: React.ReactNode }) => {
  const roomId = useExampleRoomId('mike-odnis-portfolio-chat');

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
};

function useExampleRoomId(roomId: string) {
  const searchParams = useSearchParams();
  const exampleId = searchParams.get('exampleId');

  const exampleRoomId = useMemo(() => {
    return exampleId ? `${roomId}-${exampleId}` : roomId;
  }, [exampleId, roomId]);

  return exampleRoomId;
}
