
'use client';

import Layout from '@/components/layout/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSanityProjects } from '@/hooks';
import { urlFor } from '@/lib/sanity/client';
import { ArrowLeft, Code, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { type JSX, Suspense } from 'react';

/**
 * Props for {@link ProjectDetail} component that receives route parameters.
 *
 * @interface ProjectDetailProps
 * @property {object} params - Route parameters.
 * @property {string} params.id - The ID of the project to display in detail.
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @readonly
 */
interface ProjectDetailProps {
  params: { id: string };
}

/**
 * Project detail content section.
 *
 * Renders the full details for a given project by ID, including gallery, description, and action buttons.
 *
 * @function
 * @param {object} props - The component props.
 * @param {string} props.id - The Sanity document id for the project.
 * @returns {JSX.Element} The rendered project detail interface.
 * @throws {Error} If the project is not found, a not-found UI is rendered.
 * @example
 * <ProjectDetailContent id="abc123" />
 * @web
 * @see ProjectDetail
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 */
const ProjectDetailContent = ({ id }: { id: string }): JSX.Element => {
  const { data: projects } = useSanityProjects();
  const project = (projects as any[]).find((p: any) => p._id === id);

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-purple-300 mb-4">Project Not Found</h1>
        <p className="text-gray-400 mb-8">The project you are looking for does not exist.</p>
        <Button
          asChild
          variant="outline"
          className="text-purple-300 border-purple-700 hover:bg-purple-800"
        >
          <Link href="/projects">
            <ArrowLeft className="mr-2 h-5 w-5" /> Back to Projects
          </Link>
        </Button>
      </div>
    );
  }

  const dateRange = project.endDate
    ? `${new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
    : `Started ${new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;

  return (
    <Card className="bg-[#1E1E1E] border-purple-800">
      {project.image && (
        <div className="w-full h-96 relative">
          <Image
            src={urlFor(project.image).width(1200).height(384).url()}
            alt={project.image.alt || project.title}
            width={1200}
            height={384}
            className="object-cover w-full"
          />
        </div>
      )}
      <CardHeader className="p-6">
        <CardTitle className="text-3xl font-bold text-purple-300 mb-2">{project.title}</CardTitle>
        <div className="flex gap-4 text-sm text-gray-400">
          <p>Category: {project.category}</p>
          <p>Status: {project.status}</p>
        </div>
        <p className="text-sm text-gray-500">{dateRange}</p>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div>
          <h3 className="text-xl font-semibold text-purple-300 mb-2">Description</h3>
          <p className="text-base text-gray-300">{project.description}</p>
        </div>

        {project.longDescription && (
          <div>
            <h3 className="text-xl font-semibold text-purple-300 mb-2">Detailed Overview</h3>
            <p className="text-base text-gray-300 whitespace-pre-line">{project.longDescription}</p>
          </div>
        )}

        {project.technologies && project.technologies.length > 0 && (
          <div>
            <h3 className="text-xl font-semibold text-purple-300 mb-2">Technologies</h3>
            <div className="flex flex-wrap gap-2">
              {project.technologies.map((tech: string) => (
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

        {project.images && project.images.length > 0 && (
          <div>
            <h3 className="text-xl font-semibold text-purple-300 mb-2">Gallery</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {project.images.map((img: any, index: number) => (
                <div key={index} className="relative h-64">
                  <Image
                    src={urlFor(img).width(600).height(256).url()}
                    alt={img.alt || `${project.title} screenshot ${index + 1}`}
                    width={600}
                    height={256}
                    className="object-cover rounded-lg"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4 pt-4">
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

        <div className="pt-6 border-t border-purple-700">
          <Button
            asChild
            variant="outline"
            className="text-purple-300 border-purple-700 hover:bg-purple-800"
          >
            <Link href="/projects">
              <ArrowLeft className="mr-2 h-5 w-5" /> Back to Projects
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Project detail page for the <b>portfolio</b> project.
 *
 * Renders the full detail view for a project specified via route parameters,
 * including a loading suspense fallback and layout wrapping.
 *
 * @function
 * @param {ProjectDetailProps} props - Parameters including the project id from Next.js routing.
 * @returns {JSX.Element} The rendered project details page within the layout.
 * @throws {Error} If the project fails to load, a fallback UI is rendered.
 * @web
 * @see https://github.com/WomB0ComB0/portfolio
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @public
 * @example
 * <ProjectDetail params={{ id: "abc123" }} />
 */
export const ProjectDetail = ({ params }: ProjectDetailProps): JSX.Element => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <Suspense
          fallback={
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
              <p className="text-gray-400 mt-4">Loading project details...</p>
            </div>
          }
        >
          <ProjectDetailContent id={params.id} />
        </Suspense>
      </div>
    </Layout>
  );
};

