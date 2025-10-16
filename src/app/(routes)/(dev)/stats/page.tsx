import dynamic from 'next/dynamic';
import type { JSX } from 'react';
import { constructMetadata } from '@/utils';

/**
 * @readonly
 * @description
 *      Dynamically imports the Stats component for the statistics dashboard route,
 *      enabling code splitting and server-side rendering (SSR).
 *
 * @returns {React.ComponentType} A dynamic React component for displaying stats.
 *
 * @throws {Error} Throws if importing the Stats module fails.
 *
 * @see https://nextjs.org/docs/pages/building-your-application/optimizing/dynamic-imports
 * @web
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @example
 * // Usage within the page:
 * <Stats />
 */
const Stats = dynamic(
  () => import('@/app/(routes)/(dev)/stats/_interface/stats').then((mod) => mod.Stats),
  {
    ssr: true,
  },
);

/**
 * @readonly
 * @type {import('next').Metadata}
 * @description
 *      Page metadata for the Stats page, including title and description,
 *      for SEO and enhanced snippet in web crawlers.
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-metadata
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 */
export const metadata = constructMetadata({
  title: 'Stats',
  description: 'View my live stats, Discord status, and activity metrics',
});

/**
 * @function StatsPage
 * @description
 *      Top-level page component for rendering the personal statistics dashboard.
 *      Delegates all presentational and data logic to the dynamically loaded Stats module.
 *
 * @returns {JSX.Element} A React element rendering the statistics dashboard.
 *
 * @web
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @example
 * // Server component render:
 * <StatsPage />
 */
const StatsPage = (): JSX.Element => {
  return <Stats />;
};

export default StatsPage;
