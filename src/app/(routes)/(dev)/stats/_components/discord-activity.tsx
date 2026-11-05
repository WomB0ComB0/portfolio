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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Effect, pipe } from 'effect';
import Image from 'next/image';
import { type ReactNode, useEffect } from 'react';
import { FiActivity, FiArrowUpRight, FiHeadphones } from 'react-icons/fi';
import { SiSpotify, SiVscodium } from 'react-icons/si';
import { Skeleton } from '@/components/ui/skeleton';
import { get } from '@/lib/http-clients/effect-fetcher';
import { requestQueue } from '@/lib/http-clients/request-queue';
import { cn } from '@/lib/utils';
import { logger } from '@/utils';
import {
  activityHeading,
  type DiscordActivity,
  httpsUrlOn,
  isListening,
  MAX_ACTIVITY_ROWS,
  type NowPlaying,
  NowPlayingSchema,
  selectActivities,
  spotifyArtUrl,
} from './discord-activity.utils';

const NOW_PLAYING_URL = '/api/v1/now-playing';
/** Same cadence as the Lanyard query; request-queue allows now-playing 5 calls a minute. */
const NOW_PLAYING_REFRESH_MS = 30_000;
/**
 * How long an answer may be shown: two polls, so one failed poll keeps the song but an answer
 * left over from repeated failures is not shown. Answers from before the fallback was switched
 * off are dropped when it switches off (see useNowPlayingFallback).
 */
const NOW_PLAYING_MAX_AGE_MS = 2 * NOW_PLAYING_REFRESH_MS;
const NOW_PLAYING_QUERY_KEY = ['discord-card', 'now-playing'] as const;
const NOW_PLAYING_TIMEOUT_MS = 5_000;
const ART_SIZE = 40;
const SPOTIFY_ART_HOST = 'i.scdn.co';
const SPOTIFY_LINK_HOST = 'open.spotify.com';

interface ActivityRowData {
  key: string;
  heading: string;
  primary?: string;
  secondary?: string;
  icon: ReactNode;
  art?: { src: string; alt: string };
  /** Present for rows that link out; `label` is then the link's accessible name. */
  link?: { href: string; label: string };
}

const fetchNowPlaying = (): Promise<NowPlaying> =>
  requestQueue.enqueue(NOW_PLAYING_URL, 'GET', () =>
    Effect.runPromise(
      pipe(
        get(NOW_PLAYING_URL, {
          schema: NowPlayingSchema,
          retries: 1,
          timeout: NOW_PLAYING_TIMEOUT_MS,
          onError: (error) => logger.warn('[Discord] now-playing fallback failed', { error }),
        }),
        Effect.provide(FetchHttpClient.layer),
      ),
    ),
  );

/**
 * What Spotify itself says is playing. Asked only while Discord reports no listening activity:
 * Discord doesn't publish Spotify from every client (the web app, for one). A failure leaves the
 * query in its error state, which the card shows as "not in an activity", never as its error card.
 * TanStack keeps the last good answer through later failures, so callers check `isStale` too.
 */
const useNowPlayingFallback = (enabled: boolean) => {
  const queryClient = useQueryClient();
  // A disabled query keeps its last answer. Reset it while Discord reports listening, so turning
  // the fallback back on starts from a new request instead of showing that track until the next
  // poll. Resetting a disabled query does not refetch it.
  useEffect(() => {
    if (!enabled) {
      void queryClient.resetQueries({ queryKey: NOW_PLAYING_QUERY_KEY, exact: true });
    }
  }, [enabled, queryClient]);

  return useQuery({
    queryKey: NOW_PLAYING_QUERY_KEY,
    queryFn: fetchNowPlaying,
    enabled,
    staleTime: NOW_PLAYING_MAX_AGE_MS,
    refetchInterval: NOW_PLAYING_REFRESH_MS,
    // Only refetches a stale answer, so returning to the tab doesn't wait for the next poll.
    refetchOnWindowFocus: true,
    // The fetch retries once itself, and the next poll is the retry after that.
    retry: false,
  });
};

const ActivityIcon = ({ name }: { name: string }) => {
  const lower = name.toLowerCase();
  if (lower.includes('spotify')) return <FiHeadphones className="h-5 w-5" />;
  if (lower.includes('visual studio code')) return <SiVscodium className="h-5 w-5" />;
  return <FiActivity className="h-5 w-5" />;
};

const fromDiscord = (activity: DiscordActivity, index: number): ActivityRowData => {
  const artSrc = spotifyArtUrl(activity.assets?.large_image);
  const artSubject = activity.assets?.large_text ?? activity.details;
  return {
    key: `discord-${index}-${activity.type}-${activity.name}`,
    heading: activityHeading(activity),
    primary: activity.details,
    secondary: activity.state,
    icon: <ActivityIcon name={activity.name} />,
    art: artSrc
      ? { src: artSrc, alt: artSubject ? `Album art for ${artSubject}` : 'Album art' }
      : undefined,
  };
};

