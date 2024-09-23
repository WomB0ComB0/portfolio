'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import fetcher from '@/lib/fetcher';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { SiSpotify } from 'react-icons/si';

interface NowPlayingData {
  isPlaying: boolean;
  songName: string;
  artistName: string;
  songURL: string;
  imageURL: string;
}

export default function NowPlaying() {
  const { data, error, isLoading } = useQuery<NowPlayingData>({
    queryKey: ['nowPlaying'],
    queryFn: () => fetcher<NowPlayingData>('/api/v1/now-playing'),
  });

  return (
    <Card className="bg-gradient-to-br from-purple-900 to-purple-700 overflow-hidden">
      <CardContent className="p-0 bg-gradient-to-br from-purple-900 to-purple-700">
        <div className="bg-gradient-to-br from-purple-900 to-purple-700 p-4 flex justify-between items-center gap-4">
          {isLoading ? (
            <NowPlayingSkeleton />
          ) : error ? (
            <div className="text-red-400 bg-red-900/20 p-4 rounded-lg w-full">
              Failed to load now playing data. Please try again later.
            </div>
          ) : (
            <>
              <div className="flex flex-col justify-between gap-2 flex-grow">
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`text-sm ${data?.isPlaying ? 'text-green-400' : 'text-[#ba9bdd]'}`}
                >
                  <SiSpotify className="inline-block mr-2 w-4 h-4" />
                  {data?.isPlaying ? 'Currently Playing' : 'Last Played'}
                </motion.p>
                <div className="flex flex-col gap-1">
                  <Link
                    href={data?.songURL ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#ba9bdd] hover:text-white transition-colors duration-200 text-lg font-semibold truncate"
                  >
                    {data?.songName}
                  </Link>
                  <Link
                    href={data?.songURL?.split('/').slice(0, 5).join('/') ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#ba9bdd]/80 hover:text-[#ba9bdd] transition-colors duration-200 text-sm truncate"
                  >
                    {data?.artistName}
                  </Link>
                </div>
              </div>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="h-20 w-20 flex-shrink-0"
              >
                {data?.imageURL && (
                  <Image
                    className="rounded-lg object-cover shadow-lg"
                    src={data.imageURL}
                    alt={data.songName}
                    width={80}
                    height={80}
                  />
                )}
              </motion.div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function NowPlayingSkeleton() {
  return (
    <div className="flex justify-between items-center gap-4 w-full">
      <div className="flex flex-col gap-2 flex-grow">
        <Skeleton className="h-4 w-24 bg-[#ba9bdd]/20" />
        <Skeleton className="h-6 w-48 bg-[#ba9bdd]/20" />
        <Skeleton className="h-4 w-32 bg-[#ba9bdd]/20" />
      </div>
      <Skeleton className="h-20 w-20 rounded-lg bg-[#ba9bdd]/20" />
    </div>
  );
}
