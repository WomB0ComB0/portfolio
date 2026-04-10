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
 * distributed under the Licens1e is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import dynamic from 'next/dynamic';
import type { JSX } from 'react';
import { constructMetadata } from '@/utils';

/**
 * @constant Privacy
 * @description
 *      Dynamically imports the Privacy component presenting the privacy policy for the portfolio site.
 *      Utilizes Next.js dynamic import for code-splitting and optimized loading in the privacy policy legal route.
 * @type {import('react').ComponentType}
 * @readonly
 * @web
 * @public
 * @throws {Error} Throws if the Privacy module fails to load.
 * @see https://nextjs.org/docs/pages/building-your-application/optimizing/dynamic-imports
 * @see https://github.com/WomB0ComB0/portfolio
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @example
 * // Usage in PrivacyPage:
 * <Privacy />
 */
const Privacy = dynamic(
  () => import('@/app/(routes)/(legal)/privacy/_interface').then((mod) => mod.Privacy),
  { ssr: true },
);

/**
 * @constant metadata
 * @description
 *      Metadata for the privacy policy page, impacting SEO and page headers.
 *      Contains display title and description for the privacy route.
 * @type {import('next').Metadata}
 * @readonly
 * @web
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-metadata
 */
export const metadata = constructMetadata({
  title: 'Privacy Policy',
  description: 'Details about privacy and data handling on this site.',
});

/**
 * @function PrivacyPage
 * @description
 *      Top-level route component serving the Privacy Policy legal document screen for the portfolio.
 *      Solely responsible for mounting the dynamically-loaded Privacy policy informational component.
 * @returns {JSX.Element} The React element that renders the privacy policy legal content.
 * @throws {Error} Throws if the Privacy component fails to render.
 * @web
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @see Privacy
 * @example
 * // Standard server-side page export:
 * export default function PrivacyPage() {
 *   return <Privacy />;
 * }
 */
const PrivacyPage = (): JSX.Element => {
  return <Privacy />;
};

PrivacyPage.displayName = 'PrivacyPage';
export default PrivacyPage;
