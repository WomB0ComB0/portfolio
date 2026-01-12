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

import type { Schema } from 'effect';
import { CalendarIcon, ClockIcon, ExternalLinkIcon } from 'lucide-react';
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
import { formatDate } from '@/utils/date';

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
            <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {data.map((video: Schema.Schema.Type<typeof YoutubeVideoSchema>, index: number) => (
                  <motion.div
                    key={video._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <MagicCard className="h-full transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border border-border/50 hover:border-primary/30 overflow-hidden">
                      <div className="relative w-full aspect-video overflow-hidden bg-muted group">
                        <Image
                          src={`https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`}
                          alt={video.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          unoptimized
                        />
                        <div className="absolute top-3 left-3">
                          <Badge
                            variant="secondary"
                            className="bg-red-600 hover:bg-red-700 text-white border-none flex items-center gap-1.5 px-3 py-1.5 font-semibold shadow-lg"
                          >
                            <SiYoutube className="w-3.5 h-3.5" />
                            YouTube
                          </Badge>
                        </div>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                          <div className="w-16 h-16 rounded-full bg-red-600/0 group-hover:bg-red-600/90 flex items-center justify-center transition-all duration-300 scale-75 group-hover:scale-100">
                            <div className="w-0 h-0 border-l-16 border-l-white border-y-10 border-y-transparent ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          </div>
                        </div>
                      </div>
                      <CardHeader className="pb-4">
                        <CardTitle className="line-clamp-2 text-xl leading-snug">
                          {video.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-muted-foreground mb-6 line-clamp-3 leading-relaxed">
                          {video.description}
                        </p>
                        <div className="flex flex-wrap gap-2 mb-6">
                          {video.tags?.map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="font-medium">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex flex-col gap-3 text-sm text-muted-foreground mb-6">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 shrink-0" />
                            <span className="font-medium">
                              {formatDate(video.publishedDate, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                          {video.duration && (
                            <div className="flex items-center gap-2">
                              <ClockIcon className="w-4 h-4 shrink-0" />
                              <span className="font-medium">{video.duration}</span>
                            </div>
                          )}
                        </div>
                        <div className="border-t border-border/30 pt-5">
                          <a
                            href={`https://www.youtube.com/watch?v=${video.videoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 hover:underline underline-offset-4 transition-all"
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
  <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
    {new Array(3).fill(null).map((_, i) => (
      <MagicCard key={`video-skeleton-${Number(i)}`} className="h-full">
        <Card className="h-full">
          <Skeleton className="w-full aspect-video" />
          <CardHeader>
            <Skeleton className="h-7 w-11/12 rounded-lg" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full mb-2 rounded-lg" />
            <Skeleton className="h-4 w-full mb-2 rounded-lg" />
            <Skeleton className="h-4 w-5/6 mb-6 rounded-lg" />
            <div className="flex gap-2 mb-6">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-5 w-36 rounded-lg" />
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
  <Card className="border-destructive/40 bg-destructive/5">
    <CardContent className="flex items-center justify-center p-8">
      <p className="font-semibold text-destructive text-center">
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
    <CardContent className="flex items-center justify-center p-16">
      <p className="text-muted-foreground text-center text-lg">{message}</p>
    </CardContent>
  </Card>
);

VideosSection.displayName = 'VideosSection';
export default VideosSection;
