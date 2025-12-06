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
import { CalendarIcon, ExternalLinkIcon, MapPinIcon, PlayCircleIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type JSX, Suspense } from 'react';
import { MagicCard } from '@/components/magicui';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { type PresentationSchema, PresentationsSchema } from '@/hooks/sanity/schemas';
import { DataLoader } from '@/providers/server/effect-data-loader';

/**
 * @function PresentationsSection
 * @description
 *   Renders the presentations section for the media page.
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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {data.map(
                  (presentation: Schema.Schema.Type<typeof PresentationSchema>, index: number) => (
                    <motion.div
                      key={presentation._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    >
                      <MagicCard className="h-full transition-shadow hover:shadow-lg">
                        <CardHeader>
                          <CardTitle className="line-clamp-2">{presentation.title}</CardTitle>
                          <p className="text-sm text-muted-foreground">{presentation.eventName}</p>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground mb-4 line-clamp-3">
                            {presentation.description}
                          </p>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {presentation.tags?.map((tag: string) => (
                              <Badge key={tag} variant="secondary">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center">
                              <CalendarIcon className="w-4 h-4 mr-2" />
                              <span>{format(new Date(presentation.date), 'MMM d, yyyy')}</span>
                            </div>
                            {presentation.location && (
                              <div className="flex items-center">
                                <MapPinIcon className="w-4 h-4 mr-2" />
                                <span>{presentation.location}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 mt-4">
                            {presentation.slidesUrl && (
                              <a
                                href={presentation.slidesUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-sm text-primary hover:underline"
                              >
                                <ExternalLinkIcon className="w-4 h-4" />
                                Slides
                              </a>
                            )}
                            {presentation.videoUrl && (
                              <a
                                href={presentation.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-sm text-primary hover:underline"
                              >
                                <PlayCircleIcon className="w-4 h-4" />
                                Video
                              </a>
                            )}
                          </div>
                        </CardContent>
                      </MagicCard>
                    </motion.div>
                  ),
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
  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
    {[...Array(3)].map((_, i) => (
      <MagicCard key={`presentation-skeleton-${+i}`} className="h-full">
        <Card className="h-full">
          <CardHeader>
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
 * Error message component for presentations section
 */
const PresentationsErrorMessage = (): JSX.Element => (
  <Card className="border-destructive/30 bg-destructive/10">
    <CardContent className="flex items-center justify-center p-6">
      <p className="font-semibold text-destructive">
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
    <CardContent className="flex items-center justify-center p-12">
      <p className="text-muted-foreground">{message}</p>
    </CardContent>
  </Card>
);

PresentationsSection.displayName = 'PresentationsSection';
export default PresentationsSection;
