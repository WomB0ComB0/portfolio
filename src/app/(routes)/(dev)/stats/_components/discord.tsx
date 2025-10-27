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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { config } from '@/config';
import { DataLoader } from '@/providers/server/effect-data-loader';
import { logger } from '@/utils';
import { Schema } from 'effect';
import { motion } from 'motion/react';
import { Suspense } from 'react';
import { SiDiscord } from 'react-icons/si';

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
  online: 'bg-success',
  idle: 'bg-warning',
  dnd: 'bg-destructive',
  offline: 'bg-muted',
} as const;

const DiscordSkeleton = () => (
  <Card className="overflow-hidden">
    <CardContent className="p-0">
      <div className="bg-linear-to-r from-primary to-primary/80 p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            <Skeleton className="h-16 w-16 rounded-full border-2 border-white" />
            <Skeleton className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-background" />
          </div>
          <div className="flex-1">
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-5 w-1/3" />
          </div>
        </div>
        <Skeleton className="h-4 w-full mb-4" />
        <Skeleton className="h-10 w-full" />
      </div>
    </CardContent>
  </Card>
);

const DiscordError = () => (
  <div className="text-destructive p-4 bg-destructive/10 rounded-lg">
    Failed to load Discord status
  </div>
);

export const Discord = () => {
  return (
    <Suspense fallback={<DiscordSkeleton />}>
      <h2 className="sr-only">Discord Status</h2>
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
            if (discordId) {
              window.open(`https://discord.com/users/${discordId}`, '_blank');
            } else {
              logger.error('Discord ID is not set in environment variables');
            }
          };

          return (
            <MagicCard className="overflow-hidden">
              <CardContent className="p-0">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="bg-linear-to-r from-primary to-primary/80 p-6"
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
                        className={`absolute bottom-0 right-0 w-4 h-4 rounded-full ${
                          statusColors[status]
                        } border-2 border-background`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <SiDiscord className="w-5 h-5 text-primary-foreground" />{' '}
                        <span className="text-xl font-semibold text-primary-foreground">
                          {' '}
                          {user.username}
                          {user.discriminator !== '0' ? `#${user.discriminator}` : ''}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className="mt-1 bg-primary/80 text-primary-foreground"
                      >
                        {status === 'online' ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-primary-foreground/90 mb-4">
                    {' '}
                    {activity?.state || 'Coding, building, and growing'}
                  </p>
                  <Button
                    onClick={() => handleAddFriend()}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Add Friend
                  </Button>
                </motion.div>
              </CardContent>
            </MagicCard>
          );
        }}
      </DataLoader>
    </Suspense>
  );
};
Discord.displayName = 'Discord';
export default Discord;
