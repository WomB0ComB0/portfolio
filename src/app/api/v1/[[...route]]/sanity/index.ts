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

import { Elysia } from 'elysia';
import {
  getArticles,
  getCertifications,
  getExperiences,
  getFeaturedProjects,
  getPlaces,
  getPresentations,
  getProjects,
  getResume,
} from '@/lib/sanity/api';
import { loadTalks, loadYoutubeVideos } from './handlers';
import { sanityMiddleware } from './middleware';
import { sanityRoute } from './serve';

// Each route sets its own headers (serve.ts): only real answers get a public cache header.
const resume = sanityRoute({
  key: 'resume',
  context: 'fetch resume from Sanity',
  load: getResume,
  notFoundMessage: 'No active resume',
});
const experiences = sanityRoute({
  key: 'experiences',
  context: 'fetch experiences from Sanity',
  load: getExperiences,
});
const projects = sanityRoute({
  key: 'projects',
  context: 'fetch projects from Sanity',
  load: getProjects,
});
const featuredProjects = sanityRoute({
  key: 'featured-projects',
  context: 'fetch featured projects from Sanity',
  load: getFeaturedProjects,
});
const certifications = sanityRoute({
  key: 'certifications',
  context: 'fetch certifications from Sanity',
  load: getCertifications,
});
const places = sanityRoute({
  key: 'places',
  context: 'fetch places from Sanity',
  load: getPlaces,
});
const presentations = sanityRoute({
  key: 'presentations',
  context: 'fetch presentations from Sanity',
  load: getPresentations,
});
const talks = sanityRoute({
  key: 'talks',
  context: 'fetch talks from Sanity',
  load: loadTalks,
});
const articles = sanityRoute({
  key: 'articles',
  context: 'fetch articles from Sanity',
  load: getArticles,
});
const videos = sanityRoute({
  key: 'videos',
  context: 'fetch YouTube videos from Sanity',
  load: loadYoutubeVideos,
});

/**
 * Sanity API Routes
 * Provides endpoints for fetching CMS data
 */
export const sanityRoutes = new Elysia({ prefix: '/sanity' })
  .onBeforeHandle(sanityMiddleware)
  .get('/resume', ({ set }) => resume(set))
  .get('/experiences', ({ set }) => experiences(set))
  .get('/projects', ({ set }) => projects(set))
  .get('/projects/featured', ({ set }) => featuredProjects(set))
  .get('/certifications', ({ set }) => certifications(set))
  .get('/places', ({ set }) => places(set))
  .get('/presentations', ({ set }) => presentations(set))
  .get('/talks', ({ set }) => talks(set))
  .get('/articles', ({ set }) => articles(set))
  .get('/videos', ({ set }) => videos(set));
