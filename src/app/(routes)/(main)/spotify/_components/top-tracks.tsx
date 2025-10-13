'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { fetcher } from '@/lib';

interface Track {
  name: string;
  artist: string;
  url: string;
  imageUrl: string;
}

interface ApiResponse {
  json: Track[];
}

export default function TopTracks() {
  const { data, error, isLoading } = useQuery<string>({
    queryKey: ['topTracks'],
    queryFn: () => fetcher<string>('/api/v1/top-tracks'),
    staleTime: 1000 * 60 * 60,
    refetchInterval: 1000 * 60 * 60,
  });

  let parsedData: Track[] = [];
  if (data) {
    try {
      const apiResponse: ApiResponse = JSON.parse(data);
      parsedData = apiResponse.json;
    } catch (e) {
      console.error('Error parsing top tracks data:', e);
    }
  }

  return (
    <div className="bg-gradient-to-b from-purple-800 to-purple-900 rounded-2xl shadow-2xl p-6">
      <h2 className="text-3xl font-bold text-white mb-2 text-center">Top Tracks</h2>
      <p className="text-purple-200 mb-6 text-center">My most played tracks in the last 4 weeks.</p>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(12)].map((_, index) => (
            <div
              key={index}
              className="flex items-center space-x-4 p-3 bg-purple-700/50 rounded-lg"
            >
              <Skeleton className="w-16 h-16 rounded-md bg-purple-600/50" />
              <div className="flex-grow space-y-2">
                <Skeleton className="h-5 w-3/4 bg-purple-600/50" />
                <Skeleton className="h-4 w-1/2 bg-purple-600/50" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-red-400 bg-red-900/20 p-4 rounded-lg text-center">
          Failed to load top tracks. Please try again later.
        </div>
      ) : parsedData.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {parsedData.map((track, index) => (
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
        <p className="text-purple-200 text-center">No top tracks data available at the moment.</p>
      )}
    </div>
  );
}
