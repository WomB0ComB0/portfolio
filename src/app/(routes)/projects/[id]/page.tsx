import { projectsData } from '../../../../data/projects';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink, Code } from 'lucide-react';
import { notFound } from 'next/navigation';

export default function ProjectPage({ params }: { params: { id: string } }) {
  const project = projectsData.find(p => p.id === params.id);

  if (!project) {
    notFound();
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <Card className="bg-[#1E1E1E] border-purple-800">
          {project.imageUrl && (
            <div className="w-full h-96 relative">
              <Image
                src={project.imageUrl}
                alt={project.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover"
              />
            </div>
          )}
          <CardHeader className="p-6">
            <CardTitle className="text-3xl font-bold text-purple-300 mb-2">{project.title}</CardTitle>
            <p className="text-lg text-gray-400">Category: {project.category}</p>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-base text-gray-300 mb-6">{project.description}</p>
            {project.tags && project.tags.length > 0 && (
              <div className="mb-6">
                <h4 className="text-md text-purple-400 mb-2 font-semibold">TAGS:</h4>
                <div className="flex flex-wrap gap-2">
                  {project.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 text-sm bg-purple-700 text-purple-200 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-4">
              {project.projectUrl && (
                <Link href={project.projectUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="flex-1 bg-purple-800 hover:bg-purple-700 border-purple-600 text-purple-200">
                    View Live <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
              {project.repoUrl && (
                <Link href={project.repoUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="flex-1 bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-200">
                    View Code <Code className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