const fromNowPlaying = ({
  songName,
  artistName,
  imageURL,
  songURL,
}: NowPlaying): ActivityRowData => {
  const heading = 'Listening on Spotify';
  const artSrc = httpsUrlOn(imageURL, SPOTIFY_ART_HOST);
  const href = httpsUrlOn(songURL, SPOTIFY_LINK_HOST);
  const track = [songName, artistName && `by ${artistName}`].filter(Boolean).join(' ');
  return {
    key: 'spotify-now-playing',
    heading,
    primary: songName,
    secondary: artistName,
    icon: <SiSpotify className="h-5 w-5" />,
    art: artSrc
      ? { src: artSrc, alt: songName ? `Album art for ${songName}` : 'Album art' }
      : undefined,
    link: href
      ? { href, label: `${heading}${track ? `: ${track}` : ''} (opens in a new tab)` }
      : undefined,
  };
};

/** Album art with a small Spotify badge, or the icon tile the card has always used. */
const ActivityTile = ({ icon, art }: Pick<ActivityRowData, 'icon' | 'art'>) => {
  if (!art) {
    return (
      <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
        {icon}
      </div>
    );
  }
  return (
    <div className="relative w-10 h-10 shrink-0">
      <Image
        src={art.src}
        alt={art.alt}
        width={ART_SIZE}
        height={ART_SIZE}
        loading="lazy"
        className="w-10 h-10 rounded-lg object-cover shadow-sm ring-1 ring-border/50"
      />
      <span
        aria-hidden="true"
        className="absolute -right-1 -bottom-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground"
      >
        <SiSpotify className="h-2.5 w-2.5" />
      </span>
    </div>
  );
};

const ActivityRowBody = ({ row, isLink }: { row: ActivityRowData; isLink: boolean }) => (
  <>
    <ActivityTile icon={row.icon} art={row.art} />
    <div className="min-w-0 space-y-0.5">
      <p className="truncate font-semibold text-sm leading-5 text-foreground">{row.heading}</p>
      {row.primary && (
        <p
          className={cn(
            'truncate text-xs leading-4 text-muted-foreground transition-colors duration-200',
            isLink && 'group-hover:text-foreground group-focus-visible:text-foreground',
          )}
        >
          {row.primary}
        </p>
      )}
      {row.secondary && (
        <p className="truncate text-xs leading-4 text-muted-foreground/80">{row.secondary}</p>
      )}
    </div>
  </>
);

const ActivityRow = ({ row }: { row: ActivityRowData }) => {
  if (!row.link) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <ActivityRowBody row={row} isLink={false} />
      </div>
    );
  }
  return (
    <a
      href={row.link.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={row.link.label}
      className={cn(
        'group -mx-2 -my-1.5 flex min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 text-foreground',
        'transition-colors duration-200 hover:bg-primary/10 active:bg-primary/15',
        'ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
    >
      <ActivityRowBody row={row} isLink />
      <FiArrowUpRight
        aria-hidden="true"
        className={cn(
          // Tailwind v4's translate-* set the `translate` property, not `transform`.
          'ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-[color,translate] duration-200',
          'group-hover:text-primary group-focus-visible:text-primary',
          'motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5',
        )}
      />
    </a>
  );
};

const ActivityRowSkeleton = () => (
  <div className="flex items-center gap-3" aria-hidden="true">
    <Skeleton className="h-10 w-10 rounded-lg" />
    <div className="space-y-1.5">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-24" />
    </div>
  </div>
);

const NoActivity = () => (
  <div className="text-center w-full">
    <p className="text-sm font-medium text-muted-foreground">Currently not in an activity.</p>
  </div>
);

interface DiscordActivitiesProps {
  activities: readonly DiscordActivity[] | undefined;
}

/**
 * The Discord card's activity area: Discord's own activities (custom status left out, listening
 * first), plus Spotify's now-playing when Discord has nothing to say about music.
 */
export const DiscordActivities = ({ activities }: DiscordActivitiesProps) => {
  const discordActivities = selectActivities(activities);
  const discordIsListening = discordActivities.some(isListening);
  const nowPlaying = useNowPlayingFallback(!discordIsListening);

  const fallback =
    !discordIsListening && !nowPlaying.isStale && nowPlaying.data?.isPlaying
      ? fromNowPlaying(nowPlaying.data)
      : null;
  const rows = [...(fallback ? [fallback] : []), ...discordActivities.map(fromDiscord)].slice(
    0,
    MAX_ACTIVITY_ROWS,
  );

  if (rows.length > 0) {
    return (
      <ul aria-label="Current activity" className="w-full space-y-3">
        {rows.map((row) => (
          <li key={row.key}>
            <ActivityRow row={row} />
          </li>
        ))}
      </ul>
    );
  }
  if (nowPlaying.isLoading) return <ActivityRowSkeleton />;
  return <NoActivity />;
};
DiscordActivities.displayName = 'DiscordActivities';
