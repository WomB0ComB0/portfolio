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

import { ArrowLeft, Calendar, Clipboard, ExternalLink, MapPin } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { type JSX, Suspense } from 'react';
import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import { useSanityExperiences } from '@/hooks';
import { urlFor } from '@/lib/sanity/client';
import { formatDatePeriod } from '@/utils';

/**
 * Interface representing the route parameters for the ExperienceDetail component.
 */
interface ExperienceDetailProps {
  params: { id: string };
}

/**
 * Skeleton loader for experience detail page
 */
const ExperienceDetailSkeleton = () => {
  return (
    <section className="w-full max-w-4xl mx-auto bg-card border border-border rounded-xl overflow-hidden shadow-lg">
      <article className="p-6 md:p-10 space-y-8">
        {/* Header section skeleton */}
        <div className="flex flex-col sm:flex-row items-start gap-6 pb-8 border-b border-border">
          {/* Logo skeleton */}
          <div className="flex-shrink-0 w-24 h-24 bg-muted animate-pulse rounded-lg ring-2 ring-border p-2" />

          <div className="flex-grow space-y-3 w-full">
            {/* Position title skeleton */}
            <div className="h-8 bg-muted animate-pulse rounded w-3/4" />
            {/* Company name skeleton */}
            <div className="h-6 bg-muted animate-pulse rounded w-1/2" />

            {/* Meta info skeleton */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 bg-muted animate-pulse rounded-full" />
                <div className="h-4 bg-muted animate-pulse rounded w-2/5" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 bg-muted animate-pulse rounded-full" />
                <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 bg-muted animate-pulse rounded-full" />
                <div className="h-4 bg-muted animate-pulse rounded w-2/5" />
              </div>
            </div>
          </div>
        </div>

        {/* Description skeleton */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-1 w-8 bg-muted animate-pulse rounded" />
            <div className="h-6 bg-muted animate-pulse rounded w-1/4" />
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-muted animate-pulse rounded w-full" />
            <div className="h-4 bg-muted animate-pulse rounded w-full" />
            <div className="h-4 bg-muted animate-pulse rounded w-4/5" />
          </div>
        </div>

        {/* Responsibilities skeleton */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-1 w-8 bg-muted animate-pulse rounded" />
            <div className="h-6 bg-muted animate-pulse rounded w-1/3" />
          </div>
          <ul className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="mt-2 h-1.5 w-1.5 rounded-full bg-muted animate-pulse flex-shrink-0" />
                <div className="h-4 bg-muted animate-pulse rounded w-full" />
              </li>
            ))}
          </ul>
        </div>

        {/* Technologies skeleton */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-1 w-8 bg-muted animate-pulse rounded" />
            <div className="h-6 bg-muted animate-pulse rounded w-1/4" />
          </div>
          <div className="flex flex-wrap gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-8 w-20 bg-muted animate-pulse rounded-full" />
            ))}
          </div>
        </div>

        {/* Back button skeleton */}
        <div className="pt-8 border-t border-border">
          <div className="h-10 bg-muted animate-pulse rounded w-48" />
        </div>
      </article>
    </section>
  );
};

/**
 * Displays the content and detailed information for a specific experience.
 */
const ExperienceDetailContent = ({ id }: { id: string }): JSX.Element => {
  const { data: experiences } = useSanityExperiences();
  const experienceItem = (experiences as any[]).find((exp: any) => exp._id === id);

  if (!experienceItem) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-2xl">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-muted mb-8">
          <Clipboard className="h-12 w-12 text-muted-foreground" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-4">Experience Not Found</h1>
        <p className="text-muted-foreground text-lg mb-8">
          The experience item you are looking for does not exist or has been removed.
        </p>
        <Button
          asChild
          variant="outline"
          className="bg-secondary hover:bg-secondary/80 border-border hover:border-primary text-secondary-foreground"
        >
          <Link href="/experience">
            <ArrowLeft className="mr-2 h-5 w-5" /> Back to Experience
          </Link>
        </Button>
      </div>
    );
  }

  const period = formatDatePeriod(
    experienceItem.startDate,
    experienceItem.endDate,
    experienceItem.current,
  );

  return (
    <section className="w-full max-w-4xl mx-auto bg-card border border-border rounded-xl overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-primary/10 transition-shadow duration-300">
      <article className="p-6 md:p-10 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start gap-6 pb-8 border-b border-border">
          {experienceItem.logo && (
            <div className="flex-shrink-0 w-24 h-24 relative bg-background rounded-lg overflow-hidden ring-2 ring-border p-2">
              <Image
                src={urlFor(experienceItem.logo).width(96).height(96).url()}
                alt={`${experienceItem.company} logo`}
                width={96}
                height={96}
                className="rounded-md object-contain"
              />
            </div>
          )}

          <div className="flex-grow space-y-3">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
              {experienceItem.position}
            </h1>
            <h2 className="text-xl md:text-2xl font-semibold text-primary">
              {experienceItem.company}
            </h2>

            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{period}</span>
              </div>

              {experienceItem.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{experienceItem.location}</span>
                </div>
              )}

              {experienceItem.companyUrl && (
                <Link
                  href={experienceItem.companyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors group w-fit"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="group-hover:underline">Visit Company Website</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div className="space-y-4">
          <h3 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <div className="h-1 w-8 bg-primary rounded" />
            Description
          </h3>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-base">
            {experienceItem.description}
          </p>
        </div>

        {/* Key Responsibilities Section */}
        {experienceItem.responsibilities && experienceItem.responsibilities.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <div className="h-1 w-8 bg-primary rounded" />
              Key Responsibilities
            </h3>
            <ul className="space-y-3">
              {experienceItem.responsibilities.map((responsibility: string, index: number) => (
                <li key={index} className="flex items-start gap-3 text-muted-foreground">
                  <div className="mt-2 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span className="leading-relaxed">{responsibility}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Technologies Section */}
        {experienceItem.technologies && experienceItem.technologies.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <div className="h-1 w-8 bg-primary rounded" />
              Technologies Used
            </h3>
            <div className="flex flex-wrap gap-2">
              {experienceItem.technologies.map((tech: string, index: number) => (
                <span
                  key={index}
                  className="px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground rounded-full border border-border hover:border-primary hover:bg-secondary/80 transition-all duration-200"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Back Button */}
        <div className="pt-8 border-t border-border">
          <Button
            asChild
            variant="outline"
            className="bg-secondary hover:bg-secondary/80 border-border hover:border-primary text-secondary-foreground group"
          >
            <Link href="/experience">
              <ArrowLeft className="mr-2 h-5 w-5 group-hover:-translate-x-1 transition-transform duration-200" />
              Back to Experience
            </Link>
          </Button>
        </div>
      </article>
    </section>
  );
};

/**
 * Renders the ExperienceDetail page, including suspense state and layout.
 */
export const ExperienceDetail = ({ params }: ExperienceDetailProps): JSX.Element => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <Suspense fallback={<ExperienceDetailSkeleton />}>
          <ExperienceDetailContent id={params.id} />
        </Suspense>
      </div>
    </Layout>
  );
};
ExperienceDetail.displayName = 'ExperienceDetail';
export default ExperienceDetail;