import dynamic from 'next/dynamic';
import { getProjects } from '@/lib/sanity/api';
import { urlFor } from '@/lib/sanity/client';
import { constructMetadata } from '@/utils';

const ProjectDetail = dynamic(
  () =>
    import('@/app/(routes)/(main)/projects/_interface/project-detail').then(
      (mod) => mod.ProjectDetail,
    ),
  {
    ssr: true,
  },
);

export async function generateStaticParams() {
  try {
    const projects = await getProjects();
    return projects.map((project) => ({
      id: project._id,
    }));
  } catch (error) {
    console.error('Error generating static params:', error);
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const projects = await getProjects();
    const project = projects.find((p) => p._id === id);

    if (!project) {
      return constructMetadata({
        title: 'Project Not Found',
        description: 'The requested project could not be found',
      });
    }

    const imageUrl = project.image ? urlFor(project.image).width(1200).height(630).url() : '/opengraph-image.png';

    return constructMetadata({
      title: project.title,
      description: project.description,
      image: imageUrl,
    });
  } catch (error) {
    console.error('Error generating metadata:', error);
    return constructMetadata({
      title: 'Project',
      description: 'View project details',
    });
  }
}

const ProjectDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  return <ProjectDetail params={resolvedParams} />;
};

export default ProjectDetailPage;
