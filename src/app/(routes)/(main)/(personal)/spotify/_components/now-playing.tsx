'use client';

/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { FetchHttpClient } from '@effect/platform';
import { useQuery } from '@tanstack/react-query';
import { Effect, pipe, Schema } from 'effect';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { SiSpotify } from 'react-icons/si';
import { MagicCard } from '@/components/magicui';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { get } from '@/lib/http-clients/effect-fetcher';
import { requestQueue } from '@/lib/http-clients/request-queue';
import { cn } from '@/lib/utils';

/**
 * GET /api/v1/now-playing. `isPlaying: false` means Spotify reported nothing playing; a failure
 * arrives as an error (a 500), never as `isPlaying: false`.
 */
const NowPlayingSchema = Schema.Struct({
  isPlaying: Schema.Boolean,
  songName: Schema.optional(Schema.String),
  artistName: Schema.optional(Schema.String),
  songURL: Schema.optional(Schema.String),
  artistURL: Schema.optional(Schema.String),
  imageURL: Schema.optional(Schema.String),
});

type NowPlayingData = Schema.Schema.Type<typeof NowPlayingSchema>;

const NOW_PLAYING_URL = '/api/v1/now-playing';
const NOW_PLAYING_QUERY_KEY = ['spotify-page', 'now-playing'] as const;
/**
 * The Discord card's fallback asks the same URL but decodes less of the answer (no artistURL), so
 * the request queue never hands this card its result.
 */
const NOW_PLAYING_RESULT_KEY = 'spotify-card:NowPlayingSchema';
/** How often the card asks again, so "Now playing" is never more than this out of date. */
const NOW_PLAYING_REFRESH_MS = 60_000;
const NOW_PLAYING_TIMEOUT_MS = 10_000;
const ALBUM_ART_PX = 80;

const IDLE_MESSAGE = 'Not listening right now';
/** Playing, but Spotify sent no track (an episode or an ad). */
const PLAYING_WITHOUT_TRACK_MESSAGE = 'Listening on Spotify';
const ERROR_MESSAGE = "Couldn't reach Spotify";

const MESSAGE_CLASS = 'text-lg font-semibold leading-snug text-foreground';
const LINK_FOCUS_CLASS =
  'rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

interface NowPlayingLayoutProps {
  /** The 80 px square on the left: album art, a placeholder or a skeleton. */
  art: ReactNode;
  /** The small label above the message. */
  label: ReactNode;
  children: ReactNode;
}

/** One layout for every state, so the card keeps its size while it loads, plays or fails. */
const NowPlayingLayout = ({ art, label, children }: NowPlayingLayoutProps) => (
  <div className="flex w-full items-center gap-4">
    <div className="size-20 shrink-0">{art}</div>
    <div className="flex min-w-0 grow flex-col gap-1">
      {label}
      {children}
    </div>
  </div>
);

const ArtPlaceholder = () => (
  <div className="flex size-full items-center justify-center rounded-md bg-secondary text-muted-foreground">
    <SiSpotify aria-hidden="true" className="size-8" />
  </div>
);

/** "Now playing", with a pulsing dot only while something really plays. */
const StatusLabel = ({ isLive }: { isLive: boolean }) => (
  <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
    <span
      aria-hidden="true"
      className={cn(
        'size-2 shrink-0 rounded-full',
        isLive ? 'bg-primary motion-safe:animate-pulse' : 'bg-muted',
      )}
    />
    Now playing
  </p>
);

interface ExternalLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
}

const ExternalLink = ({ href, className, children }: ExternalLinkProps) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className={cn(LINK_FOCUS_CLASS, className)}
  >
    {children}
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
);

interface MaybeLinkProps {
  href: string | undefined;
  className: string;
  /** Added only when the text is a link, e.g. its hover colour. */
  linkClassName: string;
  children: ReactNode;
}

/** Text that links to Spotify when the API sent a page for it, and stays plain text otherwise. */
const MaybeLink = ({ href, className, linkClassName, children }: MaybeLinkProps) =>
  href ? (
    <ExternalLink href={href} className={cn(className, linkClassName)}>
      {children}
    </ExternalLink>
  ) : (
    <p className={className}>{children}</p>
  );

interface NowPlayingMessageProps {
  message: string;
  isLive?: boolean;
  children?: ReactNode;
}

/** Idle, playing without a track, and error: a message with no links. */
const NowPlayingMessage = ({ message, isLive = false, children }: NowPlayingMessageProps) => (
  <NowPlayingLayout art={<ArtPlaceholder />} label={<StatusLabel isLive={isLive} />}>
    <p className={MESSAGE_CLASS}>{message}</p>
    {children}
  </NowPlayingLayout>
);

type PlayingTrack = NowPlayingData & { songName: string };

