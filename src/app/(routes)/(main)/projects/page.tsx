import { constructMetadata } from '@/utils';
import dynamic from 'next/dynamic';

const ProjectsList = dynamic(
  () =>
    import('@/app/(routes)/(main)/projects/_interface/projects-list').then(
      (mod) => mod.ProjectsList,
    ),
  {
    ssr: true,
  },
);

export const metadata = constructMetadata({
  title: 'Projects',
  description: 'Explore my portfolio of web development, machine learning, and software projects',
});

const ProjectsPage = () => {
  return <ProjectsList />;
};

export default ProjectsPage;
