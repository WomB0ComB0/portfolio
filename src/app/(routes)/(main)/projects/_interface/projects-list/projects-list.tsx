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

import { Briefcase, ExternalLink, Github } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { type JSX, Suspense } from 'react';
import Layout from '@/components/layout/layout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSanityProjects } from '@/hooks';
import { urlFor } from '@/lib/sanity/client';

// Skeleton component for a single project card
const ProjectCardSkeleton = (): JSX.Element => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.6, delay: 0.2 }}
    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
  >
    {[...Array(6)].map((_, index) => (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
      >
        <Card className="group bg-card border-border rounded-xl overflow-hidden flex flex-col h-full animate-pulse">
          <div className="relative w-full h-48 overflow-hidden bg-muted/20"></div>{' '}
          {/* Image placeholder */}
          <CardHeader className="p-6 pb-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="h-6 w-3/4 bg-muted/30 rounded-md"></div> {/* Title placeholder */}
              <div className="h-5 w-5 bg-muted/30 rounded-md flex-shrink-0"></div>{' '}
              {/* Github icon placeholder */}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="h-6 w-20 bg-muted/30 rounded-md"></div>{' '}
              {/* Category badge placeholder */}
              <div className="h-6 w-16 bg-muted/30 rounded-md"></div>{' '}
              {/* Status badge placeholder */}
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 flex-grow flex flex-col">
            <div className="space-y-2 flex-grow mb-4">
              <div className="h-4 w-full bg-muted/30 rounded-md"></div> {/* Description line 1 */}
              <div className="h-4 w-11/12 bg-muted/30 rounded-md"></div> {/* Description line 2 */}
              <div className="h-4 w-5/6 bg-muted/30 rounded-md"></div> {/* Description line 3 */}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="h-6 w-20 bg-muted/30 rounded-md"></div> {/* Tech badge 1 */}
              <div className="h-6 w-16 bg-muted/30 rounded-md"></div> {/* Tech badge 2 */}
              <div className="h-6 w-24 bg-muted/30 rounded-md"></div> {/* Tech badge 3 */}
            </div>
          </CardContent>
          <div className="p-6 pt-3 border-t border-border/50 mt-auto">
            <div className="flex items-center justify-between text-sm">
              <div className="h-4 w-24 bg-muted/30 rounded-md"></div> {/* View Details text */}
              <div className="h-4 w-4 bg-muted/30 rounded-md"></div> {/* External link icon */}
            </div>
          </div>
        </Card>
      </motion.div>
    ))}
  </motion.div>
);

const ProjectsListContent = (): JSX.Element => {
  const { data: projects, isLoading, error } = useSanityProjects();
  const projectsList = (projects as any[]) || [];

  if (isLoading) {
    return <ProjectCardSkeleton />;
  }

  if (error) {
    return (
      <Card className="bg-destructive/10 border-destructive/50">
        <CardContent className="p-8 text-center">
          <p className="text-destructive-foreground text-lg">
            Failed to load projects. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-16"
      >
        <div className="flex items-center gap-4 mb-4">
          <Briefcase className="h-10 w-10 text-primary" />
          <h1 className="text-5xl font-bold text-foreground text-balance">Projects</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
          A showcase of my work spanning web development, mobile apps, machine learning, and more.
        </p>
        <div className="mt-6 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary"></div>
            {projectsList.length} Projects
          </span>
        </div>
      </motion.header>

      {projectsList.length > 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {projectsList.map((project: any, index: number) => (
            <motion.div
              key={project._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link href={`/projects/${project._id}`} className="block h-full">
                <Card className="group bg-card border-border hover:border-primary/50 rounded-xl overflow-hidden flex flex-col h-full transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
                  {project.image && (
                    <div className="relative w-full h-48 overflow-hidden bg-muted/20">
                      <Image
                        src={
                          urlFor(project.image).width(400).height(192).url() || '/placeholder.svg'
                        }
                        alt={project.image.alt || project.title}
                        width={400}
                        height={192}
                        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  )}

                  <CardHeader className="p-6 pb-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <CardTitle className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                        {project.title}
                      </CardTitle>
                      {project.githubUrl && (
                        <Github className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="secondary"
                        className="bg-secondary/30 text-secondary-foreground text-xs border-0"
                      >
                        {project.category}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-xs border-border text-muted-foreground"
                      >
                        {project.status}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-6 pt-0 flex-grow flex flex-col">
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-grow leading-relaxed">
                      {project.description}
                    </p>

                    {project.technologies && project.technologies.length > 0 && (
                      <div>
                        <div className="flex flex-wrap gap-2">
                          {project.technologies.slice(0, 6).map((tech: any, idx: number) => {
                            const techName =
                              typeof tech === 'string'
                                ? tech
                                : tech?.name || tech?.title || 'Unknown';
                            return (
                              <span
                                key={`${techName}-${idx}`}
                                className="px-2.5 py-1 text-xs bg-muted/50 text-muted-foreground rounded-md border border-border/50"
                              >
                                {techName}
                              </span>
                            );
                          })}
                          {project.technologies.length > 6 && (
                            <span className="px-2.5 py-1 text-xs text-muted-foreground flex items-center">
                              +{project.technologies.length - 6}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>

                  <div className="p-6 pt-3 border-t border-border/50 mt-auto">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-primary group-hover:text-primary/80 transition-colors font-medium">
                        View Details
                      </span>
                      <ExternalLink className="h-4 w-4 text-primary group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/20 mb-4">
            <Briefcase className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-xl text-foreground">No projects available yet.</p>
          <p className="text-sm text-muted-foreground mt-2">Check back soon for updates!</p>
        </motion.div>
      )}
    </>
  );
};

export const ProjectsList = (): JSX.Element => {
  return (
    <Layout>
      <div className="container mx-auto px-6 py-16 max-w-7xl">
        <Suspense fallback={<ProjectCardSkeleton />}>
          <ProjectsListContent />
        </Suspense>
      </div>
    </Layout>
  );
};
ProjectsList.displayName = 'ProjectsList';
export default ProjectsList;
