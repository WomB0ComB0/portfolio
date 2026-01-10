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

import { GoogleMaps } from '@/app/(routes)/(main)/(personal)/places/_components';
import { PaginationControls, usePagination } from '@/app/_components';
import { MagicCard, PageHeader } from '@/components';
import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Place } from '@/hooks/sanity/schemas';
import { useSanityPlaces } from '@/hooks/sanity/use-sanity-suspense';
import { urlFor } from '@/lib/sanity/client';
import type { PhotoItem, PlaceItem } from '@/types/places';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useMemo } from 'react';
import { FiExternalLink, FiImage, FiMapPin } from 'react-icons/fi';

const ITEMS_PER_PAGE = 9;

/**
 * Converts a Sanity Place document to a PlaceItem for display
 */
const convertSanityPlaceToPlaceItem = (sanityPlace: Place): PlaceItem => {
  const photos: PhotoItem[] =
    sanityPlace.photos?.map((photo) => ({
      url: urlFor(photo).width(800).height(600).url(),
      caption: photo.caption,
    })) || [];

  return {
    id: sanityPlace._id,
    name: sanityPlace.name,
    description: sanityPlace.description,
    latitude: sanityPlace.latitude,
    longitude: sanityPlace.longitude,
    category: sanityPlace.category,
    photos,
  };
};

/**
 * Skeleton loader for place cards
 */
const PlaceCardSkeleton = () => (
  <Card className="bg-card/50 backdrop-blur-sm border-border/50">
    <CardHeader className="pb-3">
      <div className="flex items-start gap-2 mb-3">
        <Skeleton className="h-5 w-5 bg-muted/50 rounded" />
        <Skeleton className="h-6 w-3/4 bg-muted/50" />
      </div>
      <Skeleton className="h-4 w-full bg-muted/50 mb-2" />
      <Skeleton className="h-4 w-2/3 bg-muted/50 mb-4" />
      <Skeleton className="h-6 w-28 bg-muted/50 rounded-full" />
    </CardHeader>
  </Card>
);

/**
 * Loading state component
 */
const LoadingState = () => (
  <Layout>
    <div className="w-full min-h-screen p-4 sm:p-6 md:p-12 space-y-8">
      <div className="w-full max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-2xl bg-muted/50" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-32 sm:h-10 sm:w-40 bg-muted/50" />
              <Skeleton className="h-5 w-32 bg-muted/50" />
            </div>
          </div>
        </div>
      </div>
      <div className="w-full max-w-7xl mx-auto">
        <Skeleton className="w-full h-[400px] md:h-[500px] bg-muted/50 rounded-2xl" />
      </div>
      <div className="w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {new Array(6).fill(null).map((_, i) => (
            <PlaceCardSkeleton key={`${+i}`} />
          ))}
        </div>
      </div>
    </div>
  </Layout>
);

/**
 * Places page component with interactive list and map
 */
export const Places = () => {
  const { data: sanityPlaces, isLoading, error } = useSanityPlaces();

  const places: PlaceItem[] = useMemo(() => {
    if (!sanityPlaces) return [];
    return sanityPlaces.map(convertSanityPlaceToPlaceItem);
  }, [sanityPlaces]);

  const {
    displayedItems: displayedPlaces,
    hasMore,
    isLoadingMore,
    loadMoreRef,
    loadMore,
    displayCount,
    totalCount,
  } = usePagination(places, { itemsPerPage: ITEMS_PER_PAGE });

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 15,
      },
    },
  };

  if (isLoading) return <LoadingState />;

  if (error) {
    return (
      <Layout>
        <div className="w-full min-h-screen p-8 flex items-center justify-center">
          <Card className="max-w-md mx-auto bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="py-16 px-8 text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-destructive/10">
                <FiMapPin className="text-4xl text-destructive" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-xl">Unable to Load Places</CardTitle>
                <CardDescription>
                  Failed to fetch places data. Please try again later.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => globalThis.location.reload()}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full min-h-screen p-4 sm:p-6 md:p-12 space-y-8">
        <div className="w-full max-w-7xl mx-auto">
          <PageHeader
            title="Places I've Visited"
            description={`${totalCount} ${totalCount === 1 ? 'location' : 'locations'} visited`}
            icon={<FiMapPin />}
          />
        </div>

        <div className="w-full max-w-7xl mx-auto">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 overflow-hidden shadow-xl rounded-2xl">
            <CardContent className="p-0">
              <div className="w-full h-[400px] md:h-[500px] relative">
                <GoogleMaps placesToDisplay={places} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="w-full max-w-7xl mx-auto">
          {displayedPlaces.length > 0 ? (
            <>
              <motion.div
                key={displayCount}
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {displayedPlaces.map((place: PlaceItem) => (
                  <motion.div key={place.id} variants={itemVariants} className="h-full">
                    <MagicCard className="backdrop-blur-sm border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group h-full flex flex-col">
                      <CardHeader className="pb-4 grow">
                        <Link
                          href={`https://maps.google.com/?q=${place.latitude},${place.longitude}`}
                          target="_blank"
                          className="w-full block group/link"
                          rel="noopener noreferrer"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <CardTitle className="text-lg text-foreground group-hover/link:text-primary transition-colors flex items-center gap-2">
                              <FiMapPin className="h-4 w-4 shrink-0" />
                              <span className="line-clamp-1">{place.name}</span>
                            </CardTitle>
                            <FiExternalLink className="h-4 w-4 text-muted-foreground group-hover/link:text-primary shrink-0 mt-0.5 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                          </div>
                          <CardDescription className="text-sm text-muted-foreground leading-snug mb-3 line-clamp-2">
                            {place.description}
                          </CardDescription>
                          <div className="inline-block">
                            <span className="text-xs font-semibold px-2.5 py-1 bg-primary/10 text-primary rounded-full border border-primary/20">
                              {place.category}
                            </span>
                          </div>
                        </Link>
                      </CardHeader>
                      <CardContent className="pt-0 pb-5 px-6 mt-auto">
                        {place.photos && place.photos.length > 0 ? (
                          <Link
                            href={`/places/${place.id}`}
                            className="w-full px-4 py-2.5 rounded-xl border border-border/50 bg-secondary/50 hover:bg-secondary hover:border-primary/30 text-foreground transition-all duration-300 flex items-center justify-center gap-2.5 text-sm font-medium"
                          >
                            <FiImage className="h-4 w-4" />
                            View Photos ({place.photos.length})
                          </Link>
                        ) : (
                          <div className="h-[42px]" />
                        )}
                      </CardContent>
                    </MagicCard>
                  </motion.div>
                ))}
              </motion.div>

              {/* Infinite scroll trigger and load more button */}
              <PaginationControls
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                loadMoreRef={loadMoreRef}
                onLoadMore={loadMore}
                loadingText="Loading more places..."
                buttonText="Load More Places"
              />
            </>
          ) : (
            <MagicCard className="backdrop-blur-sm border-border/50">
              <CardContent className="py-20">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-muted/50">
                    <FiMapPin className="text-3xl text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-foreground font-medium">No places found</p>
                    <p className="text-muted-foreground text-sm">
                      There are currently no locations to display.
                    </p>
                  </div>
                </div>
              </CardContent>
            </MagicCard>
          )}
        </div>
      </div>
    </Layout>
  );
};
Places.displayName = 'Places';
export default Places;
