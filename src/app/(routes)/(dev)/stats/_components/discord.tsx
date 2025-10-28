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

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { config } from '@/config';
import { DataLoader } from '@/providers/server/effect-data-loader';
import { logger } from '@/utils';
import { Schema } from 'effect';
import { Suspense } from 'react';
import { FiActivity, FiHeadphones, FiPlus } from 'react-icons/fi';
import { SiDiscord, SiVscodium } from 'react-icons/si';
import { StatCard } from './stat-card';

const ActivitySchema = Schema.Struct({
  name: Schema.String,
  type: Schema.Number,
  state: Schema.optional(Schema.String),
  details: Schema.optional(Schema.String),
  application_id: Schema.optional(Schema.String),
  assets: Schema.optional(
    Schema.Struct({
      large_image: Schema.optional(Schema.String),
      large_text: Schema.optional(Schema.String),
    }),
  ),
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

const statusInfo = {
  online: { text: 'Online', color: 'bg-green-500', pulse: true },
  idle: { text: 'Idle', color: 'bg-yellow-500', pulse: false },
  dnd: { text: 'Do Not Disturb', color: 'bg-red-500', pulse: false },
  offline: { text: 'Offline', color: 'bg-gray-500', pulse: false },
};

const DiscordSkeleton = () => (
  <StatCard title="Discord Status" icon={<SiDiscord />}>
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-background" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
      <Separator className="bg-border/30" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  </StatCard>
);

const DiscordError = () => (
  <StatCard title="Discord Status" icon={<SiDiscord />}>
    <div className="text-destructive text-center py-4">
      <p className="text-sm font-semibold">Failed to load Discord status.</p>
    </div>
  </StatCard>
);

const ActivityIcon = ({ name }: { name: string }) => {
  if (name.toLowerCase().includes('spotify')) {
    return <FiHeadphones className="h-5 w-5" />;
  }
  if (name.toLowerCase().includes('visual studio code')) {
    return <SiVscodium className="h-5 w-5" />;
  }
  return <FiActivity className="h-5 w-5" />;
};

export const Discord = () => {
  return (
    <Suspense fallback={<DiscordSkeleton />}>
      <DataLoader
        url="/api/v1/lanyard"
        schema={LanyardResponseSchema}
        staleTime={1000 * 30}
        refetchInterval={1000 * 30}
        refetchOnWindowFocus={true}
        ErrorComponent={DiscordError}
        LoadingComponent={<DiscordSkeleton />}
      >
        {(data: Schema.Schema.Type<typeof LanyardResponseSchema>) => {
          const { discord_status: status, discord_user: user, activities } = data;
          const activity = activities?.find((a) => a.type === 0);
          const handleAddFriend = () => {
            const discordId = config.discord.id;
            if (discordId) {
              window.open(`https://discord.com/users/${discordId}`, '_blank');
            } else {
              logger.error('Discord ID is not set in environment variables');
            }
          };

          return (
            <StatCard title="Discord Status" icon={<SiDiscord />}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-12 w-12 border-2 border-border/50">
                        <AvatarImage
                          src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
                          alt={user.username || 'Discord User'}
                        />
                        <AvatarFallback>
                          {user.username.slice(0, 2).toUpperCase() || 'DU'}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`absolute bottom-0 right-0 w-4 h-4 rounded-full ${
                          statusInfo[status].color
                        } border-2 border-background flex items-center justify-center`}
                      >
                        {statusInfo[status].pulse && (
                          <div
                            className={`w-2 h-2 rounded-full ${statusInfo[status].color} animate-ping`}
                          />
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold">
                        {user.username}
                        <span className="text-muted-foreground text-sm">
                          {user.discriminator !== '0' ? `#${user.discriminator}` : ''}
                        </span>
                      </p>
                      <span
                        className={`text-sm font-medium ${
                          status === 'offline' ? 'text-muted-foreground' : 'text-primary'
                        }`}
                      >
                        {statusInfo[status].text}
                      </span>
                    </div>
                  </div>
                  <Button onClick={handleAddFriend} variant="ghost" size="icon" className="w-8 h-8">
                    <FiPlus />
                    <span className="sr-only">Add Friend</span>
                  </Button>
                </div>

                <Separator className="bg-border/30" />

                <div className="min-h-16 flex items-center">
                  {activity ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <ActivityIcon name={activity.name} />
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-semibold text-sm text-foreground">{activity.name}</p>
                        {activity.details && (
                          <p className="text-xs text-muted-foreground">{activity.details}</p>
                        )}
                        {activity.state && (
                          <p className="text-xs text-muted-foreground/80">{activity.state}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center w-full">
                      <p className="text-sm font-medium text-muted-foreground">
                        Currently not in an activity.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </StatCard>
          );
        }}
      </DataLoader>
    </Suspense>
  );
};
Discord.displayName = 'Discord';
export default Discord;
