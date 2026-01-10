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
import {
  CalendarIcon,
  ClockIcon,
  ExternalLinkIcon,
  FileTextIcon,
  PlayCircleIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type JSX, Suspense } from 'react';
import { SiVimeo, SiYoutube } from 'react-icons/si';
import { MagicCard } from '@/components/magicui';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/utils/date';
import { type TalkSchema, TalksSchema } from '@/hooks/sanity/schemas';
import { DataLoader } from '@/providers/server/effect-data-loader';

/**
 * Helper to get the video link with appropriate icon based on format
 */
function getVideoLink(
  talk: Schema.Schema.Type<typeof TalkSchema>,
): { url: string; label: string; platform: 'youtube' | 'vimeo' | 'other' } | null {
  if (!talk.videoUrl) return null;

  const format = talk.videoFormat;

  if (format === 'youtube') {
    return { url: talk.videoUrl, label: 'Watch on YouTube', platform: 'youtube' };
  }
  if (format === 'vimeo') {
    return { url: talk.videoUrl, label: 'Watch on Vimeo', platform: 'vimeo' };
  }
  if (format === 'other' || !format || format === 'none') {
    return { url: talk.videoUrl, label: 'Watch Video', platform: 'other' };
  }

  return null;
}

/**
 * Helper to get the slides link based on format
 */
function getSlidesLink(
  talk: Schema.Schema.Type<typeof TalkSchema>,
): { url: string; label: string; icon: 'pdf' | 'external' } | null {
  const format = talk.slidesFormat;

  // PDF file uploaded to Sanity - use the resolved URL
  if (format === 'pdf' && talk.slidesPdfUrl) {
    return { url: talk.slidesPdfUrl, label: 'View PDF', icon: 'pdf' };
  }

  // External URL
  if (format === 'url' && talk.slidesUrl) {
    return { url: talk.slidesUrl, label: 'View Slides', icon: 'external' };
  }

  // Legacy: If slidesUrl exists but no format specified
  if (talk.slidesUrl && !format) {
    return { url: talk.slidesUrl, label: 'Slides', icon: 'external' };
  }

  return null;
}

/**
 * @function TalksSection
 * @description
 *   Renders the talks section for the media page.
 *   Supports multiple media formats: video links (YouTube, Vimeo), PDF uploads, and external URLs.
 * @returns {JSX.Element} The talks section component.
 * @web
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 */
export const TalksSection = (): JSX.Element => {
  return (
    <Suspense fallback={<TalksSkeleton />}>
      <DataLoader
        url="/api/v1/sanity/talks"
        schema={TalksSchema}
        staleTime={1000 * 60 * 5}
        refetchInterval={1000 * 60 * 5}
        refetchOnWindowFocus={false}
        ErrorComponent={TalksErrorMessage}
      >
        {(data: Schema.Schema.Type<typeof TalksSchema>) =>
          data.length === 0 ? (
            <EmptyState message="No talks available yet." />
          ) : (
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {data.map((talk: Schema.Schema.Type<typeof TalkSchema>, index: number) => {
                  const videoLink = getVideoLink(talk);
                  const slidesLink = getSlidesLink(talk);

                  return (
                    <motion.div
                      key={talk._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    >
                      <MagicCard className="h-full transition-shadow hover:shadow-lg">
                        <CardHeader>
                          <div className="flex items-center gap-2 mb-2">
                            {talk.videoFormat && talk.videoFormat !== 'none' && (
                              <Badge variant="outline" className="text-xs flex items-center gap-1">
                                {talk.videoFormat === 'youtube' && (
                                  <SiYoutube className="w-3 h-3" />
                                )}
                                {talk.videoFormat === 'vimeo' && <SiVimeo className="w-3 h-3" />}
                                {talk.videoFormat === 'other' && (
                                  <PlayCircleIcon className="w-3 h-3" />
                                )}
                                {talk.videoFormat === 'youtube'
                                  ? 'YouTube'
                                  : talk.videoFormat === 'vimeo'
                                    ? 'Vimeo'
                                    : 'Video'}
                              </Badge>
                            )}
                            {talk.slidesFormat && talk.slidesFormat !== 'none' && (
                              <Badge variant="outline" className="text-xs">
                                {talk.slidesFormat === 'pdf' ? 'PDF' : 'Slides'}
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="line-clamp-2">{talk.title}</CardTitle>
                          <p className="text-sm text-muted-foreground">{talk.venue}</p>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground mb-4 line-clamp-3">
                            {talk.description}
                          </p>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {talk.tags?.map((tag: string) => (
                              <Badge key={tag} variant="secondary">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center">
                              <CalendarIcon className="w-4 h-4 mr-2" />
                              <span>{formatDate(talk.date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                            {talk.duration && (
                              <div className="flex items-center">
                                <ClockIcon className="w-4 h-4 mr-2" />
                                <span>{talk.duration}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-3 mt-4 flex-wrap">
                            {videoLink && (
                              <a
                                href={videoLink.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-sm text-primary hover:underline"
                              >
                                {videoLink.platform === 'youtube' && (
                                  <SiYoutube className="w-4 h-4" />
                                )}
                                {videoLink.platform === 'vimeo' && <SiVimeo className="w-4 h-4" />}
                                {videoLink.platform === 'other' && (
                                  <PlayCircleIcon className="w-4 h-4" />
                                )}
                                {videoLink.label}
                              </a>
                            )}
                            {slidesLink && (
                              <a
                                href={slidesLink.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-sm text-primary hover:underline"
                              >
                                {slidesLink.icon === 'pdf' ? (
                                  <FileTextIcon className="w-4 h-4" />
                                ) : (
                                  <ExternalLinkIcon className="w-4 h-4" />
                                )}
                                {slidesLink.label}
                              </a>
                            )}
                          </div>
                        </CardContent>
                      </MagicCard>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )
        }
      </DataLoader>
    </Suspense>
  );
};

/**
 * Skeleton loader for talks section
 */
const TalksSkeleton = (): JSX.Element => (
  <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
    {[...Array(3)].map((_, i) => (
      <MagicCard key={`talk-skeleton-${i}`} className="h-full">
        <Card className="h-full">
          <CardHeader>
            <div className="flex gap-2 mb-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-12" />
            </div>
            <Skeleton className="h-6 w-11/12" />
            <Skeleton className="h-4 w-1/2" />
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
 * Error message component for talks section
 */
const TalksErrorMessage = (): JSX.Element => (
  <Card className="border-destructive/30 bg-destructive/10">
    <CardContent className="flex items-center justify-center p-6">
      <p className="font-semibold text-destructive">
        Failed to load talks. Please try again later.
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

TalksSection.displayName = 'TalksSection';
export default TalksSection;
