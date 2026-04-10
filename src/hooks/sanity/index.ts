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
 * @fileoverview Centralized exports for all Sanity data fetching hooks
 *
 * This file provides a clean API for importing Sanity hooks throughout
 * the application. All hooks are organized by their usage pattern:
 * - Standard React Query hooks (useExperiences, useProjects, etc.)
 * - Suspense-based hooks (useSanityExperiences, useSanityProjects, etc.)
 * - Declarative DataLoader components (SanityDataLoader.Experiences, etc.)
 *
 * @example Standard hooks
 * ```tsx
 * import { useExperiences } from '@/hooks/sanity';
 *
 * function Component() {
 *   const { data, isLoading, error } = useExperiences();
 *   // ...
 * }
 * ```
 *
 * @example Suspense hooks
 * ```tsx
 * import { useSanityExperiences } from '@/hooks/sanity';
 *
 * function Component() {
 *   const { data } = useSanityExperiences();
 *   return <div>{data.map(...)}</div>;
 * }
 *
 * // Wrap with Suspense
 * <Suspense fallback={<Loader />}>
 *   <Component />
 * </Suspense>
 * ```
 *
 * @example DataLoader components
 * ```tsx
 * import { SanityDataLoader } from '@/hooks/sanity';
 *
 * <SanityDataLoader.Experiences>
 *   {(experiences) => experiences.map(...)}
 * </SanityDataLoader.Experiences>
 * ```
 */

// Configuration utilities
export {
  createDataLoaderOptions,
  createSanityQueryKey,
  getSanityEndpoint,
  SANITY_API_BASE,
  SANITY_CACHE_CONFIG,
  SANITY_ENDPOINTS,
  SANITY_FETCHER_OPTIONS,
  type SanityEndpoint,
} from './config';
// Declarative DataLoader components
export { SanityDataLoader } from './data-loaders';
// Schemas for external use
export {
  CertificationSchema,
  CertificationsSchema,
  ExperienceSchema,
  ExperiencesSchema,
  ProjectSchema,
  ProjectsSchema,
  type Resume,
  ResumeSchema,
} from './schemas';
// Standard React Query hooks
// Suspense-based hooks
export {
  useSanityCertifications,
  useSanityExperiences,
  useSanityFeaturedProjects,
  useSanityProjects,
  useSanityResume,
} from './use-sanity-suspense';