const AlbumArt = ({ imageURL }: { imageURL: string | undefined }) =>
  imageURL ? (
    // The track name sits right beside the art, so the image itself is decorative.
    <Image
      className="size-20 rounded-md object-cover shadow-lg"
      src={imageURL}
      alt=""
      width={ALBUM_ART_PX}
      height={ALBUM_ART_PX}
      sizes={`${ALBUM_ART_PX}px`}
      placeholder="empty"
    />
  ) : (
    <ArtPlaceholder />
  );

const NowPlayingTrack = ({ songName, artistName, songURL, artistURL, imageURL }: PlayingTrack) => (
  <NowPlayingLayout art={<AlbumArt imageURL={imageURL} />} label={<StatusLabel isLive />}>
    <MaybeLink
      href={songURL}
      className={cn(MESSAGE_CLASS, 'line-clamp-2 break-words')}
      linkClassName="hover:text-primary"
    >
      {songName}
    </MaybeLink>
    {artistName && (
      <MaybeLink
        href={artistURL}
        className="truncate text-sm text-muted-foreground"
        linkClassName="hover:text-foreground"
      >
        {artistName}
      </MaybeLink>
    )}
  </NowPlayingLayout>
);

const NowPlayingContent = ({ data }: { data: NowPlayingData }) => {
  if (!data.isPlaying) return <NowPlayingMessage message={IDLE_MESSAGE} />;
  if (!data.songName) return <NowPlayingMessage message={PLAYING_WITHOUT_TRACK_MESSAGE} isLive />;
  return <NowPlayingTrack {...data} songName={data.songName} />;
};

const NowPlayingSkeleton = () => (
  <NowPlayingLayout
    art={<Skeleton className="size-20 rounded-md bg-accent/20" />}
    label={<Skeleton className="h-3 w-24 bg-accent/20" />}
  >
    <Skeleton className="h-6 w-48 max-w-full bg-accent/20" />
    <Skeleton className="h-4 w-32 max-w-full bg-accent/20" />
  </NowPlayingLayout>
);

interface NowPlayingErrorProps {
  onRetry: () => void;
  /** A request is on its way (the retry, or the next poll), so another click would do nothing. */
  isRetrying: boolean;
}

/** The latest request failed (after the query's retry): say so, and offer another try. */
const NowPlayingError = ({ onRetry, isRetrying }: NowPlayingErrorProps) => (
  <NowPlayingMessage message={ERROR_MESSAGE}>
    <Button
      variant="outline"
      size="sm"
      className="mt-1 self-start"
      onClick={onRetry}
      disabled={isRetrying}
    >
      Try again
    </Button>
  </NowPlayingMessage>
);

/**
 * One attempt per poll, through the page's request queue (which shares concurrent identical
 * requests). TanStack Query's shared default (shouldRetryQuery) is the single retry layer.
 */
const fetchNowPlaying = (): Promise<NowPlayingData> =>
  requestQueue.enqueue(
    NOW_PLAYING_URL,
    'GET',
    () =>
      Effect.runPromise(
        pipe(
          get(NOW_PLAYING_URL, {
            schema: NowPlayingSchema,
            retries: 0,
            timeout: NOW_PLAYING_TIMEOUT_MS,
          }),
          Effect.provide(FetchHttpClient.layer),
        ),
      ),
    { resultKey: NOW_PLAYING_RESULT_KEY },
  );

/**
 * The card's poll. A plain query rather than DataLoader: DataLoader keeps an earlier answer on
 * screen when a later poll fails, which here would show a track as live, pulsing dot and all,
 * for as long as Spotify stays unreachable.
 */
const useNowPlaying = () =>
  useQuery({
    queryKey: NOW_PLAYING_QUERY_KEY,
    queryFn: fetchNowPlaying,
    staleTime: NOW_PLAYING_REFRESH_MS,
    refetchInterval: NOW_PLAYING_REFRESH_MS,
    refetchOnWindowFocus: false,
  });

/**
 * What the card shows for its query. A failure wins over an earlier poll's answer: TanStack keeps
 * that answer beside the error, but it is no longer what is playing.
 */
const NowPlayingState = () => {
  const { data, isError, isFetching, refetch } = useNowPlaying();
  if (isError) {
    return <NowPlayingError onRetry={() => void refetch()} isRetrying={isFetching} />;
  }
  if (!data) return <NowPlayingSkeleton />;
  return <NowPlayingContent data={data} />;
};

/**
 * The /spotify now-playing card: the track, artist and album art with links to Spotify while
 * something plays, "Not listening right now" when nothing does, and an error with a retry when
 * the latest poll couldn't reach Spotify, even if an earlier one could. Only pages the API sent
 * are linked; nothing links to "#".
 */
export const NowPlaying = () => (
  <MagicCard className="rounded-2xl p-4 shadow-2xl md:p-6">
    <h2 className="sr-only">Now Playing</h2>
    <NowPlayingState />
  </MagicCard>
);
NowPlaying.displayName = 'NowPlaying';
export default NowPlaying;
