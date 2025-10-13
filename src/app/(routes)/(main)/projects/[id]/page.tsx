import { constructMetadata } from '@/utils';
import dynamic from 'next/dynamic';
import { projectsData } from '@/data/projects';

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

export async function generateMetadata({ params }: { params: { id: string } }) {
  const project = projectsData.find((p) => p.id === params.id);

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

const ProjectDetailPage = ({ params }: { params: { id: string } }) => {
  return <ProjectDetail params={params} />;
};

export default ProjectDetailPage;
