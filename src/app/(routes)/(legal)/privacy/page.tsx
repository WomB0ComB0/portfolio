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

import type { JSX } from 'react';
import { Privacy } from '@/app/(routes)/(legal)/privacy/_interface';
import { constructMetadata } from '@/utils';

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
  path: '/privacy',
});

/**
 * @function PrivacyPage
 * @description
 *      Renders the privacy policy. Both the page and the policy are server components, so the
 *      policy text is in the server HTML; only interactive leaves such as MagicCard and the
 *      Cookie Policy link hydrate.
 * @returns {JSX.Element} The privacy policy.
 * @web
 * @public
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @see Privacy
 */
const PrivacyPage = (): JSX.Element => {
  return <Privacy />;
};

PrivacyPage.displayName = 'PrivacyPage';
export default PrivacyPage;
