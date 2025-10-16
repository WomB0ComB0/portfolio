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

// API function exports
export {
  getCacheOptions,
  getCertifications,
  getExperiences,
  getFeaturedProjects,
  getProjectBySlug,
  getProjects,
  revalidateTags,
} from './api';
// Client exports
export {
  client,
  clientWithToken,
  sanityClient,
  sanityClientWithToken,
  sanityConfig,
  sanityFetch,
  sanityFetchWithToken,
  urlFor,
} from './client';

// Query exports
export {
  certificationByIdQuery,
  certificationsQuery,
  contentCountsQuery,
  experienceByIdQuery,
  experiencesQuery,
  featuredProjectsQuery,
  projectBySlugQuery,
  projectsQuery,
  skillCategoriesQuery,
} from './queries';
// Type exports
export type {
  Certification,
  Experience,
  Project,
  SanityDocument,
  SanityImage,
  SanityImageSource,
  SanitySlug,
  SkillCategory,
} from './types';
