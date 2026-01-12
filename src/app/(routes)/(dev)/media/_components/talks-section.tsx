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
import { type TalkSchema, TalksSchema } from '@/hooks/sanity/schemas';
import { DataLoader } from '@/providers/server/effect-data-loader';
import { formatDate } from '@/utils/date';

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
            <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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
                      <MagicCard className="h-full transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border border-border/50 hover:border-primary/30">
                        <CardHeader className="pb-4">
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            {talk.videoFormat && talk.videoFormat !== 'none' && (
                              <Badge
                                variant="outline"
                                className="text-xs font-semibold flex items-center gap-1.5 px-3 py-1"
                              >
                                {talk.videoFormat === 'youtube' && (
                                  <SiYoutube className="w-3 h-3" />
                                )}
                                {talk.videoFormat === 'vimeo' && <SiVimeo className="w-3 h-3" />}
                                {talk.videoFormat === 'other' && (
                                  <PlayCircleIcon className="w-3 h-3" />
                                )}
                                {{ youtube: 'YouTube', vimeo: 'Vimeo', other: 'Video' }[
                                  talk.videoFormat
                                ] ?? 'Video'}
                              </Badge>
                            )}
                            {talk.slidesFormat && talk.slidesFormat !== 'none' && (
                              <Badge variant="outline" className="text-xs font-semibold px-3 py-1">
                                {talk.slidesFormat === 'pdf' ? 'PDF' : 'Slides'}
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="line-clamp-2 text-xl leading-snug">
                            {talk.title}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground font-medium mt-2">
                            {talk.venue}
                          </p>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-muted-foreground mb-6 line-clamp-3 leading-relaxed">
                            {talk.description}
                          </p>
                          <div className="flex flex-wrap gap-2 mb-6">
                            {talk.tags?.map((tag: string) => (
                              <Badge key={tag} variant="secondary" className="font-medium">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex flex-col gap-3 text-sm text-muted-foreground mb-6">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="w-4 h-4 shrink-0" />
                              <span className="font-medium">
                                {formatDate(talk.date, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>
                            {talk.duration && (
                              <div className="flex items-center gap-2">
                                <ClockIcon className="w-4 h-4 shrink-0" />
                                <span className="font-medium">{talk.duration}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-4 flex-wrap border-t border-border/30 pt-5">
                            {videoLink && (
                              <a
                                href={videoLink.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 hover:underline underline-offset-4 transition-all"
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
                                className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 hover:underline underline-offset-4 transition-all"
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
  <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
    {new Array(3).fill(null).map((_, i) => (
      <MagicCard key={`talk-skeleton-${Number(i)}`} className="h-full">
        <Card className="h-full">
          <CardHeader>
            <div className="flex gap-2 mb-3">
              <Skeleton className="h-6 w-20 rounded-lg" />
              <Skeleton className="h-6 w-16 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-11/12 rounded-lg" />
            <Skeleton className="h-5 w-1/2 mt-2 rounded-lg" />
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
 * Error message component for talks section
 */
const TalksErrorMessage = (): JSX.Element => (
  <Card className="border-destructive/40 bg-destructive/5">
    <CardContent className="flex items-center justify-center p-8">
      <p className="font-semibold text-destructive text-center">
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
    <CardContent className="flex items-center justify-center p-16">
      <p className="text-muted-foreground text-center text-lg">{message}</p>
    </CardContent>
  </Card>
);

TalksSection.displayName = 'TalksSection';
export default TalksSection;
