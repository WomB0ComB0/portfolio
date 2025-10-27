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

import { MagicCard } from '@/components';
import Layout from '@/components/layout/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useSanityProjects } from '@/hooks';
import { urlFor } from '@/lib/sanity/client';
import { formatDatePeriod, formatMonthYear } from '@/utils';
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  FileText,
  Github,
  ImageIcon,
  Layers,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { JSX } from 'react';
import { DraggableGallery } from '../../_components';
import type { ProjectDetailProps } from './project-detail.types';

const ProjectDetailSkeleton = (): JSX.Element => (
  <Layout>
    <div className="relative w-full h-[70vh] min-h-[500px] max-h-[700px] bg-muted/50 animate-pulse">
      <div className="absolute top-8 left-8 z-20">
        <div className="h-10 w-32 bg-muted/80 backdrop-blur-sm animate-pulse rounded-lg" />
      </div>
    </div>

    <div className="container mx-auto px-4 -mt-40 relative z-10 pb-24">
      <div className="max-w-5xl mx-auto space-y-8">
        <Card className="border-border/50 bg-card/95 backdrop-blur-sm shadow-xl">
          <CardContent className="p-8">
            <div className="h-14 w-3/4 bg-muted animate-pulse rounded-lg mb-6" />
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="h-8 w-28 bg-muted animate-pulse rounded-full" />
              <div className="h-8 w-24 bg-muted animate-pulse rounded-full" />
              <div className="h-6 w-40 bg-muted animate-pulse rounded-md" />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="h-12 w-36 bg-muted animate-pulse rounded-lg" />
              <div className="h-12 w-40 bg-muted animate-pulse rounded-lg" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/95 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="h-8 w-48 bg-muted animate-pulse rounded-md mb-4" />
            <div className="space-y-3">
              <div className="h-6 w-full bg-muted animate-pulse rounded-md" />
              <div className="h-6 w-11/12 bg-muted animate-pulse rounded-md" />
              <div className="h-6 w-full bg-muted animate-pulse rounded-md" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/95 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="h-8 w-48 bg-muted animate-pulse rounded-md mb-6" />
            <div className="flex flex-wrap gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 w-24 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </Layout>
);

export const ProjectDetail = ({ params }: ProjectDetailProps): JSX.Element => {
  const { data: projects, isLoading } = useSanityProjects();

  if (isLoading) {
    return <ProjectDetailSkeleton />;
  }

  const project = projects?.find((p) => p._id === params.id);

  if (!project) {
    notFound();
  }

  const dateRange = project.endDate
    ? formatDatePeriod(project.startDate!, project.endDate)
    : `Started ${formatMonthYear(project.startDate!)}`;

  return (
    <Layout>
      <div className="relative w-full h-[70vh] min-h-[500px] max-h-[700px] bg-muted/20">
        {project.image ? (
          <Image
            src={urlFor(project.image).width(1920).height(1080).url() || '/assets/svgs/logo.svg'}
            alt={project.title}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 100vw"
          />
        ) : (
          <div className="w-full h-full bg-linear-to-br from-primary/20 via-secondary/20 to-accent/20" />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/80 to-background/20" />

        <div className="absolute top-8 left-8 z-20">
          <Button
            asChild
            variant="outline"
            size="lg"
            className="bg-background/90 backdrop-blur-md border-border/50 hover:bg-background hover:border-border shadow-lg transition-all duration-300 hover:shadow-xl"
          >
            <Link href="/projects">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Link>
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-40 relative z-10 pb-24">
        <div className="max-w-5xl mx-auto space-y-8">
          <MagicCard className="border-border/50 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <CardContent className="p-8 md:p-10">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-6 text-balance leading-tight">
                {project.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 mb-8">
                <Badge variant="secondary" className="px-4 py-2 text-sm font-medium gap-2">
                  <Layers className="h-3.5 w-3.5" />
                  {project.category}
                </Badge>
                <Badge
                  variant="outline"
                  className="px-4 py-2 text-sm font-medium border-primary/30 text-primary"
                >
                  {project.status}
                </Badge>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{dateRange}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {project.liveUrl && (
                  <Button
                    asChild
                    size="lg"
                    className="gap-2 shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <Link href={project.liveUrl} target="_blank" rel="noopener noreferrer">
                      View Live Project
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
                {project.githubUrl && (
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="gap-2 bg-background/50 backdrop-blur-sm hover:bg-background border-border/50 hover:border-border shadow-md hover:shadow-lg transition-all duration-300"
                  >
                    <Link href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                      <Github className="h-4 w-4" />
                      View Source Code
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </MagicCard>

          <MagicCard className="border-border/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-8 md:p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-foreground">Description</h2>
              </div>
              <p className="text-lg text-foreground/90 leading-relaxed">{project.description}</p>
            </CardContent>
          </MagicCard>

          {project.longDescription && (
            <MagicCard className="border-border/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-8 md:p-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-secondary/10">
                    <FileText className="h-5 w-5 text-secondary" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-semibold text-foreground">
                    Project Overview
                  </h2>
                </div>
                <Separator className="mb-6" />
                <p className="text-base text-foreground/80 leading-relaxed whitespace-pre-line">
                  {project.longDescription}
                </p>
              </CardContent>
            </MagicCard>
          )}

          {project.technologies && project.technologies.length > 0 && (
            <MagicCard className="border-border/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-8 md:p-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Layers className="h-5 w-5 text-accent" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-semibold text-foreground">
                    Technologies Used
                  </h2>
                </div>
                <Separator className="mb-6" />
                <div className="flex flex-wrap gap-3">
                  {project.technologies.map((tech: string) => (
                    <Badge
                      key={tech}
                      variant="secondary"
                      className="px-4 py-2.5 text-sm font-medium bg-muted/50 hover:bg-muted transition-colors duration-200 cursor-default"
                    >
                      {tech}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </MagicCard>
          )}

          {project.images && project.images.length > 0 && (
            <MagicCard className="border-border/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-8 md:p-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <ImageIcon className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-semibold text-foreground">
                    Project Gallery
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  Hover over any image to view it in full screen. Drag horizontally to browse
                  through the gallery.
                </p>
                <Separator className="mb-6" />
                <DraggableGallery
                  images={
                    project.images?.map((img) => ({
                      url: urlFor(img).width(1200).height(675).url() || '/assets/svgs/logo.svg',
                      alt: img.alt || 'Project image',
                    })) || []
                  }
                />
              </CardContent>
            </MagicCard>
          )}
        </div>
      </div>
    </Layout>
  );
};
ProjectDetail.displayName = 'ProjectDetail';
export default ProjectDetail;
