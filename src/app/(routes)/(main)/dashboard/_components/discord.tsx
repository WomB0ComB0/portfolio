'use client';

import { Schema } from 'effect';
import { motion } from 'motion/react';
import { Suspense } from 'react';
import { SiDiscord } from 'react-icons/si';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { config } from '@/config';
import { DataLoader } from '@/providers/server/effect-data-loader';

const ActivitySchema = Schema.Struct({
  name: Schema.String,
  type: Schema.Number,
  state: Schema.optional(Schema.String),
  details: Schema.optional(Schema.String),
});

const DiscordUserSchema = Schema.Struct({
  username: Schema.String,
  discriminator: Schema.String,
  id: Schema.String,
  avatar: Schema.String,
});

const LanyardResponseSchema = Schema.Struct({
  discord_status: Schema.Literal('online', 'idle', 'dnd', 'offline'),
  discord_user: DiscordUserSchema,
  activities: Schema.optional(Schema.Array(ActivitySchema)),
});

const statusColors = {
  online: 'bg-green-500',
  idle: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-gray-500',
};

const DiscordSkeleton = () => <Skeleton className="w-full h-[180px] rounded-lg" />;

const DiscordError = () => (
  <div className="text-red-500 p-4 bg-red-100 rounded-lg">Failed to load Discord status</div>
);

export default function Discord() {
  return (
    <Suspense fallback={<DiscordSkeleton />}>
      <DataLoader
        url="/api/v1/lanyard"
        schema={LanyardResponseSchema}
        staleTime={1000 * 60 * 5}
        refetchInterval={1000 * 60 * 5}
        refetchOnWindowFocus={false}
        ErrorComponent={DiscordError}
        LoadingComponent={<DiscordSkeleton />}
      >
        {(data: Schema.Schema.Type<typeof LanyardResponseSchema>) => {
          const { discord_status: status, discord_user: user, activities } = data;
          const activity = activities?.[0];

          const handleAddFriend = () => {
            const discordId = config.discord.id;
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
                          src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
                          alt={user.username || 'Discord User'}
                        />
                        <AvatarFallback>
                          {user.username.slice(0, 2).toUpperCase() || 'DU'}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`absolute bottom-0 right-0 w-4 h-4 rounded-full ${statusColors[status]
                          } border-2 border-purple-900`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <SiDiscord className="w-5 h-5 text-white" />
                        <span className="text-xl font-semibold text-white">
                          {user.username}
                          {user.discriminator !== '0' ? `#${user.discriminator}` : ''}
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
        }}
      </DataLoader>
    </Suspense>
  );
}
