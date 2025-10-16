
import { getExperiences } from '@/lib/sanity/api';
import { constructMetadata, logger } from '@/utils';
import dynamic from 'next/dynamic';

/**
 * Dynamically imports the ExperienceDetail component for SSR.
 *
 * @readonly
 * @type {import('react').ComponentType<{ params: { id: string } }>}
 * @web
 * @author Mike Odnis
 * @see https://nextjs.org/docs/pages/api-reference/functions/dynamic
 * @version 1.0.0
 */
const ExperienceDetail = dynamic(
  () =>
    import('@/app/(routes)/(main)/experience/_interface/experience-detail').then(
      (mod) => mod.ExperienceDetail,
    ),
  {
    ssr: true,
  },
);

/**
 * Generates the static parameters for dynamic routing in the Experience detail page.
 *
 * Fetches all experience entries from the Sanity backend and constructs id params for static generation.
 *
 * @function
 * @async
 * @public
 * @returns {Promise<{id: string}[]>} Array of params objects containing experience IDs.
 * @throws {Error} Throws error if fetching experiences fails.
 * @example
 * const params = await generateStaticParams();
 * // params: [{ id: 'abc123' }, { id: 'def456' }]
 * @web
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-static-params
 * @version 1.0.0
 */
export async function generateStaticParams() {
  try {
    const experiences = await getExperiences();
    return experiences.map((exp) => ({
      id: exp._id,
    }));
  } catch (error) {
    logger.error('Error generating static params:', error);
    return [];
  }
}

/**
 * Generates metadata for the Experience detail page for SEO and meta tags.
 *
 * Attempts to resolve the experience by id and propagate metadata for the experience,
 * or provides fallback metadata if not found or on error.
 *
 * @function
 * @async
 * @public
 * @param {{ params: Promise<{ id: string }> }} context - The params object containing the experience id as a Promise.
 * @returns {Promise<Record<string, any>>} A metadata object suitable for Next.js SEO/meta rendering.
 * @throws {Error} Throws error if fetching experiences fails or unexpected issues occur.
 * @example
 * const meta = await generateMetadata({ params: Promise.resolve({ id: 'abc123' }) });
 * @web
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-metadata
 * @version 1.0.0
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const experiences = await getExperiences();
    const experienceItem = experiences.find((exp) => exp._id === id);

    if (!experienceItem) {
      return constructMetadata({
        title: 'Experience Not Found',
        description: 'The requested experience item could not be found',
      });
    }

    return constructMetadata({
      title: `${experienceItem.position} at ${experienceItem.company}`,
      description: experienceItem.description,
    });
  } catch (error) {
    logger.error('Error generating metadata:', error);
    return constructMetadata({
      title: 'Experience',
      description: 'View professional experience details',
    });
  }
}

/**
 * Renders the detail page for a specific work experience entry.
 *
 * Resolves the Next.js dynamic route parameter and passes it to the dynamic ExperienceDetail component.
 *
 * @function
 * @async
 * @public
 * @param {{ params: Promise<{ id: string }> }} props - The page props containing dynamic route params as a Promise.
 * @returns {Promise<JSX.Element>} The JSX for the Experience Detail view.
 * @throws {Error} Throws if params cannot be resolved.
 * @example
 * <ExperienceDetailPage params={Promise.resolve({ id: 'abc123' })} />
 * @web
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/page
 * @version 1.0.0
 */
const ExperienceDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  return <ExperienceDetail params={resolvedParams} />;
};

export default ExperienceDetailPage;

