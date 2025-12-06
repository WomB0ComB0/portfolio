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

import { format } from 'date-fns';
import type { Schema } from 'effect';
import { CalendarIcon, ClockIcon, ExternalLinkIcon, PlayCircleIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import { type JSX, Suspense } from 'react';
import { SiYoutube } from 'react-icons/si';
import { MagicCard } from '@/components/magicui';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { type YoutubeVideoSchema, YoutubeVideosSchema } from '@/hooks/sanity/schemas';
import { DataLoader } from '@/providers/server/effect-data-loader';

/**
 * @function VideosSection
 * @description
 *   Renders the YouTube videos section for the media page.
 *   All videos open in new tabs on YouTube - no iframe embeds.
 * @returns {JSX.Element} The videos section component.
 * @web
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 */
export const VideosSection = (): JSX.Element => {
  return (
    <Suspense fallback={<VideosSkeleton />}>
      <DataLoader
        url="/api/v1/sanity/videos"
        schema={YoutubeVideosSchema}
        staleTime={1000 * 60 * 5}
        refetchInterval={1000 * 60 * 5}
        refetchOnWindowFocus={false}
        ErrorComponent={VideosErrorMessage}
      >
        {(data: Schema.Schema.Type<typeof YoutubeVideosSchema>) =>
          data.length === 0 ? (
            <EmptyState message="No videos available yet." />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {data.map((video: Schema.Schema.Type<typeof YoutubeVideoSchema>, index: number) => (
                  <motion.div
                    key={video._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <MagicCard className="h-full transition-shadow hover:shadow-lg">
                      <div className="relative w-full aspect-video mb-4 overflow-hidden rounded-t-lg group">
                        <Image
                          src={`https://img.youtube.com/vi/${video.videoId}/maxresdefault.jpg`}
                          alt={video.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                          <PlayCircleIcon className="w-16 h-16 text-white" />
                        </div>
                        {/* YouTube Badge */}
                        <div className="absolute top-2 left-2">
                          <Badge
                            variant="secondary"
                            className="bg-red-600 text-white border-none flex items-center gap-1"
                          >
                            <SiYoutube className="w-3 h-3" />
                            YouTube
                          </Badge>
                        </div>
                      </div>
                      <CardHeader>
                        <CardTitle className="line-clamp-2">{video.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4 line-clamp-3">
                          {video.description}
                        </p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {video.tags?.map((tag: string) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center">
                            <CalendarIcon className="w-4 h-4 mr-2" />
                            <span>{format(new Date(video.publishedDate), 'MMM d, yyyy')}</span>
                          </div>
                          {video.duration && (
                            <div className="flex items-center">
                              <ClockIcon className="w-4 h-4 mr-2" />
                              <span>{video.duration}</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-4">
                          <a
                            href={`https://www.youtube.com/watch?v=${video.videoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <ExternalLinkIcon className="w-4 h-4" />
                            Watch on YouTube
                          </a>
                        </div>
                      </CardContent>
                    </MagicCard>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )
        }
      </DataLoader>
    </Suspense>
  );
};

/**
 * Skeleton loader for videos section
 */
const VideosSkeleton = (): JSX.Element => (
  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
    {[...Array(3)].map((_, i) => (
      <MagicCard key={`video-skeleton-${i}`} className="h-full">
        <Card className="h-full">
          <Skeleton className="w-full aspect-video rounded-t-lg" />
          <CardHeader>
            <Skeleton className="h-6 w-11/12" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-5/6 mb-4" />
            <div className="flex gap-2 mb-4">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>
      </MagicCard>
    ))}
  </div>
);

/**
 * Error message component for videos section
 */
const VideosErrorMessage = (): JSX.Element => (
  <Card className="border-destructive/30 bg-destructive/10">
    <CardContent className="flex items-center justify-center p-6">
      <p className="font-semibold text-destructive">
        Failed to load videos. Please try again later.
      </p>
    </CardContent>
  </Card>
);

/**
 * Empty state component
 */
const EmptyState = ({ message }: { message: string }): JSX.Element => (
  <Card className="border-muted">
    <CardContent className="flex items-center justify-center p-12">
      <p className="text-muted-foreground">{message}</p>
    </CardContent>
  </Card>
);

VideosSection.displayName = 'VideosSection';
export default VideosSection;
