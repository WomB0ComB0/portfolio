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

import { CalendarIcon, ClockIcon, ExternalLinkIcon } from 'lucide-react';
import Image from 'next/image';
import type { JSX } from 'react';
import { SiYoutube } from 'react-icons/si';
import type { ListedVideo } from '@/app/(routes)/(dev)/media/_lib/load-media';
import { MagicCard } from '@/components/magicui/magic-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/utils/date';

const VIDEO_SKELETON_CARDS = 3;

interface VideoCardProps {
  readonly video: ListedVideo;
  /** The panel's first thumbnail: its likely LCP element, so it loads at once and first. */
  readonly isFirstImage: boolean;
}

const VideoThumbnail = ({ video, isFirstImage }: VideoCardProps): JSX.Element => (
  <div className="relative w-full aspect-video overflow-hidden bg-muted group shrink-0">
    <Image
      src={`https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`}
      alt={video.title}
      fill
      className="object-cover transition-transform duration-500 group-hover:scale-105"
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      unoptimized
      loading={isFirstImage ? 'eager' : 'lazy'}
      fetchPriority={isFirstImage ? 'high' : undefined}
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
);

const VideoCard = ({ video, isFirstImage }: VideoCardProps): JSX.Element => (
  <div className="h-full w-full">
    <MagicCard className="h-full transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border border-border/50 hover:border-primary/30 overflow-hidden">
      <div className="flex flex-col h-full">
        <VideoThumbnail video={video} isFirstImage={isFirstImage} />
        <CardHeader className="pb-4 grow">
          <CardTitle className="line-clamp-2 text-xl leading-snug">{video.title}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 mt-auto">
          <p className="text-muted-foreground mb-6 line-clamp-3 leading-relaxed">
            {video.description}
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {video.tags?.map((tag) => (
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
          <div className="border-t border-border/30 pt-5 mt-auto">
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
      </div>
    </MagicCard>
  </div>
);

export interface VideosSectionProps {
  /** Exactly what loadVideos() listed: Sanity's videos and the channel's uploads, no fillers. */
  readonly items: readonly ListedVideo[];
}

/**
 * @function VideosSection
 * @description
 *   Renders the YouTube videos section for the media page, on the server from the list the page
 *   loaded. All videos open in new tabs on YouTube - no iframe embeds.
 * @returns {JSX.Element} The videos section component.
 * @web
 * @public
 * @author Mike Odnis
 * @version 2.0.0
 */
export const VideosSection = ({ items }: VideosSectionProps): JSX.Element =>
  items.length === 0 ? (
    <EmptyState message="No videos available yet." />
  ) : (
    <div className="grid gap-6 sm:gap-8 grid-cols-[repeat(auto-fit,minmax(280px,1fr))] justify-center">
      {items.map((video, index) => (
        <VideoCard key={video._id} video={video} isFirstImage={index === 0} />
      ))}
    </div>
  );

/**
 * Skeleton loader for videos section
 */
export const VideosSkeleton = (): JSX.Element => (
  <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: VIDEO_SKELETON_CARDS }, (_, i) => (
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
