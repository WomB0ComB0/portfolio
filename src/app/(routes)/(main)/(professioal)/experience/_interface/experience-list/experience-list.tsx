'use client';

import { MagicCard, PageHeader } from '@/components';

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

import { ArrowRight, Briefcase, Calendar, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { PaginationControls, usePagination } from '@/app/_components';
import Layout from '@/components/layout/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSanityExperiences } from '@/hooks';
import { urlFor } from '@/lib/sanity/client';
import { formatDatePeriod } from '@/utils';

const ITEMS_PER_PAGE = 6;

/**
 * Skeleton loader for timeline cards
 */
const TimelineCardSkeleton = ({ isLeft }: { isLeft: boolean }) => {
  return (
    <div className="relative mb-12 lg:mb-16">
      <div className="hidden lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-8 lg:items-center">
        <div className={isLeft ? '' : 'opacity-0'}>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 rounded-xl overflow-hidden">
            <div className="relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-muted animate-pulse" />
              <CardHeader className="p-6 pt-8 space-y-3">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-muted animate-pulse rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-6 bg-muted animate-pulse rounded w-3/4" />
                    <div className="h-5 bg-muted animate-pulse rounded w-1/2" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6 space-y-3">
                <div className="h-4 bg-muted animate-pulse rounded w-full" />
                <div className="h-4 bg-muted animate-pulse rounded w-5/6" />
              </CardContent>
            </div>
          </Card>
        </div>

        <div className="flex items-center justify-center">
          <div className="w-5 h-5 rounded-full bg-muted animate-pulse ring-4 ring-background" />
        </div>

        <div className={isLeft ? 'opacity-0' : ''}>
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 rounded-xl overflow-hidden">
            <div className="relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-muted animate-pulse" />
              <CardHeader className="p-6 pt-8 space-y-3">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-muted animate-pulse rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-6 bg-muted animate-pulse rounded w-3/4" />
                    <div className="h-5 bg-muted animate-pulse rounded w-1/2" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6 space-y-3">
                <div className="h-4 bg-muted animate-pulse rounded w-full" />
                <div className="h-4 bg-muted animate-pulse rounded w-5/6" />
              </CardContent>
            </div>
          </Card>
        </div>
      </div>

      <div className="lg:hidden relative pl-8">
        <div className="absolute left-0 top-8 w-5 h-5 rounded-full bg-muted animate-pulse ring-4 ring-background" />
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 rounded-xl overflow-hidden">
          <div className="relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-muted animate-pulse" />
            <CardHeader className="p-6 pt-8 space-y-3">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-muted animate-pulse rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-6 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-5 bg-muted animate-pulse rounded w-1/2" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-3">
              <div className="h-4 bg-muted animate-pulse rounded w-full" />
              <div className="h-4 bg-muted animate-pulse rounded w-5/6" />
            </CardContent>
          </div>
        </Card>
      </div>
    </div>
  );
};

/**
 * Loading state with timeline skeletons
 */
const ExperienceListSkeleton = () => {
  return (
    <div className="space-y-12">
      <PageHeader
        title="Work Experience"
        description="A chronological journey through my professional career"
        icon={<Briefcase />}
      />

      <div className="relative max-w-6xl mx-auto">
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-muted/30 -translate-x-1/2 hidden lg:block" />
        <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-muted/30 lg:hidden" />

        {new Array(4).fill(null).map((_, i) => (
          <TimelineCardSkeleton key={`timeline-skeleton-${+i}`} isLeft={i % 2 === 0} />
        ))}
      </div>
    </div>
  );
};

/**
 * Timeline experience list with alternating layout and pagination
 */
const ExperienceListContent = () => {
  const { data: experiences } = useSanityExperiences();

  const {
    displayedItems: displayedExperiences,
    hasMore,
    isLoadingMore,
    loadMoreRef,
    loadMore,
    displayCount,
  } = usePagination(experiences, { itemsPerPage: ITEMS_PER_PAGE });

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, x: -30 },
    show: {
      opacity: 1,
      x: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 15,
      },
    },
  } as const;

  const itemVariantsRight = {
    hidden: { opacity: 0, x: 30 },
    show: {
      opacity: 1,
      x: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 15,
      },
    },
  } as const;

  return (
    <div className="space-y-12">
      <PageHeader
        title="Work Experience"
        description="A chronological journey through my professional career"
        icon={<Briefcase />}
      />

      {displayedExperiences.length > 0 ? (
        <div className="relative max-w-6xl mx-auto">
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-linear-to-b from-primary/50 via-primary to-primary/20 -translate-x-1/2 hidden lg:block" />
          <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-linear-to-b from-primary/50 via-primary to-primary/20 lg:hidden" />

          <motion.div
            key={displayCount}
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-12 lg:space-y-16"
          >
            {displayedExperiences.map((item, index) => {
              const period = formatDatePeriod(item.startDate, item.endDate, item.current);
              const isCurrent = item.current;
              const isLeft = index % 2 === 0;

              return (
                <div key={item._id} className="relative">
                  <div className="hidden lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-8 lg:items-center">
                    <motion.div
                      variants={isLeft ? itemVariants : itemVariantsRight}
                      className={isLeft ? '' : 'opacity-0 pointer-events-none'}
                    >
                      {isLeft && <TimelineCard item={item} period={period} />}
                    </motion.div>

                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: index * 0.15, type: 'spring' as const }}
                      className="flex items-center justify-center relative z-10"
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-4 border-background ${isCurrent ? 'bg-primary shadow-lg shadow-primary/50 animate-pulse' : 'bg-primary/70'} ring-2 ring-primary/30`}
                      />
                      {isCurrent && (
                        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                      )}
                    </motion.div>

                    <motion.div
                      variants={isLeft ? itemVariantsRight : itemVariants}
                      className={isLeft ? 'opacity-0 pointer-events-none' : ''}
                    >
                      {!isLeft && <TimelineCard item={item} period={period} />}
                    </motion.div>
                  </div>

                  <motion.div variants={itemVariants} className="lg:hidden relative pl-8">
                    <div className="absolute left-0 top-8">
                      <div
                        className={`w-5 h-5 rounded-full border-4 border-background ${isCurrent ? 'bg-primary shadow-lg shadow-primary/50 animate-pulse' : 'bg-primary/70'} ring-2 ring-primary/30`}
                      />
                      {isCurrent && (
                        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                      )}
                    </div>
                    <TimelineCard item={item} period={period} />
                  </motion.div>
                </div>
              );
            })}
          </motion.div>

          {/* Infinite scroll trigger and load more button */}
          <PaginationControls
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            loadMoreRef={loadMoreRef}
            onLoadMore={loadMore}
            loadingText="Loading more experiences..."
            buttonText="Load More Experiences"
          />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center py-20"
        >
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-muted/50 mb-6">
            <Briefcase className="h-12 w-12 text-muted-foreground" />
          </div>
          <p className="text-xl text-muted-foreground">No work experience listed at the moment.</p>
        </motion.div>
      )}
    </div>
  );
};

/**
 * Reusable timeline card component
 */
const TimelineCard = ({
  item,
  period,
}: {
  item: ReturnType<typeof useSanityExperiences>['data'][number];
  period: string;
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ type: 'spring' as const, stiffness: 300, damping: 20 }}
    >
      <MagicCard className="relative backdrop-blur-sm border-border/50 rounded-xl overflow-hidden group hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300">
        <CardHeader className="p-6 pt-8">
          <div className="flex items-start gap-4">
            {item.logo && (
              <motion.div
                whileHover={{ rotate: [0, -5, 5, -5, 0], scale: 1.05 }}
                transition={{ duration: 0.5 }}
                className="shrink-0 w-14 h-14 relative bg-background rounded-xl overflow-hidden ring-2 ring-border/50 group-hover:ring-primary/50 transition-all duration-300 shadow-md"
              >
                <Image
                  src={urlFor(item.logo).width(56).height(56).url()}
                  alt={`${item.company} logo`}
                  width={56}
                  height={56}
                  className="rounded-xl object-contain p-2"
                />
              </motion.div>
            )}

            <div className="grow min-w-0 space-y-2">
              <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors duration-300 leading-tight">
                {item.position}
              </CardTitle>
              <p className="text-base text-muted-foreground font-medium group-hover:text-foreground transition-colors duration-300">
                {item.company}
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                <Badge
                  variant="outline"
                  className="text-xs bg-secondary/50 border-border/50 text-secondary-foreground flex items-center gap-1"
                >
                  <Calendar className="h-3 w-3" />
                  {period}
                </Badge>
                {item.location && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-secondary/50 border-border/50 text-secondary-foreground flex items-center gap-1"
                  >
                    <MapPin className="h-3 w-3" />
                    {item.location}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {item.description}
          </p>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full bg-secondary/50 hover:bg-primary border-border/50 hover:border-primary text-secondary-foreground hover:text-primary-foreground transition-all duration-300 group/btn"
          >
            <Link href={`/experience/${item._id}`}>
              <span className="flex items-center justify-center gap-2">
                View Details
                <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform duration-300" />
              </span>
            </Link>
          </Button>
        </CardContent>
      </MagicCard>
    </motion.div>
  );
};

/**
 * Main experience list component with timeline layout and pagination
 */
export const ExperienceList = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <Suspense fallback={<ExperienceListSkeleton />}>
          <ExperienceListContent />
        </Suspense>
      </div>
    </Layout>
  );
};
ExperienceList.displayName = 'ExperienceList';
export default ExperienceList;
