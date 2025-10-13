import { Code, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Modal from '@/components/ui/modal';
import { projectsData } from '@/data/projects';

export default async function ProjectModal({ params }: { params: { id: string } }) {
  const { id } = await params;
  const project = projectsData.find((p) => p.id === id);

  if (!project) {
    notFound();
  }

  return (
    <Modal>
      <Card className="bg-transparent border-0">
        {project.imageUrl && (
          <div className="w-full h-64 relative mb-4">
            <Image
              src={project.imageUrl}
              alt={project.title}
              fill
              sizes="(max-width: 768px) 100vw, 600px"
              className="object-cover rounded-lg"
            />
          </div>
        )}
        <CardHeader className="p-0">
          <CardTitle className="text-3xl font-bold text-purple-300 mb-2">{project.title}</CardTitle>
          <p className="text-lg text-gray-400">Category: {project.category}</p>
        </CardHeader>
        <CardContent className="p-0 pt-6">
          <p className="text-base text-gray-300 mb-6">{project.description}</p>
          {project.tags && project.tags.length > 0 && (
            <div className="mb-6">
              <h4 className="text-md text-purple-400 mb-2 font-semibold">TAGS:</h4>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-sm bg-purple-700 text-purple-200 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-4">
            {project.projectUrl && (
              <Link href={project.projectUrl} target="_blank" rel="noopener noreferrer">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-purple-800 hover:bg-purple-700 border-purple-600 text-purple-200"
                >
                  View Live <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
            {project.repoUrl && (
              <Link href={project.repoUrl} target="_blank" rel="noopener noreferrer">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-200"
                >
                  View Code <Code className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}
