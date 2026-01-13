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

import { MagicCard } from '@/components/magicui';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { type PresentationSchema, PresentationsSchema } from '@/hooks/sanity/schemas';
import { DataLoader } from '@/providers/server/effect-data-loader';
import { formatDate } from '@/utils/date';
import type { Schema } from 'effect';
import {
  CalendarIcon,
  ExternalLinkIcon,
  FileTextIcon,
  MapPinIcon,
  PlayCircleIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type JSX, Suspense } from 'react';

/**
 * Helper to get the slides link based on format
 */
function getSlidesLink(
  presentation: Schema.Schema.Type<typeof PresentationSchema>,
): { url: string; label: string; icon: 'pdf' | 'external' } | null {
  const format = presentation.slidesFormat;

  // PDF file uploaded to Sanity - use the resolved URL
  if (format === 'pdf' && presentation.slidesPdfUrl) {
    return { url: presentation.slidesPdfUrl, label: 'View PDF', icon: 'pdf' };
  }

  // External URL formats
  if (format && format !== 'none' && format !== 'pdf' && presentation.slidesUrl) {
    const labels: Record<string, string> = {
      google_slides: 'Google Slides',
      speakerdeck: 'Speaker Deck',
      slideshare: 'SlideShare',
      canva: 'Canva',
      other_url: 'View Slides',
    };
    return {
      url: presentation.slidesUrl,
      label: labels[format] || 'View Slides',
      icon: 'external',
    };
  }

  // Legacy: If slidesUrl exists but no format specified
  if (presentation.slidesUrl && !format) {
    return { url: presentation.slidesUrl, label: 'Slides', icon: 'external' };
  }

  return null;
}

/**
 * @function PresentationsSection
 * @description
 *   Renders the presentations section for the media page.
 *   Supports multiple media formats: PDF uploads, external URLs (Google Slides, etc.), and video links.
 * @returns {JSX.Element} The presentations section component.
 * @web
 * @public
 * @author Mike Odnis
 * @version 1.0.0
 */
export const PresentationsSection = (): JSX.Element => {
  return (
    <Suspense fallback={<PresentationsSkeleton />}>
      <DataLoader
        url="/api/v1/sanity/presentations"
        schema={PresentationsSchema}
        staleTime={1000 * 60 * 5}
        refetchInterval={1000 * 60 * 5}
        refetchOnWindowFocus={false}
        ErrorComponent={PresentationsErrorMessage}
      >
        {(data: Schema.Schema.Type<typeof PresentationsSchema>) =>
          data.length === 0 ? (
            <EmptyState message="No presentations available yet." />
          ) : (
            <div className="grid gap-6 sm:gap-8 grid-cols-[repeat(auto-fit,minmax(280px,1fr))] justify-center">
              <AnimatePresence>
                {data.map(
                  (presentation: Schema.Schema.Type<typeof PresentationSchema>, index: number) => {
                    const slidesLink = getSlidesLink(presentation);

                    return (
                      <motion.div
                        key={presentation._id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="h-full w-full"
                      >
                        <MagicCard className="h-full transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border border-border/50 hover:border-primary/30">
                          <div className="flex flex-col h-full">
                            <CardHeader className="pb-4 grow">
                              <div className="flex items-center gap-2 mb-3">
                                {presentation.slidesFormat &&
                                  presentation.slidesFormat !== 'none' && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs font-semibold capitalize px-3 py-1"
                                    >
                                      {presentation.slidesFormat === 'pdf'
                                        ? 'PDF'
                                        : presentation.slidesFormat.replace('_', ' ')}
                                    </Badge>
                                  )}
                              </div>
                              <CardTitle className="line-clamp-2 text-xl leading-snug">
                                {presentation.title}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground font-medium mt-2">
                                {presentation.eventName}
                              </p>
                            </CardHeader>
                            <CardContent className="pt-0 mt-auto">
                              <p className="text-muted-foreground mb-6 line-clamp-3 leading-relaxed">
                                {presentation.description}
                              </p>
                              <div className="flex flex-wrap gap-2 mb-6">
                                {presentation.tags?.map((tag: string) => (
                                  <Badge key={tag} variant="secondary" className="font-medium">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex flex-col gap-3 text-sm text-muted-foreground mb-6">
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className="w-4 h-4 shrink-0" />
                                  <span className="font-medium">
                                    {formatDate(presentation.date, {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })}
                                  </span>
                                </div>
                                {presentation.location && (
                                  <div className="flex items-center gap-2">
                                    <MapPinIcon className="w-4 h-4 shrink-0" />
                                    <span className="font-medium">{presentation.location}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-4 flex-wrap border-t border-border/30 pt-5 mt-auto">
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
                                {presentation.videoUrl && (
                                  <a
                                    href={presentation.videoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 hover:underline underline-offset-4 transition-all"
                                  >
                                    <PlayCircleIcon className="w-4 h-4" />
                                    Watch Video
                                  </a>
                                )}
                                {presentation.eventUrl && (
                                  <a
                                    href={presentation.eventUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary hover:underline underline-offset-4 transition-all"
                                  >
                                    <ExternalLinkIcon className="w-4 h-4" />
                                    Event Page
                                  </a>
                                )}
                              </div>
                            </CardContent>
                          </div>
                        </MagicCard>
                      </motion.div>
                    );
                  },
                )}
              </AnimatePresence>
            </div>
          )
        }
      </DataLoader>
    </Suspense>
  );
};

/**
 * Skeleton loader for presentations section
 */
const PresentationsSkeleton = (): JSX.Element => (
  <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
    {new Array(3).fill(null).map((_, i) => (
      <MagicCard key={`presentation-skeleton-${Number(i)}`} className="h-full">
        <Card className="h-full">
          <CardHeader>
            <Skeleton className="h-6 w-20 mb-3 rounded-lg" />
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
 * Error message component for presentations section
 */
const PresentationsErrorMessage = (): JSX.Element => (
  <Card className="border-destructive/40 bg-destructive/5">
    <CardContent className="flex items-center justify-center p-8">
      <p className="font-semibold text-destructive text-center">
        Failed to load presentations. Please try again later.
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

PresentationsSection.displayName = 'PresentationsSection';
export default PresentationsSection;
