'use client';

import { Skeleton } from '@/components/ui/skeleton';
import fetcher from '@/lib/fetcher';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Image from 'next/image';

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
    <div className="bg-gradient-to-b from-purple-700 to-purple-900 rounded-xl shadow-xl p-6">
      <h2 className="text-3xl font-bold text-white mb-2">Top Tracks</h2>
      <p className="text-purple-200 mb-6">according to last 4 weeks</p>
      <div className="space-y-4">
        {isLoading ? (
          [...Array(5)].map((_, index) => (
            <div
              key={index}
              className="flex items-center space-x-4 bg-purple-800/50 rounded-lg p-3"
            >
              <div className="flex-grow">
                <Skeleton className="h-5 w-3/4 bg-purple-600/50 mb-2" />
                <Skeleton className="h-4 w-1/2 bg-purple-600/50" />
              </div>
              <Skeleton className="w-12 h-12 rounded-md bg-purple-600/50" />
            </div>
          ))
        ) : error ? (
          <div className="text-red-400 bg-red-900/20 p-4 rounded-lg">
            Failed to load top tracks. Please try again later.
          </div>
        ) : parsedData.length > 0 ? (
          parsedData.map((track, index) => (
            <motion.div
              key={index}
              className="flex items-center space-x-4 bg-purple-800/50 rounded-lg p-3 cursor-pointer hover:bg-purple-700/50 transition-colors"
              onClick={() => window.open(track.url, '_blank')}
              whileHover={{ scale: 1.02, x: 5 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex-grow">
                <p className="text-white font-semibold">{track.name}</p>
                <p className="text-purple-300 text-sm">{track.artist}</p>
              </div>
              <Image
                src={track.imageUrl}
                alt={track.name}
                className="w-12 h-12 rounded-md"
                width={48}
                height={48}
              />
            </motion.div>
          ))
        ) : (
          <p className="text-purple-200">No top tracks data available</p>
        )}
      </div>
    </div>
  );
}
