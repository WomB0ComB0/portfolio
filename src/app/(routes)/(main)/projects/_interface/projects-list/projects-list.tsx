'use client';

import { Briefcase, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSanityProjects } from '@/hooks';
import { urlFor } from '@/lib/sanity/client';

const ProjectsListContent = () => {
  const { data: projects } = useSanityProjects();
  const projectsList = projects as any[];
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string | 'all'>('all');

  const categories = useMemo(() => {
    if (!projectsList) return ['all'];
    const allCategories = new Set(projectsList.map((p) => p.category));
    return ['all', ...Array.from(allCategories)];
  }, [projectsList]);

  const tags = useMemo(() => {
    if (!projectsList) return ['all'];
    const allTags = new Set(projectsList.flatMap((p) => p.technologies));
    return ['all', ...Array.from(allTags)];
  }, [projectsList]);

  const filteredProjects = useMemo(() => {
    if (!projectsList) return [];
    return projectsList.filter((project) => {
      const matchesCategory = selectedCategory === 'all' || project.category === selectedCategory;
      const matchesTag =
        selectedTag === 'all' || project.technologies.includes(selectedTag);
      const matchesSearch =
        searchTerm === '' ||
        project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.technologies.some((tech: string) => tech.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesCategory && matchesTag && matchesSearch;
    });
  }, [projectsList, searchTerm, selectedCategory, selectedTag]);

  return (
    <>
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-purple-300 flex items-center justify-center">
          <Briefcase className="mr-3 h-10 w-10" /> Projects Showcase
        </h1>
        <p className="text-lg text-gray-400 mt-2">
          Explore a collection of my work, from web development to machine learning.
        </p>
      </header>

      {/* Filters Section */}
      <Card className="mb-8 bg-[#1E1E1E] border-purple-800 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-purple-300 mb-1">
              Search Projects
            </label>
            <div className="relative">
              <Input
                id="search"
                type="text"
                placeholder="Enter keywords, title, or tag..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#2a2a2a] border-purple-700 text-gray-200 pl-10"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-purple-300 mb-1">
              Filter by Category
            </label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger
                id="category"
                className="bg-[#2a2a2a] border-purple-700 text-gray-200"
              >
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent className="bg-[#2a2a2a] border-purple-700 text-gray-200">
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat} className="hover:bg-purple-700">
                    {cat === 'all' ? 'All Categories' : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="tag" className="block text-sm font-medium text-purple-300 mb-1">
              Filter by Tag
            </label>
            <Select value={selectedTag} onValueChange={setSelectedTag}>
              <SelectTrigger id="tag" className="bg-[#2a2a2a] border-purple-700 text-gray-200">
                <SelectValue placeholder="Select Tag" />
              </SelectTrigger>
              <SelectContent className="bg-[#2a2a2a] border-purple-700 text-gray-200">
                {tags.map((tag) => (
                  <SelectItem key={tag} value={tag} className="hover:bg-purple-700">
                    {tag === 'all' ? 'All Tags' : tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Projects Grid */}
      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((project) => (
            <Link key={project._id} href={`/projects/${project._id}`} scroll={false}>
              <Card className="bg-[#1E1E1E] border-purple-800 rounded-xl overflow-hidden flex flex-col hover:shadow-xl hover:shadow-purple-500/40 transition-shadow duration-300 h-full">
                {project.image && (
                  <div className="w-full h-48 relative">
                    <Image
                      src={urlFor(project.image).width(400).height(192).url()}
                      alt={project.image.alt || project.title}
                      width={400}
                      height={192}
                      className="object-cover"
                    />
                  </div>
                )}
                <CardHeader className="p-6">
                  <CardTitle className="text-xl font-semibold text-purple-300 mb-1">
                    {project.title}
                  </CardTitle>
                  <p className="text-sm text-gray-400">Category: {project.category}</p>
                  <p className="text-xs text-gray-500">Status: {project.status}</p>
                </CardHeader>
                <CardContent className="p-6 flex-grow">
                  <p className="text-sm text-gray-300 mb-4 line-clamp-4">{project.description}</p>
                  {project.technologies && project.technologies.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs text-purple-400 mb-1 font-semibold">
                        TECHNOLOGIES:
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {project.technologies.map((tech: string) => (
                          <span
                            key={tech}
                            className="px-2 py-0.5 text-xs bg-purple-700 text-purple-200 rounded-full"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
                <div className="p-6 border-t border-purple-700 mt-auto">
                  <p className="text-xs text-center text-purple-400">Click to view details</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-xl text-gray-400">No projects found matching your criteria.</p>
          <Button
            variant="link"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('all');
              setSelectedTag('all');
            }}
            className="text-purple-400 hover:text-purple-300 mt-2"
          >
            Clear Filters
          </Button>
        </div>
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
