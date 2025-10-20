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

/**
 * @fileoverview 404 Not Found page component and metadata configuration
 * @module NotFoundPage
 */

import { NotFound } from '@/app/_client';
import { constructMetadata } from '@/utils';

/**
 * Metadata configuration for 404 page using constructMetadata utility
 * @type {Object} Metadata object containing title and description
 * @property {string} title - Page title set to '404'
 * @property {string} description - Page description indicating page does not exist
 */
export const metadata = constructMetadata({
  title: '404',
  description: 'This page does not exist',
});

/**
 * NotFoundPage component that renders the 404 error page
 * @function NotFoundPage
 * @returns {React.JSX.Element} Rendered NotFound component
 */
export const NotFoundPage = () => {
  return <NotFound />;
};
NotFoundPage.displayName = 'NotFoundPage';
export default NotFoundPage;
