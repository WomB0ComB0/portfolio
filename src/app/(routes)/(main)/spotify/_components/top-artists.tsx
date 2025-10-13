'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { fetcher } from '@/lib/';

interface Artist {
  name: string;
  url: string;
  imageUrl: string;
}

interface ApiResponse {
  json: Artist[];
}

export default function TopArtists() {
  const { data, error, isLoading } = useQuery<string>({
    queryKey: ['topArtists'],
    queryFn: () => fetcher<string>('/api/v1/top-artists'),
    staleTime: 1000 * 60 * 60,
    refetchInterval: 1000 * 60 * 60,
  });

  let parsedData: Artist[] = [];
  if (data) {
    try {
      const apiResponse: ApiResponse = JSON.parse(data);
      parsedData = apiResponse.json;
    } catch (e) {
      console.error('Error parsing top artists data:', e);
    }
  }

  return (
    <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
      <h2 className="text-3xl font-bold text-white mb-2 text-center">Top Artists</h2>
      <p className="text-purple-200 mb-6 text-center">
        My most played artists in the last 4 weeks.
      </p>
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(10)].map((_, index) => (
            <div key={index} className="flex flex-col items-center space-y-2">
              <Skeleton className="h-24 w-24 rounded-full bg-purple-700" />
              <Skeleton className="h-4 w-3/4 bg-purple-700" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-red-400 bg-red-900/20 p-4 rounded-lg text-center">
          Failed to load top artists. Please try again later.
        </div>
      ) : parsedData.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {parsedData.map((artist, index) => (
            <motion.div
              key={`${artist.name}-${index}`}
              className="flex flex-col items-center space-y-3 p-4 bg-purple-800/50 backdrop-blur-sm rounded-lg cursor-pointer hover:bg-purple-700/60 transition-all text-center"
              onClick={() => window.open(artist.url, '_blank')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Image
                src={artist.imageUrl}
                alt={artist.name}
                className="w-24 h-24 rounded-full shadow-lg border-2 border-purple-600"
                width={96}
                height={96}
              />
              <p className="text-white font-semibold truncate w-full">{artist.name}</p>
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="text-purple-200 bg-purple-800/30 p-4 rounded-lg text-center">
          No top artists data available at the moment.
        </p>
      )}
    </div>
  );
}
