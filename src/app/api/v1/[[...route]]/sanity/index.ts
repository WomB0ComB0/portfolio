import { createErrorHandler } from '@/app/api/_elysia/shared/middleware';
import { Elysia } from 'elysia';
import {
  getCertificationsHandler,
  getExperiencesHandler,
  getFeaturedProjectsHandler,
  getProjectsHandler,
} from './handlers';
import { sanityCacheHeaders, sanityMiddleware } from './middleware';

// Create error handlers for each endpoint
const handleExperiencesError = createErrorHandler({
  context: 'fetch experiences from Sanity',
  includeErrorDetails: false,
});

const handleProjectsError = createErrorHandler({
  context: 'fetch projects from Sanity',
  includeErrorDetails: false,
});

const handleFeaturedProjectsError = createErrorHandler({
  context: 'fetch featured projects from Sanity',
  includeErrorDetails: false,
});

const handleCertificationsError = createErrorHandler({
  context: 'fetch certifications from Sanity',
  includeErrorDetails: false,
});

/**
 * Sanity API Routes
 * Provides endpoints for fetching CMS data
 */
export const sanityRoutes = new Elysia({ prefix: '/sanity' })
  .onBeforeHandle(sanityMiddleware)
  .onAfterHandle(({ set }) => {
    Object.assign(set.headers, sanityCacheHeaders());
  })
  .get('/experiences', async ({ set }) => {
    try {
      return await getExperiencesHandler();
    } catch (error) {
      set.status = 500;
      return handleExperiencesError(error);
    }
  })
  .get('/projects', async ({ set }) => {
    try {
      return await getProjectsHandler();
    } catch (error) {
      set.status = 500;
      return handleProjectsError(error);
    }
  })
  .get('/projects/featured', async ({ set }) => {
    try {
      return await getFeaturedProjectsHandler();
    } catch (error) {
      set.status = 500;
      return handleFeaturedProjectsError(error);
    }
  })
  .get('/certifications', async ({ set }) => {
    try {
      return await getCertificationsHandler();
    } catch (error) {
      set.status = 500;
      return handleCertificationsError(error);
    }
  });

