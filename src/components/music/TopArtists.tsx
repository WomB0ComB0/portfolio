'use client';

import { Skeleton } from '@/components/ui/skeleton';
import fetcher from '@/lib/fetcher';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Image from 'next/image';

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
    <div className="bg-gradient-to-br from-purple-900 to-purple-700 rounded-2xl shadow-2xl p-6 overflow-hidden">
      <h2 className="text-3xl font-bold text-white mb-2">Top Artists</h2>
      <p className="text-purple-200 mb-6">according to last 4 weeks</p>
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, index) => (
            <div key={`${index + 1}`} className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-red-400 bg-red-900/20 p-4 rounded-lg">
          Failed to load top artists. Please try again later.
        </div>
      ) : parsedData.length > 0 ? (
        <div className="space-y-3">
          {parsedData.map((artist, index) => (
            <motion.div
              key={`${artist.name}-${index + 1}`}
              className="flex items-center space-x-4 bg-purple-800/30 backdrop-blur-sm rounded-lg p-3 cursor-pointer hover:bg-purple-700/40 transition-all"
              onClick={() => window.open(artist.url, '_blank')}
              whileHover={{ scale: 1.02, x: 5 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Image
                src={artist.imageUrl}
                alt={artist.name}
                className="w-12 h-12 rounded-full shadow-md"
                width={48}
                height={48}
              />
              <p className="text-white font-semibold truncate flex-grow">{artist.name}</p>
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="text-purple-200 bg-purple-800/30 p-4 rounded-lg">
          No top artists data available
        </p>
      )}
    </div>
  );
}
