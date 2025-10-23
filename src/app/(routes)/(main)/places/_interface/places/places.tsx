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

"use client";

import Link from "next/link";
import { useMemo } from "react";
import { FiExternalLink, FiImage, FiMapPin } from "react-icons/fi";
import { GoogleMaps } from "@/app/(routes)/(main)/places/_components";
import Layout from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlaces } from "@/hooks/sanity/use-sanity-query";
import { urlFor } from "@/lib/sanity/client";
import type { SanityImage } from "@/lib/sanity/types";
import type { PlaceItem } from "@/types/places";

/**
 * Helper function to convert Sanity Place to PlaceItem
 */
const convertSanityPlaceToPlaceItem = (sanityPlace: any): PlaceItem => {
  return {
    id: sanityPlace._id,
    name: sanityPlace.name,
    description: sanityPlace.description,
    latitude: sanityPlace.latitude,
    longitude: sanityPlace.longitude,
    category: sanityPlace.category || "Uncategorized",
    photos: (sanityPlace.photos || []).map((photo: SanityImage) => ({
      url: urlFor(photo).width(800).height(600).url() || "",
      caption: (photo as any).caption || "",
    })),
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
          {[...Array(6)].map((_, i) => (
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
  const { data: sanityPlaces, isLoading, error } = usePlaces();

  const places = useMemo(() => {
    if (!sanityPlaces) return [];
    return sanityPlaces.map(convertSanityPlaceToPlaceItem);
  }, [sanityPlaces]);

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
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
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
        {/* Header Section */}
        <div className="w-full max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FiMapPin className="text-3xl text-primary" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
                  Places
                </h1>
                <p className="text-muted-foreground mt-1">
                  {places.length}{" "}
                  {places.length === 1 ? "location" : "locations"} found
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Map Section */}
        <div className="w-full max-w-7xl mx-auto">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 overflow-hidden shadow-xl rounded-2xl">
            <CardContent className="p-0">
              <div className="w-full h-[400px] md:h-[500px] relative">
                <GoogleMaps placesToDisplay={places} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cards Grid Section */}
        <div className="w-full max-w-7xl mx-auto">
          {places.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {places.map((place) => (
                <Card
                  key={place.id}
                  className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group flex flex-col"
                >
                  <CardHeader className="pb-4 flex-1">
                    <Link
                      href={`https://maps.google.com/?q=${place.latitude},${place.longitude}`}
                      target="_blank"
                      className="w-full block group/link"
                      rel="noopener noreferrer"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <CardTitle className="text-xl text-foreground group-hover/link:text-primary transition-colors flex items-center gap-2.5">
                          <FiMapPin className="h-5 w-5 flex-shrink-0" />
                          {place.name}
                        </CardTitle>
                        <FiExternalLink className="h-5 w-5 text-muted-foreground group-hover/link:text-primary flex-shrink-0 mt-0.5 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                      </div>
                      <CardDescription className="text-muted-foreground leading-relaxed mb-4">
                        {place.description}
                      </CardDescription>
                      <div className="inline-block">
                        <span className="text-xs font-semibold px-3 py-1.5 bg-primary/10 text-primary rounded-full border border-primary/20">
                          {place.category}
                        </span>
                      </div>
                    </Link>
                  </CardHeader>
                  {place.photos && place.photos.length > 0 && (
                    <CardContent className="pt-0 pb-5 px-6">
                      <Link
                        href={`/places/${place.id}`}
                        className="w-full px-4 py-2.5 rounded-xl border border-border/50 bg-secondary/50 hover:bg-secondary hover:border-primary/30 text-foreground transition-all duration-300 flex items-center justify-center gap-2.5 text-sm font-medium"
                      >
                        <FiImage className="h-4 w-4" />
                        View Photos ({place.photos.length})
                      </Link>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardContent className="py-20">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-muted/50">
                    <FiMapPin className="text-3xl text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-foreground font-medium">
                      No places found
                    </p>
                    <p className="text-muted-foreground text-sm">
                      There are currently no locations to display.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
};
Places.displayName = "Places";
export default Places;
