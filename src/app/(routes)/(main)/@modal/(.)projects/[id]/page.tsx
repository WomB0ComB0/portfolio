import { Code, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Modal from '@/components/ui/modal';
import { getProjects } from '@/lib/sanity/api';
import { urlFor } from '@/lib/sanity/client';

export default async function ProjectModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let project;
  try {
    const projects = await getProjects();
    project = projects.find((p) => p._id === id);
  } catch (error) {
    console.error('Error fetching project:', error);
  }

  if (!project) {
    notFound();
  }

  return (
    <Modal>
      <Card className="bg-transparent border-0">
        {project.image && (
          <div className="w-full h-64 relative mb-4">
            <Image
              src={urlFor(project.image).width(600).height(256).url()}
              alt={project.image.alt || project.title}
              width={600}
              height={256}
              className="object-cover rounded-lg w-full"
            />
          </div>
        )}
        <CardHeader className="p-0">
          <CardTitle className="text-3xl font-bold text-purple-300 mb-2">{project.title}</CardTitle>
          <div className="flex gap-4 text-sm text-gray-400">
            <p>Category: {project.category}</p>
            <p>Status: {project.status}</p>
          </div>
        </CardHeader>
        <CardContent className="p-0 pt-6">
          <p className="text-base text-gray-300 mb-6">{project.description}</p>

          {project.longDescription && (
            <div className="mb-6">
              <h4 className="text-md text-purple-400 mb-2 font-semibold">Overview:</h4>
              <p className="text-sm text-gray-300 whitespace-pre-line">{project.longDescription}</p>
            </div>
          )}

          {project.technologies && project.technologies.length > 0 && (
            <div className="mb-6">
              <h4 className="text-md text-purple-400 mb-2 font-semibold">TECHNOLOGIES:</h4>
              <div className="flex flex-wrap gap-2">
                {project.technologies.map((tech) => (
                  <span
                    key={tech}
                    className="px-3 py-1 text-sm bg-purple-700 text-purple-200 rounded-full"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-4">
            {project.liveUrl && (
              <Link href={project.liveUrl} target="_blank" rel="noopener noreferrer">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-purple-800 hover:bg-purple-700 border-purple-600 text-purple-200"
                >
                  View Live <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
            {project.githubUrl && (
              <Link href={project.githubUrl} target="_blank" rel="noopener noreferrer">
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
