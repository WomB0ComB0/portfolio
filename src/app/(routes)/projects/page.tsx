'use client';

import { useState, useMemo } from 'react';
import { ProjectItem } from '../../../types/projects';
import { projectsData } from '../../../data/projects';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink, Search, Briefcase, Code } from 'lucide-react'; // Added Code for repo

export default function ProjectsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string | 'all'>('all');

  const categories = useMemo(() => {
    const allCategories = new Set(projectsData.map(p => p.category));
    return ['all', ...Array.from(allCategories)];
  }, []);

  const tags = useMemo(() => {
    const allTags = new Set(projectsData.flatMap(p => p.tags));
    return ['all', ...Array.from(allTags)];
  }, []);

  const filteredProjects = useMemo(() => {
    return projectsData.filter(project => {
      const matchesCategory = selectedCategory === 'all' || project.category === selectedCategory;
      const matchesTag = selectedTag === 'all' || project.tags.includes(selectedTag);
      const matchesSearch = searchTerm === '' ||
        project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesCategory && matchesTag && matchesSearch;
    });
  }, [searchTerm, selectedCategory, selectedTag]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
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
              <label htmlFor="search" className="block text-sm font-medium text-purple-300 mb-1">Search Projects</label>
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
              <label htmlFor="category" className="block text-sm font-medium text-purple-300 mb-1">Filter by Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id="category" className="bg-[#2a2a2a] border-purple-700 text-gray-200">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent className="bg-[#2a2a2a] border-purple-700 text-gray-200">
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat} className="hover:bg-purple-700">
                      {cat === 'all' ? 'All Categories' : cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="tag" className="block text-sm font-medium text-purple-300 mb-1">Filter by Tag</label>
              <Select value={selectedTag} onValueChange={setSelectedTag}>
                <SelectTrigger id="tag" className="bg-[#2a2a2a] border-purple-700 text-gray-200">
                  <SelectValue placeholder="Select Tag" />
                </SelectTrigger>
                <SelectContent className="bg-[#2a2a2a] border-purple-700 text-gray-200">
                  {tags.map(tag => (
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
              <Card key={project.id} className="bg-[#1E1E1E] border-purple-800 rounded-xl overflow-hidden flex flex-col hover:shadow-xl hover:shadow-purple-500/40 transition-shadow duration-300">
                {project.imageUrl && (
                  <div className="w-full h-48 relative">
                    <Image
                      src={project.imageUrl}
                      alt={project.title}
                      layout="fill"
                      className="object-cover"
                    />
                  </div>
                )}
                <CardHeader className="p-6">
                  <CardTitle className="text-xl font-semibold text-purple-300 mb-1">{project.title}</CardTitle>
                  <p className="text-sm text-gray-400">Category: {project.category}</p>
                </CardHeader>
                <CardContent className="p-6 flex-grow">
                  <p className="text-sm text-gray-300 mb-4 line-clamp-4">{project.description}</p>
                  {project.tags && project.tags.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs text-purple-400 mb-1 font-semibold">TAGS:</h4>
                      <div className="flex flex-wrap gap-2">
                        {project.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 text-xs bg-purple-700 text-purple-200 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
                <div className="p-6 border-t border-purple-700 mt-auto">
                  <div className="flex gap-4">
                    {project.projectUrl && (
                      <Link href={project.projectUrl} passHref legacyBehavior>
                        <Button variant="outline" size="sm" className="flex-1 bg-purple-800 hover:bg-purple-700 border-purple-600 text-purple-200">
                          View Live <ExternalLink className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                    {project.repoUrl && (
                      <Link href={project.repoUrl} passHref legacyBehavior>
                        <Button variant="outline" size="sm" className="flex-1 bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-200">
                          View Code <Code className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                   {!project.projectUrl && !project.repoUrl && (
                    <p className="text-xs text-center text-gray-500">No external links available.</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-xl text-gray-400">No projects found matching your criteria.</p>
            <Button variant="link" onClick={() => { setSearchTerm(''); setSelectedCategory('all'); setSelectedTag('all'); }} className="text-purple-400 hover:text-purple-300 mt-2">
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
