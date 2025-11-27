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

import { Elysia, StatusMap } from 'elysia';
import { createErrorHandler } from '@/app/api/_elysia/shared/middleware';
import {
  getCertificationsHandler,
  getExperiencesHandler,
  getFeaturedProjectsHandler,
  getPlacesHandler,
  getProjectsHandler,
  getResumeHandler,
} from './handlers';
import { sanityCacheHeaders, sanityMiddleware } from './middleware';

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

const handlePlacesError = createErrorHandler({
  context: 'fetch places from Sanity',
  includeErrorDetails: false,
});

const handleResumeError = createErrorHandler({
  context: 'fetch resume from Sanity',
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
  .get('/resume', async ({ set }) => {
    try {
      return await getResumeHandler();
    } catch (error) {
      set.status = StatusMap['Internal Server Error'];
      return handleResumeError(error);
    }
  })
  .get('/experiences', async ({ set }) => {
    try {
      return await getExperiencesHandler();
    } catch (error) {
      set.status = StatusMap['Internal Server Error'];
      return handleExperiencesError(error);
    }
  })
  .get('/projects', async ({ set }) => {
    try {
      return await getProjectsHandler();
    } catch (error) {
      set.status = StatusMap['Internal Server Error'];
      return handleProjectsError(error);
    }
  })
  .get('/projects/featured', async ({ set }) => {
    try {
      return await getFeaturedProjectsHandler();
    } catch (error) {
      set.status = StatusMap['Internal Server Error'];
      return handleFeaturedProjectsError(error);
    }
  })
  .get('/certifications', async ({ set }) => {
    try {
      return await getCertificationsHandler();
    } catch (error) {
      set.status = StatusMap['Internal Server Error'];
      return handleCertificationsError(error);
    }
  })
  .get('/places', async ({ set }) => {
    try {
      return await getPlacesHandler();
    } catch (error) {
      set.status = StatusMap['Internal Server Error'];
      return handlePlacesError(error);
    }
  })
  .get('/resume', async ({ set }) => {
    try {
      return await getResumeHandler();
    } catch (error) {
      set.status = StatusMap['Internal Server Error'];
      return handleResumeError(error);
    }
  });
