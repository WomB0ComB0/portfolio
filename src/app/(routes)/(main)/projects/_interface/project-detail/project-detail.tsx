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

import { ArrowLeft, ExternalLink, Github } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { JSX } from 'react';
import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import { useSanityProjects } from '@/hooks';
import { urlFor } from '@/lib/sanity/client';
import { formatDatePeriod, formatMonthYear } from '@/utils';

interface ProjectDetailProps {
  params: { id: string };
}

const ProjectDetailSkeleton = (): JSX.Element => (
  <Layout>
    {/* Hero Skeleton */}
    <div className="relative w-full h-[60vh] min-h-[400px] max-h-[600px] bg-muted animate-pulse">
      {/* Back Button Skeleton */}
      <div className="absolute top-8 left-8 z-20">
        <div className="h-10 w-28 bg-muted animate-pulse rounded-md" />
      </div>
    </div>

    {/* Content Skeleton */}
    <div className="container mx-auto px-4 -mt-32 relative z-10 pb-24">
      <div className="max-w-4xl mx-auto">
        {/* Title & Meta Skeleton */}
        <div className="mb-12">
          <div className="h-12 w-3/4 bg-muted animate-pulse rounded-md mb-6" /> {/* Title */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="h-6 w-24 bg-muted animate-pulse rounded-full" /> {/* Category */}
            <div className="h-6 w-20 bg-muted animate-pulse rounded-full" /> {/* Status */}
            <div className="h-6 w-32 bg-muted animate-pulse rounded-md" /> {/* Date Range */}
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="h-12 w-32 bg-muted animate-pulse rounded-md" /> {/* Live Button */}
            <div className="h-12 w-36 bg-muted animate-pulse rounded-md" /> {/* Github Button */}
          </div>
        </div>

        {/* Description Skeleton */}
        <div className="mb-12">
          <div className="h-7 w-full bg-muted animate-pulse rounded-md mb-3" />
          <div className="h-7 w-11/12 bg-muted animate-pulse rounded-md mb-3" />
          <div className="h-7 w-full bg-muted animate-pulse rounded-md" />
        </div>

        {/* Long Description Skeleton */}
        <div className="mb-12">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-md mb-4" /> {/* Overview Title */}
          <div className="h-7 w-full bg-muted animate-pulse rounded-md mb-3" />
          <div className="h-7 w-11/12 bg-muted animate-pulse rounded-md mb-3" />
          <div className="h-7 w-full bg-muted animate-pulse rounded-md" />
        </div>

        {/* Technologies Skeleton */}
        <div className="mb-12">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-md mb-4" />{' '}
          {/* Technologies Title */}
          <div className="flex flex-wrap gap-2">
            <div className="h-10 w-24 bg-muted animate-pulse rounded-lg" />
            <div className="h-10 w-28 bg-muted animate-pulse rounded-lg" />
            <div className="h-10 w-20 bg-muted animate-pulse rounded-lg" />
            <div className="h-10 w-32 bg-muted animate-pulse rounded-lg" />
          </div>
        </div>

        {/* Gallery Skeleton */}
        <div className="mb-12">
          <div className="h-8 w-32 bg-muted animate-pulse rounded-md mb-6" /> {/* Gallery Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="relative aspect-video rounded-lg bg-muted animate-pulse" />
            <div className="relative aspect-video rounded-lg bg-muted animate-pulse" />
            <div className="relative aspect-video rounded-lg bg-muted animate-pulse hidden sm:block" />
            <div className="relative aspect-video rounded-lg bg-muted animate-pulse hidden lg:block" />
          </div>
        </div>
      </div>
    </div>
  </Layout>
);

export const ProjectDetail = ({ params }: ProjectDetailProps): JSX.Element => {
  const { data: projects, isLoading } = useSanityProjects();

  if (isLoading) {
    return <ProjectDetailSkeleton />;
  }

  const project = (projects as any[])?.find((p: any) => p._id === params.id);

  if (!project) {
    notFound();
  }

  const dateRange = project.endDate
    ? formatDatePeriod(project.startDate, project.endDate)
    : `Started ${formatMonthYear(project.startDate)}`;

  return (
    <Layout>
      {/* Hero Section */}
      <div className="relative w-full h-[60vh] min-h-[400px] max-h-[600px] bg-card">
        {project.image ? (
          <Image
            src={urlFor(project.image).width(1920).height(1080).url() || '/placeholder.svg'}
            alt={project.image.alt || project.title}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 100vw"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-secondary to-accent" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        {/* Back Button */}
        <div className="absolute top-8 left-8 z-20">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="bg-background/80 backdrop-blur-sm border-border hover:bg-background"
          >
            <Link href="/projects">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 -mt-32 relative z-10 pb-24">
        <div className="max-w-4xl mx-auto">
          {/* Title & Meta */}
          <div className="mb-12">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-6 text-balance">
              {project.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
              <span className="px-3 py-1 bg-secondary/20 text-secondary-foreground rounded-full">
                {project.category}
              </span>
              <span className="px-3 py-1 bg-accent/20 text-accent-foreground rounded-full">
                {project.status}
              </span>
              <span>{dateRange}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              {project.liveUrl && (
                <Button asChild size="lg" className="gap-2">
                  <Link href={project.liveUrl} target="_blank" rel="noopener noreferrer">
                    View Live
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              {project.githubUrl && (
                <Button asChild variant="outline" size="lg" className="gap-2 bg-transparent">
                  <Link href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                    <Github className="h-4 w-4" />
                    Source Code
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="prose prose-invert max-w-none mb-12">
            <p className="text-lg sm:text-xl text-foreground/90 leading-relaxed">
              {project.description}
            </p>
          </div>

          {/* Long Description */}
          {project.longDescription && (
            <div className="mb-12">
              <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-4">Overview</h2>
              <p className="text-foreground/80 leading-relaxed whitespace-pre-line">
                {project.longDescription}
              </p>
            </div>
          )}

          {/* Technologies */}
          {project.technologies && project.technologies.length > 0 && (
            <div className="mb-12">
              <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-4">
                Technologies
              </h2>
              <div className="flex flex-wrap gap-2">
                {project.technologies.map((tech: string) => (
                  <span
                    key={tech}
                    className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Gallery */}
          {project.images && project.images.length > 0 && (
            <div className="mb-12">
              <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-6">Gallery</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {project.images.map((img: any, index: number) => (
                  <div
                    key={index}
                    className="relative aspect-video rounded-lg overflow-hidden bg-card"
                  >
                    <Image
                      src={urlFor(img).width(1200).height(675).url() || '/placeholder.svg'}
                      alt={img.alt || `${project.title} screenshot ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};
ProjectDetail.displayName = 'ProjectDetail';
export default ProjectDetail;
