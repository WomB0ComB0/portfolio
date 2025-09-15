'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import fetcher from '@/lib/fetcher';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
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

export default function Discord() {
  const { data, error, isLoading } = useQuery<string>({
    queryKey: ['lanyard'],
    queryFn: () => fetcher<string>('/api/v1/lanyard'),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });

  const parsedData: LanyardResponse | null = data ? JSON.parse(data) : null;

  if (isLoading) return <Skeleton className="w-full h-[180px] rounded-lg" />;
  if (error)
    return (
      <div className="text-red-500 p-4 bg-red-100 rounded-lg">Failed to load Discord status</div>
    );

  const { discord_status: status, discord_user: user, activities } = parsedData?.json || {};
  const activity = activities?.[0];

  const handleAddFriend = () => {
    const discordId = process.env.NEXT_PUBLIC_DISCORD_ID;
    console.log(discordId);
    if (discordId) {
      window.open(`https://discord.com/users/${discordId}`, '_blank');
    } else {
      console.error('Discord ID is not set in environment variables');
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-gradient-to-r from-purple-900 to-purple-600 p-6"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <Avatar className="h-16 w-16 border-2 border-white">
                <AvatarImage
                  className={'m-0 p-0'}
                  src={`https://cdn.discordapp.com/avatars/${user?.id}/${user?.avatar}.png`}
                  alt={user?.username || 'Discord User'}
                />
                <AvatarFallback>{user?.username?.slice(0, 2).toUpperCase() || 'DU'}</AvatarFallback>
              </Avatar>
              <div
                className={`absolute bottom-0 right-0 w-4 h-4 rounded-full ${
                  statusColors[status || 'offline']
                } border-2 border-purple-900`}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <SiDiscord className="w-5 h-5 text-white" />
                <span className="text-xl font-semibold text-white">
                  {user?.username}
                  {user?.discriminator !== '0' ? `#${user?.discriminator}` : ''}
                </span>
              </div>
              <Badge variant="secondary" className="mt-1 bg-purple-700 text-purple-100">
                {status === 'online' ? 'Online' : 'Offline'}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-purple-100 mb-4">
            {activity?.state || 'Coding, building, and growing'}
          </p>
          <Button
            onClick={() => handleAddFriend()}
            className="w-full bg-purple-500 hover:bg-purple-400 text-white"
          >
            Add Friend
          </Button>
        </motion.div>
      </CardContent>
    </Card>
  );
}
