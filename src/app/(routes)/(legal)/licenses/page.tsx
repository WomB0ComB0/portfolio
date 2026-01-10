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

import { constructMetadata } from '@/utils';
import dynamic from 'next/dynamic';
import type { JSX } from 'react';

/**
 * @constant Licenses
 * @description
 *      Dynamically imports the Licenses component, which displays open source and third-party license details for the portfolio site.
 *      Utilizes Next.js dynamic import for code-splitting and optimized loading in the legal licensure route.
 * @type {import('react').ComponentType}
 * @readonly
 * @public
 * @web
 * @throws {Error} Throws if the Licenses module fails to load or import.
 * @see https://nextjs.org/docs/pages/building-your-application/optimizing/dynamic-imports
 * @see https://github.com/WomB0ComB0/portfolio
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @example
 * // Usage in LicensesPage:
 * <Licenses />
 */
const Licenses = dynamic(
  () => import('@/app/(routes)/(legal)/licenses/_interface').then((mod) => mod.Licenses),
  { ssr: true },
);

/**
 * @constant metadata
 * @description
 *      Metadata object for the licenses page, contributing to SEO and social snippet previews.
 *      Contains display title and description for the /licenses legal route.
 * @type {import('next').Metadata}
 * @readonly
 * @public
 * @web
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-metadata
 */
export const metadata = constructMetadata({
  title: 'Licenses',
  description: 'Information about open source and third-party licenses.',
});

/**
 * @function LicensesPage
 * @description
 *      Top-level route component for serving the Licenses legal document screen in the portfolio.
 *      Solely responsible for mounting the dynamically-loaded Licenses informational component.
 * @returns {JSX.Element} The react element that renders the licenses legal content.
 * @throws {Error} Throws if the Licenses component fails to render.
 * @public
 * @web
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @see Licenses
 * @example
 * // Standard server-side page export:
 * export default function LicensesPage() {
 *   return <Licenses />;
 * }
 */
const LicensesPage = (): JSX.Element => {
  return <Licenses />;
};

LicensesPage.displayName = 'LicensesPage';
export default LicensesPage;
