
'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { DataLoader } from '@/providers/server/effect-data-loader';
import { Schema } from 'effect';
import { motion } from 'motion/react';
import Image from 'next/image';
import { Suspense } from 'react';

/**
 * @readonly
 * @const
 * @public
 * @description Schema for an individual top track from Spotify.
 * @author Mike Odnis
 * @see https://effect-ts.github.io/docs/
 * @version 1.0.0
 */
const TrackSchema = Schema.Struct({
  name: Schema.String,
  artist: Schema.String,
  url: Schema.String,
  imageUrl: Schema.String,
});

/**
 * @readonly
 * @const
 * @public
 * @description Schema for Spotify top tracks API response, as an array of tracks.
 * @author Mike Odnis
 * @see https://effect-ts.github.io/docs/
 * @version 1.0.0
 */
const TopTracksResponseSchema = Schema.Array(TrackSchema);

/**
 * @function TopTracksSkeleton
 * @public
 * @description Skeleton loading component for top tracks list while data loads.
 * @returns {JSX.Element} Skeleton loading placeholders for track cards.
 * @author Mike Odnis
 * @see Skeleton
 * @version 1.0.0
 * @web
 */
const TopTracksSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {[...Array(12)].map((_, index) => (
      <div key={index} className="flex items-center space-x-4 p-3 bg-purple-700/50 rounded-lg">
        <Skeleton className="w-16 h-16 rounded-md bg-purple-600/50" />
        <div className="flex-grow space-y-2">
          <Skeleton className="h-5 w-3/4 bg-purple-600/50" />
          <Skeleton className="h-4 w-1/2 bg-purple-600/50" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * @function TopTracksError
 * @public
 * @description Error component shown when loading top tracks fails.
 * @returns {JSX.Element} UI message for error state.
 * @author Mike Odnis
 * @version 1.0.0
 * @web
 */
const TopTracksError = () => (
  <div className="text-red-400 bg-red-900/20 p-4 rounded-lg text-center">
    Failed to load top tracks. Please try again later.
  </div>
);

/**
 * @function TopTracks
 * @public
 * @description Renders the Top Tracks component, which displays the user's most played Spotify tracks in the last 4 weeks.
 * Fetches data from the `/api/v1/top-tracks` endpoint and renders responsive, interactive track cards.
 * Handles loading and error states gracefully.
 * @returns {JSX.Element} Top tracks card UI with track info and images.
 * @throws {Error} If the data fetching encounters unrecoverable errors (shown in the UI).
 * @author Mike Odnis
 * @see DataLoader
 * @see https://github.com/WomB0ComB0/portfolio
 * @version 1.0.0
 * @example
 * // Usage in a React component
 * <TopTracks />
 * @web
 */
export default function TopTracks() {
  return (
    <div className="bg-gradient-to-b from-purple-800 to-purple-900 rounded-2xl shadow-2xl p-6">
      <h2 className="text-3xl font-bold text-white mb-2 text-center">Top Tracks</h2>
      <p className="text-purple-200 mb-6 text-center">My most played tracks in the last 4 weeks.</p>
      <Suspense fallback={<TopTracksSkeleton />}>
        <DataLoader
          url="/api/v1/top-tracks"
          schema={TopTracksResponseSchema}
          staleTime={1000 * 60 * 60}
          refetchInterval={1000 * 60 * 60}
          refetchOnWindowFocus={false}
          ErrorComponent={TopTracksError}
          LoadingComponent={<TopTracksSkeleton />}
        >
          {(data: Schema.Schema.Type<typeof TopTracksResponseSchema>) => (
            <>
              {data.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.map((track: Schema.Schema.Type<typeof TrackSchema>, index: number) => (
                    /**
                     * @private
                     * @description Animates and displays an individual top track card.
                     * @param {Schema.Schema.Type<typeof TrackSchema>} track - Top track info, including name, artist, url, and image.
                     * @param {number} index - Index for animation transition delay.
                     * @returns {JSX.Element}
                     * @author Mike Odnis
                     * @web
                     */
                    <motion.div
                      key={index}
                      className="flex items-center space-x-4 bg-purple-800/60 rounded-lg p-3 cursor-pointer hover:bg-purple-700/70 transition-all duration-300"
                      onClick={() => window.open(track.url, '_blank')}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Image
                        src={track.imageUrl}
                        alt={track.name}
                        className="w-16 h-16 rounded-md shadow-md"
                        width={64}
                        height={64}
                      />
                      <div className="flex-grow overflow-hidden">
                        <p className="text-white font-semibold truncate">{track.name}</p>
                        <p className="text-purple-300 text-sm truncate">{track.artist}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-purple-200 text-center">
                  No top tracks data available at the moment.
                </p>
              )}
            </>
          )}
        </DataLoader>
      </Suspense>
    </div>
  );
}

