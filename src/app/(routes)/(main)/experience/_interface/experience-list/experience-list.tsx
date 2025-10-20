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

'use client';

import { Clipboard, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSanityExperiences } from '@/hooks';
import { urlFor } from '@/lib/sanity/client';
import type { Experience } from '@/lib/sanity/types';
import { formatDatePeriod } from '@/utils';

/**
 * Skeleton loader component for individual experience cards
 */
const ExperienceCardSkeleton = () => {
  return (
    <Card className="bg-card border-border rounded-xl overflow-hidden flex flex-col">
      <CardHeader className="flex flex-row items-start gap-4 p-6">
        {/* Logo skeleton */}
        <div className="flex-shrink-0 w-16 h-16 relative bg-muted animate-pulse rounded-lg ring-1 ring-border" />

        <div className="flex-grow min-w-0 space-y-2">
          {/* Position title skeleton */}
          <div className="h-6 bg-muted animate-pulse rounded w-3/4 mb-2" />
          {/* Company name skeleton */}
          <div className="h-5 bg-muted animate-pulse rounded w-1/2" />
          {/* Date range skeleton */}
          <div className="h-4 bg-muted animate-pulse rounded w-2/5 mt-1" />
          {/* Location skeleton */}
          <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
        </div>
      </CardHeader>

      <CardContent className="p-6 pt-0 flex-grow space-y-2">
        {/* Description skeleton - 3 lines */}
        <div className="h-4 bg-muted animate-pulse rounded w-full" />
        <div className="h-4 bg-muted animate-pulse rounded w-full" />
        <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
      </CardContent>

      <div className="p-6 border-t border-border mt-auto">
        {/* Button skeleton */}
        <div className="h-10 bg-muted animate-pulse rounded w-full" />
      </div>
    </Card>
  );
};

/**
 * Loading state with multiple skeleton cards
 */
const ExperienceListSkeleton = () => {
  return (
    <>
      <header className="mb-12 text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Clipboard className="h-10 w-10 text-primary" />
          <div className="h-10 bg-muted animate-pulse rounded w-64" />
        </div>
        <div className="h-6 bg-muted animate-pulse rounded w-96 mx-auto" />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {[...Array(4)].map((_, i) => (
          <ExperienceCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
};

/**
 * React component for rendering a list of professional experiences.
 * Retrieves and displays information about each experience, structured as cards.
 */
const ExperienceListContent = () => {
  const { data: experiences } = useSanityExperiences();
  const experienceList = experiences as Experience[];

  return (
    <>
      <header className="mb-12 text-center space-y-4">
        <h1 className="text-4xl font-bold text-primary flex items-center justify-center gap-3">
          <Clipboard className="h-10 w-10" />
          My Work Experience
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          A summary of my professional roles and contributions.
        </p>
      </header>

      {experienceList && experienceList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {experienceList.map((item) => {
            const period = formatDatePeriod(item.startDate, item.endDate, item.current);

            return (
              <Card
                key={item._id}
                className="bg-card border-border rounded-xl overflow-hidden flex flex-col hover:shadow-2xl hover:shadow-primary/20 hover:border-primary/50 transition-all duration-300 group"
              >
                <CardHeader className="flex flex-row items-start gap-4 p-6">
                  {item.logo && (
                    <div className="flex-shrink-0 w-16 h-16 relative bg-background rounded-lg overflow-hidden ring-1 ring-border group-hover:ring-primary/50 transition-all duration-300">
                      <Image
                        src={urlFor(item.logo).width(64).height(64).url()}
                        alt={`${item.company} logo`}
                        width={64}
                        height={64}
                        className="rounded-lg object-contain p-2"
                      />
                    </div>
                  )}
                  <div className="flex-grow min-w-0">
                    <CardTitle className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors duration-300">
                      {item.position}
                    </CardTitle>
                    <p className="text-base text-muted-foreground font-medium">{item.company}</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">{period}</p>
                    {item.location && (
                      <p className="text-sm text-muted-foreground/70">{item.location}</p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-6 pt-0 flex-grow">
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {item.description}
                  </p>
                </CardContent>

                <div className="p-6 border-t border-border mt-auto">
                  <Button
                    asChild
                    variant="outline"
                    className="w-full bg-secondary hover:bg-secondary/80 border-border hover:border-primary text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300"
                  >
                    <Link href={`/experience/${item._id}`}>
                      View Details
                      <ExternalLink className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
            <Clipboard className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-xl text-muted-foreground">No work experience listed at the moment.</p>
        </div>
      )}
    </>
  );
};

/**
 * Renders the full experience list page, including header, loading spinner, and all experience cards.
 * Uses Suspense for async loading state.
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