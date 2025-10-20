/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
export const StatsPage = (): JSX.Element => {
  return <Stats />;
};
StatsPage.displayName = 'StatsPage';
export default StatsPage;
