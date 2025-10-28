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

import { MagicCard } from '@/components';
import { Skeleton } from '@/components/ui/skeleton';
import { DataLoader } from '@/providers/server/effect-data-loader';
import { Schema } from 'effect';
import { motion } from 'motion/react';
import Image from 'next/image';

/**
 * Schema definition for a Spotify artist object.
 *
 * @typedef {Object} ArtistSchema
 * @property {string} name - The display name of the artist.
 * @property {string} url - The Spotify profile URL for the artist.
 * @property {string} imageUrl - The artist's image URL.
 * @readonly
 * @author Mike Odnis
 * @see https://developer.spotify.com/documentation/web-api/reference/get-an-artists-profile
 * @version 1.0.0
 */
const ArtistSchema = Schema.Struct({
  name: Schema.String,
  url: Schema.String,
  imageUrl: Schema.String,
});

/**
 * Schema definition for the response containing the array of top artists.
 *
 * @typedef {ArtistSchema[]} TopArtistsResponseSchema
 * @readonly
 * @author Mike Odnis
 * @see ArtistSchema
 * @version 1.0.0
 */
const TopArtistsResponseSchema = Schema.Array(ArtistSchema);

/**
 * Skeleton loader displayed while the top artists data is loading.
 *
 * @function
 * @returns {JSX.Element} A skeleton placeholder for the top artists grid.
 * @author Mike Odnis
 * @version 1.0.0
 * @example
 * <TopArtistsSkeleton />
 * @web
 * @public
 */
const TopArtistsSkeleton = () => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
    {[...Array(10)].map((_, index) => (
      <div key={index} className="flex flex-col items-center space-y-2">
        <Skeleton className="h-24 w-24 rounded-full bg-muted" />
        <Skeleton className="h-4 w-3/4 bg-muted" />
      </div>
    ))}
  </div>
);

/**
 * Error UI component shown when fetching the top artists fails.
 *
 * @function
 * @returns {JSX.Element} A styled error message indicating failure.
 * @author Mike Odnis
 * @version 1.0.0
 * @example
 * <TopArtistsError />
 * @web
 * @public
 */
const TopArtistsError = () => (
  <div className="text-destructive bg-destructive/20 p-4 rounded-lg text-center">
    Failed to load top artists. Please try again later.
  </div>
);

/**
 * @function TopArtists
 * @description Displays a grid of the user's top artists fetched from the Spotify API for the past 4 weeks.
 * Fetches artist data using a type-safe schema, shows a loader while fetching, and handles error and empty states.
 * The grid is responsive and each artist can be clicked to open their Spotify profile in a new tab.
 *
 * @returns {JSX.Element} The rendered top artists UI containing a title, description, and the grid or states.
 * @throws {Error} If loading or decoding the artist data fails, see DataLoader for thrown errors.
 * @author Mike Odnis
 * @see TopArtistsSkeleton, TopArtistsError, DataLoader, https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 * @web
 * @public
 * @example
 * <TopArtists />
 */
export const TopArtists = () => {
  return (
    <MagicCard className=" rounded-2xl shadow-2xl p-6 overflow-hidden">
      <h2 className="text-3xl font-bold text-foreground mb-2 text-center">Top Artists</h2>
      <p className="text-muted-foreground mb-6 text-center">
        My most played artists in the last 4 weeks.
      </p>
      <DataLoader
        url="/api/v1/top-artists"
        schema={TopArtistsResponseSchema}
        staleTime={1000 * 60 * 60}
        refetchInterval={1000 * 60 * 60}
        refetchOnWindowFocus={false}
        ErrorComponent={TopArtistsError}
        LoadingComponent={<TopArtistsSkeleton />}
      >
        {
          /**
           * @param {ArtistSchema[]} data - Array of top artist objects from the API response.
           */
          (data: Schema.Schema.Type<typeof TopArtistsResponseSchema>) => (
            <>
              {data.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {data.map(
                    /**
                     * Renders an individual artist card, clickable to open the artist's Spotify profile.
                     * @param {ArtistSchema} artist - The artist object.
                     * @param {number} index - The artist's index in the array for animation delay and key.
                     * @returns {JSX.Element} The rendered artist card.
                     */
                    (artist: Schema.Schema.Type<typeof ArtistSchema>, index: number) => (
                      <motion.div
                        key={`${artist.name}-${index}`}
                        className="flex flex-col items-center space-y-3 p-4 backdrop-blur-sm rounded-lg cursor-pointer hover:bg-primary/60 transition-all text-center"
                        onClick={() => window.open(artist.url, '_blank')}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Image
                          src={artist.imageUrl}
                          alt={`Profile picture of ${artist.name}`}
                          className="w-24 h-24 rounded-full shadow-lg border-2 border-primary object-cover"
                          width={96}
                          height={96}
                          priority={false}
                          placeholder="empty"
                          sizes="96px"
                        />
                        <p className="text-foreground font-semibold truncate w-full">
                          {artist.name}
                        </p>
                      </motion.div>
                    ),
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground bg-card/30 p-4 rounded-lg text-center">
                  No top artists data available at the moment.
                </p>
              )}
            </>
          )
        }
      </DataLoader>
    </MagicCard>
  );
};
TopArtists.displayName = 'TopArtists';
export default TopArtists;
