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

import { PaginationControls, usePagination } from '@/app/_components';
import { MagicCard, PageHeader } from '@/components';
import Layout from '@/components/layout/layout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSanityProjects } from '@/hooks';
import { urlFor } from '@/lib/sanity/client';
import { Code, ExternalLink, FolderGit2, Github } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { type JSX, Suspense } from 'react';

const ITEMS_PER_PAGE = 9;

const ProjectCardSkeleton = (): JSX.Element => (
  <Card className="bg-card/50 backdrop-blur-sm border-border/50 rounded-xl overflow-hidden">
    <div className="relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-muted animate-pulse" />
      <div className="relative w-full h-56 bg-muted animate-pulse" />

      <CardHeader className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="h-6 bg-muted animate-pulse rounded w-3/4" />
            <div className="flex gap-2">
              <div className="h-6 w-20 bg-muted animate-pulse rounded-full" />
              <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
            </div>
          </div>
          <div className="h-6 w-6 bg-muted animate-pulse rounded" />
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-6 space-y-4">
        <div className="space-y-2">
          <div className="h-4 bg-muted animate-pulse rounded w-full" />
          <div className="h-4 bg-muted animate-pulse rounded w-5/6" />
        </div>
        <div className="flex flex-wrap gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-7 w-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </CardContent>
    </div>
  </Card>
);

const ProjectsListSkeleton = (): JSX.Element => (
  <div className="space-y-12">
    <PageHeader
      title="My Projects"
      description="A showcase of my work spanning web development, mobile apps, and machine learning"
      icon={<Code />}
    />

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <ProjectCardSkeleton key={i} />
      ))}
    </div>
  </div>
);

const ProjectsListContent = (): JSX.Element => {
  const { data: projects, isLoading, error } = useSanityProjects();

  const projectsList = projects || [];

  const {
    displayedItems: displayedProjects,
    hasMore,
    isLoadingMore,
    loadMoreRef,
    loadMore,
    displayCount,
  } = usePagination(projectsList, { itemsPerPage: ITEMS_PER_PAGE });

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

  if (isLoading) {
    return <ProjectsListSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-16 space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10">
          <FolderGit2 className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-foreground">Unable to Load Projects</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Failed to load projects. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <PageHeader
        title="My Projects"
        description="A showcase of my work spanning web development, mobile apps, and machine learning"
        icon={<Code />}
      />

      {displayedProjects.length > 0 ? (
        <>
          <motion.div
            key={displayCount}
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {displayedProjects.map((project) => (
              <motion.div
                key={project._id}
                variants={itemVariants}
                whileHover={{ y: -8 }}
                transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
              >
                <Link href={`/projects/${project._id}`} className="block h-full">
                  <MagicCard className="relativ backdrop-blur-sm border-border/50 rounded-xl overflow-hidden h-full flex flex-col group hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300">
                    {project.image && (
                      <div className="relative w-full h-56 overflow-hidden bg-muted">
                        <Image
                          src={
                            urlFor(project.image).width(600).height(224).url() ||
                            '/assets/svgs/logo.svg'
                          }
                          alt={project.image.alt || project.title}
                          width={600}
                          height={224}
                          className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-card/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                    )}

                    <CardHeader className="p-6 pb-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight flex-1">
                          {project.title}
                        </CardTitle>
                        {project.githubUrl && (
                          <motion.div
                            whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.1 }}
                            transition={{ duration: 0.5 }}
                          >
                            <Github className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                          </motion.div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="secondary"
                          className="bg-secondary/50 text-secondary-foreground text-xs border-border/50"
                        >
                          {project.category}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-xs border-border/50 text-muted-foreground"
                        >
                          {project.status}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="px-6 pb-6 grow flex flex-col space-y-4">
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 grow">
                        {project.description}
                      </p>

                      {project.technologies && project.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {project.technologies.slice(0, 4).map((tech, idx: number) => {
                            const techName = typeof tech === 'string' ? tech : tech || 'Unknown';
                            return (
                              <span
                                key={`${techName}-${idx}`}
                                className="px-2.5 py-1 text-xs bg-muted/50 text-muted-foreground rounded-md border border-border/50 hover:border-primary/30 transition-colors"
                              >
                                {techName}
                              </span>
                            );
                          })}
                          {project.technologies.length > 4 && (
                            <span className="px-2.5 py-1 text-xs text-muted-foreground font-medium">
                              +{project.technologies.length - 4}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-sm pt-2 border-t border-border/30 mt-auto">
                        <span className="text-primary group-hover:text-primary/80 transition-colors font-medium">
                          View Details
                        </span>
                        <ExternalLink className="h-4 w-4 text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                      </div>
                    </CardContent>
                  </MagicCard>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          {/* Infinite scroll trigger and load more button */}
          <PaginationControls
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            loadMoreRef={loadMoreRef}
            onLoadMore={loadMore}
            loadingText="Loading more projects..."
            buttonText="Load More Projects"
          />
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center py-20"
        >
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-muted/50 mb-6">
            <FolderGit2 className="h-12 w-12 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <p className="text-xl text-foreground font-medium">No projects available yet</p>
            <p className="text-sm text-muted-foreground">Check back soon for updates!</p>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export const ProjectsList = (): JSX.Element => {
  return (
    <Layout>
      <div className="container mx-auto px-4 md:px-6 py-12 max-w-7xl">
        <Suspense fallback={<ProjectsListSkeleton />}>
          <ProjectsListContent />
        </Suspense>
      </div>
    </Layout>
  );
};
ProjectsList.displayName = 'ProjectsList';
export default ProjectsList;
