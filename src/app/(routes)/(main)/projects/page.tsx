import dynamic from 'next/dynamic';
import { constructMetadata } from '@/utils';

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

/**
 * Projects page component.
 * Renders the list of projects showcasing the portfolio.
 *
 * @returns {JSX.Element} The projects page.
 * @author Mike Odnis
 * @version 1.0.0
 */
const ProjectsPage = () => {
  return <ProjectsList />;
};

export default ProjectsPage;
