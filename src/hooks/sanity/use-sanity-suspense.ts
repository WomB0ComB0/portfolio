/**
 * @fileoverview Suspense-based hooks for Sanity data using useDataLoader
 *
 * Modern Suspense-based data loading with Effect Schema validation.
 * Automatically handles loading states via React Suspense boundaries.
 *
 * @example
 * ```tsx
 * function ExperienceList() {
 *   const { data } = useSanityExperiences();
 *   return <div>{data.map(...)}</div>;
 * }
 *
 * // Wrap in Suspense boundary
 * <Suspense fallback={<Loader />}>
 *   <ExperienceList />
 * </Suspense>
 * ```
 */

import { useDataLoader } from '@/providers/server/effect-data-loader';
import { createDataLoaderOptions, SANITY_ENDPOINTS } from './config';
import { CertificationsSchema, ExperiencesSchema, ProjectsSchema, ResumeSchema } from './schemas';

/**
 * Hook to fetch experiences with Effect Schema validation and Suspense
 */
export function useSanityExperiences() {
  return useDataLoader(SANITY_ENDPOINTS.experiences, createDataLoaderOptions(ExperiencesSchema));
}

/**
 * Hook to fetch projects with Effect Schema validation and Suspense
 */
export function useSanityProjects() {
  return useDataLoader(SANITY_ENDPOINTS.projects, createDataLoaderOptions(ProjectsSchema));
}

/**
 * Hook to fetch featured projects with Effect Schema validation and Suspense
 */
export function useSanityFeaturedProjects() {
  return useDataLoader(SANITY_ENDPOINTS.featuredProjects, createDataLoaderOptions(ProjectsSchema));
}

/**
 * Hook to fetch certifications with Effect Schema validation and Suspense
 */
export function useSanityCertifications() {
  return useDataLoader(
    SANITY_ENDPOINTS.certifications,
    createDataLoaderOptions(CertificationsSchema),
  );
}

/**
 * Hook to fetch resume with Effect Schema validation and Suspense
 */
export function useSanityResume() {
  return useDataLoader(SANITY_ENDPOINTS.resume, createDataLoaderOptions(ResumeSchema));
}
