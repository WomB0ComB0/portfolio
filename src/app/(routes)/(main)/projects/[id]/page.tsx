import dynamic from 'next/dynamic';
import { getProjects } from '@/lib/sanity/api';
import { urlFor } from '@/lib/sanity/client';
import { constructMetadata, logger } from '@/utils';

/**
 * ProjectDetail React component (dynamically imported).
 *
 * Renders the detail page content for a specific project given its id.
 *
 * @constant
 * @see https://nextjs.org/docs/pages/building-your-application/optimizing/dynamic-imports
 * @web
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 */
const ProjectDetail = dynamic(
  () =>
    import('@/app/(routes)/(main)/projects/_interface/project-detail').then(
      (mod) => mod.ProjectDetail,
    ),
  {
    ssr: true,
  },
);

/**
 * Generates static route parameters for project detail pages.
 *
 * Used by Next.js for static generation of project ID routes.
 *
 * @async
 * @function generateStaticParams
 * @returns {Promise<Array<{ id: string }>>} List of project id params for static generation.
 * @throws {Error} Throws on failure to fetch projects.
 * @example
 * const params = await generateStaticParams();
 * // [{ id: 'abc123' }, ...]
 * @web
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-static-params
 * @version 1.0.0
 */
export async function generateStaticParams() {
  try {
    const projects = await getProjects();
    return projects.map((project) => ({
      id: project._id,
    }));
  } catch (error) {
    logger.error('Error generating static params:', error);
    return [];
  }
}

/**
 * Generates Open Graph and SEO metadata for a specific project detail page.
 *
 * Utilizes the project id param to find details and construct page metadata.
 *
 * @async
 * @function generateMetadata
 * @param {{ params: Promise<{ id: string }> }} ctx - Context containing route parameters promise.
 * @returns {Promise<Record<string, any>>} The constructed metadata object for Next.js.
 * @throws {Error} Throws if metadata or project fails to load.
 * @example
 * const meta = await generateMetadata({ params: Promise.resolve({ id: 'xyz' }) });
 * @web
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-metadata
 * @version 1.0.0
 */
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

    const imageUrl = project.image
      ? urlFor(project.image).width(1200).height(630).url()
      : '/opengraph-image.png';

    return constructMetadata({
      title: project.title,
      description: project.description,
      image: imageUrl,
    });
  } catch (error) {
    logger.error('Error generating metadata:', error);
    return constructMetadata({
      title: 'Project',
      description: 'View project details',
    });
  }
}

/**
 * ProjectDetailPage - Server component to render a project's detail page.
 *
 * Fetches and resolves route parameters, and renders the {@link ProjectDetail} component.
 *
 * @async
 * @function ProjectDetailPage
 * @param {{ params: Promise<{ id: string }> }} props - Next.js route props with params promise.
 * @returns {Promise<JSX.Element>} Rendered ProjectDetail React component.
 * @throws {Error} Throws if params cannot be resolved or component fails to render.
 * @example
 * export default async function Page(props) {
 *   return <ProjectDetailPage {...props} />;
 * }
 * @web
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @readonly
 * @version 1.0.0
 */
const ProjectDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  return <ProjectDetail params={resolvedParams} />;
};

export default ProjectDetailPage;
