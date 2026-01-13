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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FilterBar } from '@/components/ui/filter-bar';
import { useDebounce, useSanityProjects } from '@/hooks';
import { urlFor } from '@/lib/sanity/client';
import { validateUserInput } from '@/utils';
import { ArrowUpRight, Code, Code2, FolderGit2, Github, Search } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { type JSX, Suspense, useMemo, useState } from 'react';

const ITEMS_PER_PAGE = 9;

const ProjectCardSkeleton = (): JSX.Element => (
  <Card className="bg-card/50 backdrop-blur-md border-white/10 rounded-3xl overflow-hidden h-full">
    <div className="relative">
      <div className="relative w-full aspect-video bg-muted/20 animate-pulse" />
      <CardHeader className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="h-6 bg-muted/20 animate-pulse rounded w-3/4" />
            <div className="flex gap-2">
              <div className="h-6 w-20 bg-muted/20 animate-pulse rounded-full" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 space-y-4">
        <div className="space-y-2">
          <div className="h-4 bg-muted/20 animate-pulse rounded w-full" />
          <div className="h-4 bg-muted/20 animate-pulse rounded w-5/6" />
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {new Array(6).fill(null).map((_, i) => (
        <ProjectCardSkeleton key={`skeleton-${+i}`} />
      ))}
    </div>
  </div>
);

const ProjectsListContent = (): JSX.Element => {
  const { data: projects, isLoading, error } = useSanityProjects();

  const projectsList = projects || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTech, setSelectedTech] = useState('all');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const uniqueCategories = useMemo(() => {
    const categories = new Set(projectsList.map((p) => p.category));
    return Array.from(categories).sort();
  }, [projectsList]);

  const uniqueTechnologies = useMemo(() => {
    const techs = new Set<string>();
    for (const project of projectsList) {
      if (project.technologies) {
        for (const tech of project.technologies) {
          if (tech) techs.add(tech);
        }
      }
    }
    return Array.from(techs).sort();
  }, [projectsList]);

  const filteredProjects = useMemo(() => {
    return projectsList.filter((project) => {
      const matchesCategory = selectedCategory === 'all' || project.category === selectedCategory;
      const matchesTech =
        selectedTech === 'all' || project.technologies?.includes(selectedTech) || false;

      const sanitizedQuery = validateUserInput(debouncedSearchQuery, 100).toLowerCase();
      const matchesSearch =
        sanitizedQuery === '' ||
        project.title.toLowerCase().includes(sanitizedQuery) ||
        project.description.toLowerCase().includes(sanitizedQuery);

      return matchesCategory && matchesTech && matchesSearch;
    });
  }, [projectsList, selectedCategory, selectedTech, debouncedSearchQuery]);

  const hasActiveFilters =
    searchQuery !== '' || selectedCategory !== 'all' || selectedTech !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedTech('all');
  };

  const {
    displayedItems: displayedProjects,
    hasMore,
    isLoadingMore,
    loadMoreRef,
    loadMore,
  } = usePagination(filteredProjects, { itemsPerPage: ITEMS_PER_PAGE });

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 80,
        damping: 15,
      },
    },
  };

  if (isLoading) {
    return <ProjectsListSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-24 space-y-6">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-destructive/10 backdrop-blur-sm">
          <FolderGit2 className="h-12 w-12 text-destructive" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-foreground">Unable to Load Projects</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Failed to load projects. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-16">
      <PageHeader
        title="My Projects"
        description="A showcase of my work spanning web development, mobile apps, and machine learning"
        icon={<Code />}
      />

      {/* Filter Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search projects..."
        filters={[
          {
            value: selectedCategory,
            onChange: setSelectedCategory,
            options: uniqueCategories,
            placeholder: 'All Categories',
            icon: <FolderGit2 className="h-4 w-4" />,
          },
          {
            value: selectedTech,
            onChange: setSelectedTech,
            options: uniqueTechnologies,
            placeholder: 'All Technologies',
            icon: <Code2 className="h-4 w-4" />,
          },
        ]}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
        resultsCount={filteredProjects.length}
        totalCount={projectsList.length}
        entityName="projects"
      />

      {displayedProjects.length > 0 ? (
        <>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid gap-8 justify-center grid-cols-[repeat(auto-fit,minmax(220px,280px))]"
          >
            {displayedProjects.map((project) => (
              <motion.div key={project._id} variants={itemVariants} className="group h-full w-full">
                <Link href={`/projects/${project._id}`} className="block h-full">
                  <MagicCard className="relative bg-card/40 backdrop-blur-md border-white/5 rounded-3xl overflow-hidden h-full transition-all duration-500 hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-2">
                    <div className="flex flex-col h-full">
                      {/* Image Section */}
                      <div className="relative w-full aspect-video overflow-hidden bg-muted/20">
                        {project.image ? (
                          <Image
                            src={
                              urlFor(project.image).width(800).height(450).url() ||
                              '/assets/svgs/logo.svg'
                            }
                            alt={project.image.alt || project.title}
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted/10">
                            <Code2 className="h-12 w-12 text-muted-foreground/20" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-linear-to-t from-background/90 via-background/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />

                        {/* Floating Category Badge */}
                        <div className="absolute top-4 left-4 max-w-[calc(100%-2rem)]">
                          <Badge className="bg-background/80 backdrop-blur-md text-foreground border-white/10 shadow-lg max-w-full hover:bg-background/90 transition-colors">
                            <span className="truncate">{project.category}</span>
                          </Badge>
                        </div>

                        {/* Github Link */}
                        {project.githubUrl && (
                          <div className="absolute top-4 right-4 translate-x-10 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 delay-100">
                            <div className="p-2 bg-background/80 backdrop-blur-md rounded-full text-foreground hover:text-primary shadow-lg cursor-pointer">
                              <Github className="h-5 w-5" />
                            </div>
                          </div>
                        )}
                      </div>

                      <CardContent className="p-6 flex flex-col grow relative">
                        <div className="space-y-3 mb-4">
                          <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {project.title}
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                            {project.description}
                          </p>
                        </div>

                        <div className="mt-auto space-y-6">
                          {/* Tech Stack */}
                          {project.technologies && project.technologies.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {project.technologies.slice(0, 3).map((tech, idx) => {
                                const techName =
                                  typeof tech === 'string' ? tech : tech || 'Unknown';
                                return (
                                  <span
                                    key={`${techName}-${+idx}`}
                                    className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold bg-primary/5 text-primary/80 rounded-md border border-primary/10"
                                  >
                                    {techName}
                                  </span>
                                );
                              })}
                              {project.technologies.length > 3 && (
                                <span className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                  +{project.technologies.length - 3}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Action Footer */}
                          <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                              View Project
                            </span>
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 group-hover:scale-110">
                              <ArrowUpRight className="h-4 w-4" />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </div>
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
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center justify-center py-32 text-center"
        >
          <div className="w-24 h-24 rounded-3xl bg-muted/10 flex items-center justify-center mb-6 animate-pulse">
            <Search className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {hasActiveFilters ? 'No matches found' : 'No projects yet'}
          </h3>
          <p className="text-muted-foreground max-w-xs mx-auto">
            {hasActiveFilters
              ? 'Try adjusting your search or filters to find what you looking for.'
              : 'Check back soon for new projects!'}
          </p>
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={clearFilters}
              className="mt-8 rounded-xl border-white/10 hover:bg-white/5"
            >
              Clear all filters
            </Button>
          )}
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
