'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import fetcher from '@/lib/fetcher';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { SiDiscord } from 'react-icons/si';

interface LanyardResponse {
  json: {
    discord_status: 'online' | 'idle' | 'dnd' | 'offline';
    discord_user: {
      username: string;
      discriminator: string;
      id: string;
      avatar: string;
    };
    activities?: {
      name: string;
      type: number;
      state?: string;
      details?: string;
    }[];
  };
}

const statusColors = {
  online: 'bg-green-500',
  idle: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-gray-500',
};

const statusMessages = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

export default function Discord() {
  const { data, error, isLoading } = useQuery<string>({
    queryKey: ['lanyard'],
    queryFn: () => fetcher<string>('/api/v1/lanyard'),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });

  const parsedData: LanyardResponse | null = data ? JSON.parse(data) : null;

  if (isLoading) return <Skeleton className="w-full h-[120px] rounded-lg" />;
  if (error)
    return (
      <div className="text-red-500 p-4 bg-red-100 rounded-lg">Failed to load Discord status</div>
    );

  const { discord_status: status, discord_user: user, activities } = parsedData?.json || {};
  const activity = activities?.[0];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-gradient-to-r from-purple-900 to-[#ba9bdd] p-4 flex items-center gap-4"
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="relative">
                  <Image
                    src={`https://cdn.discordapp.com/avatars/${user?.id}/${user?.avatar}.png`}
                    alt={user?.username || 'Discord User'}
                    width={80}
                    height={80}
                    className="rounded-full border-2 border-white"
                  />
                  <div
                    className={`absolute bottom-0 right-0 w-4 h-4 rounded-full ${statusColors[status || 'offline']} border-2 border-white`}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{statusMessages[status || 'offline']}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex-grow">
            <div className="flex items-center gap-2 mb-1">
              <SiDiscord className="w-5 h-5 text-white" />
              <span className="text-lg font-semibold text-white">
                {user?.username}
                {user?.discriminator !== '0' ? `#${user?.discriminator}` : ''}
              </span>
            </div>
            <Badge variant="secondary" className="mb-2">
              {statusMessages[status || 'offline']}
            </Badge>
            <AnimatePresence>
              {activity && (
                <motion.p
                  key={activity.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="text-sm text-purple-100"
                >
                  {activity.type === 0 ? 'Playing' : 'Doing'}: {activity.name}
                  {activity.details && <span className="block text-xs">{activity.details}</span>}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}
