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

import { Schema } from 'effect';
import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { SiSpotify } from 'react-icons/si';
import { MagicCard } from '@/components';
import { CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataLoader } from '@/providers/server/effect-data-loader';

/**
 * @typedef {Object} NowPlayingSchemaType
 * @property {boolean} isPlaying - Indicates if a song is currently playing.
 * @property {string} [songName] - The name of the currently or last played song.
 * @property {string} [artistName] - The artist name for the currently or last played song.
 * @property {string} [songURL] - The Spotify URL for the song.
 * @property {string} [imageURL] - The cover image URL for the song or album.
 */

/**
 * Schema definition for Now Playing Spotify data, used for runtime validation.
 *
 * @readonly
 * @type {Schema.Schema<NowPlayingSchemaType>}
 * @constant
 * @see https://effect-ts.github.io/schema for more information about Effect Schema
 * @author Mike Odnis
 * @version 1.0.0
 */
const NowPlayingSchema = Schema.Struct({
  isPlaying: Schema.Boolean,
  songName: Schema.optional(Schema.String),
  artistName: Schema.optional(Schema.String),
  songURL: Schema.optional(Schema.String),
  imageURL: Schema.optional(Schema.String),
});

/**
 * Skeleton loader UI component for the Now Playing card.
 *
 * @function
 * @returns {JSX.Element} Visual skeleton indicating data loading state.
 * @author Mike Odnis
 * @see {@link https://ui.shadcn.com/docs/components/skeleton|Skeleton component documentation}
 * @public
 *
 * @example
 * <NowPlayingSkeleton />
 */
const NowPlayingSkeleton = () => (
  <div className="flex justify-between items-center gap-4 w-full">
    <div className="flex flex-col gap-2 grow">
      <Skeleton className="h-4 w-24 bg-accent/20" />
      <Skeleton className="h-6 w-48 bg-accent/20" />
      <Skeleton className="h-4 w-32 bg-accent/20" />
    </div>
    <Skeleton className="h-20 w-20 rounded-lg bg-accent/20" />
  </div>
);

/**
 * Error state UI component for the Now Playing card when loading fails.
 *
 * @function
 * @returns {JSX.Element} Visual error notification for failed data loading.
 * @author Mike Odnis
 * @public
 *
 * @example
 * <NowPlayingError />
 */
const NowPlayingError = () => (
  <div className="text-destructive-foreground bg-destructive/20 p-4 rounded-lg w-full">
    Failed to load now playing data. Please try again later.
  </div>
);

/**
 * The NowPlaying Spotify component displays the user's current or last played song using the Spotify API.
 * Handles loading and error states with skeletons and fallback messages. Uses Effect Schema for type validation and
 * the DataLoader abstraction for data fetching. Visuals feature rich animated presentation and theme styling.
 *
 * @function
 * @returns {JSX.Element} Card UI with real-time music status, visuals, and Spotify reference.
 * @throws {Error} If the DataLoader fetch fails or schema validation fails.
 * @web
 * @author Mike Odnis
 * @see https://github.com/WomB0ComB0/portfolio
 * @see https://developer.spotify.com/documentation/web-api/
 * @version 1.0.0
 * @public
 *
 * @example
 * <NowPlaying />
 */
export const NowPlaying = () => {
  return (
    <MagicCard className="bg-linear-to-b from-gradient-start to-spotify-gradient-end overflow-hidden">
      <h2 className="sr-only">Now Playing</h2>
      <CardContent className="p-0 bg-linear-to-b from-spotify-gradient-start to-spotify-gradient-end">
        <div className="bg-linear-to-b from-spotify-gradient-start to-spotify-gradient-end p-4 flex justify-between items-center gap-4">
          <DataLoader
            url="/api/v1/now-playing"
            schema={NowPlayingSchema}
            staleTime={1000 * 60 * 60}
            refetchInterval={1000 * 60 * 60}
            refetchOnWindowFocus={false}
            ErrorComponent={NowPlayingError}
            LoadingComponent={<NowPlayingSkeleton />}
          >
            {
              /**
               * The validated and fetched now playing data.
               * @param {NowPlayingSchemaType} data
               */
              (data: Schema.Schema.Type<typeof NowPlayingSchema>) => (
                <>
                  <div className="flex flex-col justify-between gap-2 grow">
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`text-sm ${data.isPlaying ? 'text-success' : 'text-spotify-foreground'}`}
                    >
                      <SiSpotify className="inline-block mr-2 w-4 h-4" />
                      {data.isPlaying ? 'Currently Playing' : 'Last Played'}
                    </motion.p>
                    <div className="flex flex-col gap-1">
                      <Link
                        href={data.songURL ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="text-spotify-foreground hover:text-white transition-colors duration-200 text-lg font-semibold truncate"
                      >
                        {data.songName ?? 'Unknown'}
                      </Link>
                      <Link
                        href={data.songURL?.split('/').slice(0, 5).join('/') ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="text-spotify-foreground/80 hover:text-spotify-foreground transition-colors duration-200 text-sm truncate"
                      >
                        {data.artistName ?? 'Unknown Artist'}
                      </Link>
                    </div>
                  </div>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="h-20 w-20 shrink-0"
                  >
                    {data.imageURL && (
                      <Image
                        className="rounded-lg object-cover shadow-lg"
                        src={data.imageURL}
                        alt={data.songName ?? 'Album cover'}
                        width={80}
                        height={80}
                        priority={false}
                        sizes="(max-width: 768px) 80px, 80px"
                        placeholder="empty"
                      />
                    )}
                  </motion.div>
                </>
              )
            }
          </DataLoader>
        </div>
      </CardContent>
    </MagicCard>
  );
};
NowPlaying.displayName = 'NowPlaying';
export default NowPlaying;
