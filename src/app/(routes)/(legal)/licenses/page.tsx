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
import { Licenses } from '@/app/(routes)/(legal)/licenses/_interface';
import { constructMetadata } from '@/utils';

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
  path: '/licenses',
});

/**
 * @function LicensesPage
 * @description
 *      Renders the content licences. Both the page and the licences are server components, so the
 *      text is in the server HTML; only interactive leaves such as MagicCard hydrate.
 * @returns {JSX.Element} The licences page content.
 * @public
 * @web
 * @author Mike Odnis <https://github.com/WomB0ComB0>
 * @version 1.0.0
 * @see Licenses
 */
const LicensesPage = (): JSX.Element => {
  return <Licenses />;
};

LicensesPage.displayName = 'LicensesPage';
export default LicensesPage;
