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

import { Schema } from 'effect';
import { Suspense } from 'react';
import { FiPlus } from 'react-icons/fi';
import { SiDiscord } from 'react-icons/si';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { DataLoader, type DataLoaderErrorProps } from '@/providers/server/effect-data-loader';
import { DiscordActivities } from './discord-activity';
import { ActivitySchema } from './discord-activity.utils';
import { StatCard } from './stat-card';

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

/** The profile page Discord opens for a user id, where visitors can send a friend request. */
const discordProfileUrl = (id: string) => `https://discord.com/users/${encodeURIComponent(id)}`;

const statusInfo = {
  online: { text: 'Online', color: 'bg-green-500', pulse: true },
  idle: { text: 'Idle', color: 'bg-yellow-500', pulse: false },
  dnd: { text: 'Do Not Disturb', color: 'bg-red-500', pulse: false },
  offline: { text: 'Offline', color: 'bg-gray-500', pulse: false },
};

/** The card's placeholder. No entrance, so only the loaded card that replaces it fades in. */
export const DiscordSkeleton = () => (
  <StatCard title="Discord Status" icon={<SiDiscord />} hasEntrance={false}>
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

/**
 * Shown in the card when the first Lanyard load fails. DataLoader keeps the failure inside this
 * card and passes `retry`, which clears the failed query and loads it again.
 */
const DiscordError = ({ retry }: Partial<DataLoaderErrorProps>) => (
  <StatCard title="Discord Status" icon={<SiDiscord />}>
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <p className="text-sm font-semibold text-destructive">Failed to load Discord status.</p>
      {retry && (
        <Button type="button" variant="outline" size="sm" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  </StatCard>
);

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
                      {/* The status is written out beside the avatar, so the dot is decoration. */}
                      <div
                        aria-hidden="true"
                        className={`absolute bottom-0 right-0 w-4 h-4 rounded-full ${
                          statusInfo[status].color
                        } border-2 border-background flex items-center justify-center`}
                      >
                        {statusInfo[status].pulse && (
                          <div
                            className={`w-2 h-2 rounded-full ${statusInfo[status].color} motion-safe:animate-ping`}
                          />
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">
                        {user.username}
                        <span className="text-muted-foreground text-xs sm:text-sm">
                          {user.discriminator !== '0' ? `#${user.discriminator}` : ''}
                        </span>
                      </p>
                      <span
                        className={`text-xs sm:text-sm font-medium ${
                          status === 'offline' ? 'text-muted-foreground' : 'text-primary'
                        }`}
                      >
                        {statusInfo[status].text}
                      </span>
                    </div>
                  </div>
                  {/* text-inherit keeps the colour the button inherited; links default to primary. */}
                  <Button asChild variant="ghost" size="icon" className="w-8 h-8 text-inherit">
                    <a href={discordProfileUrl(user.id)} target="_blank" rel="noopener noreferrer">
                      <FiPlus aria-hidden="true" />
                      <span className="sr-only">Add Friend (opens in a new tab)</span>
                    </a>
                  </Button>
                </div>

                <Separator className="bg-border/30" />

                <div className="min-h-16 flex items-center">
                  <DiscordActivities activities={activities} />
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
