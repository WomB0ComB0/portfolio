import dynamic from 'next/dynamic';
import { projectsData } from '@/data/projects';
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
  return projectsData.map((project) => ({
    id: project.id,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = projectsData.find((p) => p.id === id);

  if (!project) {
    return constructMetadata({
      title: 'Project Not Found',
      description: 'The requested project could not be found',
    });
  }

  return constructMetadata({
    title: project.title,
    description: project.description,
    image: project.imageUrl || '/opengraph-image.png',
  });
}

const ProjectDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  return <ProjectDetail params={resolvedParams} />;
};

export default ProjectDetailPage;
