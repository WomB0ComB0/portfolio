'use client';

import { Briefcase, ExternalLink, Github } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { motion } from 'motion/react';
import Layout from '@/components/layout/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSanityProjects } from '@/hooks';
import { urlFor } from '@/lib/sanity/client';

const ProjectsListContent = () => {
  const { data: projects, isLoading, error } = useSanityProjects();
  const projectsList = (projects as any[]) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent mb-4"></div>
          <p className="text-gray-400 text-lg">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-gradient-to-br from-red-900/20 to-red-800/20 border-red-800">
        <CardContent className="p-8 text-center">
          <p className="text-red-400 text-lg">Failed to load projects. Please try again later.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-16 text-center"
      >
        <div className="flex items-center justify-center mb-4">
          <Briefcase className="h-12 w-12 text-purple-400 mr-4" />
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
            Projects
          </h1>
        </div>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          A showcase of my work spanning web development, mobile apps, machine learning, and more.
        </p>
        <div className="mt-6 flex items-center justify-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-purple-500"></div>
            {projectsList.length} Projects
          </span>
        </div>
      </motion.header>

      {/* Projects Grid */}
      {projectsList.length > 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {projectsList.map((project: any, index: number) => (
            <motion.div
              key={project._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link href={`/projects/${project._id}`} scroll={false} className="block h-full">
                <Card className="group bg-[#1E1E1E] border-purple-800/50 hover:border-purple-600 rounded-xl overflow-hidden flex flex-col h-full transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20 hover:-translate-y-1">
                  {/* Project Image */}
                  {project.image && (
                    <div className="relative w-full h-48 overflow-hidden bg-gradient-to-br from-purple-900/20 to-indigo-900/20">
                      <Image
                        src={urlFor(project.image).width(400).height(192).url()}
                        alt={project.image.alt || project.title}
                        width={400}
                        height={192}
                        className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1E1E1E] via-transparent to-transparent opacity-60"></div>
                    </div>
                  )}

                  {/* Project Info */}
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <CardTitle className="text-xl font-semibold text-purple-300 group-hover:text-purple-200 transition-colors line-clamp-2">
                        {project.title}
                      </CardTitle>
                      {project.githubUrl && (
                        <Github className="h-5 w-5 text-gray-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="bg-purple-900/30 text-purple-300 text-xs">
                        {project.category}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${project.status === 'Completed'
                            ? 'border-green-700 text-green-400'
                            : project.status === 'In Progress'
                              ? 'border-yellow-700 text-yellow-400'
                              : 'border-gray-700 text-gray-400'
                          }`}
                      >
                        {project.status}
                      </Badge>
                    </div>
                  </CardHeader>

                  {/* Project Description */}
                  <CardContent className="p-5 pt-0 flex-grow flex flex-col">
                    <p className="text-sm text-gray-400 mb-4 line-clamp-3 flex-grow">
                      {project.description}
                    </p>

                    {/* Technologies */}
                    {project.technologies && project.technologies.length > 0 && (
                      <div>
                        <div className="flex flex-wrap gap-1.5">
                          {project.technologies.slice(0, 6).map((tech: any, idx: number) => {
                            const techName =
                              typeof tech === 'string' ? tech : tech?.name || tech?.title || 'Unknown';
                            return (
                              <span
                                key={`${techName}-${idx}`}
                                className="px-2 py-1 text-xs bg-purple-900/40 text-purple-300 rounded-md border border-purple-800/30"
                              >
                                {techName}
                              </span>
                            );
                          })}
                          {project.technologies.length > 6 && (
                            <span className="px-2 py-1 text-xs text-gray-500 flex items-center">
                              +{project.technologies.length - 6} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>

                  {/* View Details Footer */}
                  <div className="p-5 pt-3 border-t border-purple-800/30 mt-auto">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-purple-400 group-hover:text-purple-300 transition-colors font-medium">
                        View Details
                      </span>
                      <ExternalLink className="h-4 w-4 text-purple-400 group-hover:text-purple-300 transition-all group-hover:translate-x-1" />
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-900/20 mb-4">
            <Briefcase className="h-10 w-10 text-purple-500" />
          </div>
          <p className="text-xl text-gray-400">No projects available yet.</p>
          <p className="text-sm text-gray-500 mt-2">Check back soon for updates!</p>
        </motion.div>
      )}
    </>
  );
};

export const ProjectsList = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <Suspense
          fallback={
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
              <p className="text-gray-400 mt-4">Loading projects...</p>
            </div>
          }
        >
          <ProjectsListContent />
        </Suspense>
      </div>
    </Layout>
  );
};
