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

// Standard React Query hooks
export {
  useExperiences,
  useExperience,
  useProjects,
  useProject,
  useFeaturedProjects,
  useCertifications,
} from './use-sanity-query';

// Suspense-based hooks
export {
  useSanityExperiences,
  useSanityProjects,
  useSanityFeaturedProjects,
  useSanityCertifications,
} from './use-sanity-suspense';

// Declarative DataLoader components
export { SanityDataLoader } from './data-loaders';

// Schemas for external use
export {
  ExperienceSchema,
  ProjectSchema,
  CertificationSchema,
  ExperiencesSchema,
  ProjectsSchema,
  CertificationsSchema,
} from './schemas';

// Configuration utilities
export {
  SANITY_API_BASE,
  SANITY_CACHE_CONFIG,
  SANITY_FETCHER_OPTIONS,
  SANITY_ENDPOINTS,
  getSanityEndpoint,
  createSanityQueryKey,
  createDataLoaderOptions,
  type SanityEndpoint,
} from './config';
