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
const NotFoundPage = () => {
  return <NotFound />;
};

export default NotFoundPage;
