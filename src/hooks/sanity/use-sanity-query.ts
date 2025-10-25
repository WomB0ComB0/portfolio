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
 * @fileoverview Standard React Query hooks for Sanity data
 *
 * Traditional React Query hooks with loading/error states.
 * Uses Effect-based fetcher with schema validation.
 *
 * @example
 * ```tsx
 * function ExperienceList() {
 *   const { data, isLoading, error } = useExperiences();
 *   if (isLoading) return <Loader />;
 *   if (error) return <Error />;
 *   return <div>{data.map(...)}</div>;
 * }
 * ```
 */

import { get } from '@/lib/http-clients';
import type { Certification, Experience, Place, Project } from '@/lib/sanity/types';
import { FetchHttpClient } from '@effect/platform';
import { useQuery } from '@tanstack/react-query';
import { Effect, pipe } from 'effect';
import {
  createSanityQueryKey,
  SANITY_CACHE_CONFIG,
  SANITY_ENDPOINTS,
  SANITY_FETCHER_OPTIONS,
} from './config';
import {
  type CertificationSchema,
  CertificationsSchema,
  type ExperienceSchema,
  ExperiencesSchema,
  PlacesSchema,
  type ProjectSchema,
  ProjectsSchema,
} from './schemas';

/**
 * Generic fetcher function for Sanity data with Effect validation
 */
async function fetchSanityData<T>(url: string, schema: any): Promise<T> {
  const effect = pipe(
    get(url, {
      schema,
      ...SANITY_FETCHER_OPTIONS,
    }),
    Effect.provide(FetchHttpClient.layer),
  );

  const result = await Effect.runPromise(effect);
  return result as T;
}

/**
 * Hook to fetch experiences with Effect Schema validation
 */
export function useExperiences() {
  return useQuery({
    queryKey: createSanityQueryKey('experiences'),
    queryFn: () => fetchSanityData<Experience[]>(SANITY_ENDPOINTS.experiences, ExperiencesSchema),
    staleTime: SANITY_CACHE_CONFIG.staleTime,
    gcTime: SANITY_CACHE_CONFIG.gcTime,
  });
}

/**
 * Hook to fetch a single experience by ID
 */
export function useExperience(id: string) {
  return useQuery({
    queryKey: createSanityQueryKey('experiences', id),
    queryFn: async () => {
      const experiences = await fetchSanityData<Experience[]>(
        SANITY_ENDPOINTS.experiences,
        ExperiencesSchema,
      );
      const experience = experiences.find((exp) => exp._id === id);
      if (!experience) {
        throw new Error(`Experience with id ${id} not found`);
      }
      return experience;
    },
    staleTime: SANITY_CACHE_CONFIG.staleTime,
    gcTime: SANITY_CACHE_CONFIG.gcTime,
  });
}

/**
 * Hook to fetch projects with Effect Schema validation
 */
export function useProjects() {
  return useQuery({
    queryKey: createSanityQueryKey('projects'),
    queryFn: () => fetchSanityData<Project[]>(SANITY_ENDPOINTS.projects, ProjectsSchema),
    staleTime: SANITY_CACHE_CONFIG.staleTime,
    gcTime: SANITY_CACHE_CONFIG.gcTime,
  });
}

/**
 * Hook to fetch featured projects with Effect Schema validation
 */
export function useFeaturedProjects() {
  return useQuery({
    queryKey: createSanityQueryKey('featuredProjects'),
    queryFn: () => fetchSanityData<Project[]>(SANITY_ENDPOINTS.featuredProjects, ProjectsSchema),
    staleTime: SANITY_CACHE_CONFIG.staleTime,
    gcTime: SANITY_CACHE_CONFIG.gcTime,
  });
}

/**
 * Hook to fetch a single project by ID
 */
export function useProject(id: string) {
  return useQuery({
    queryKey: createSanityQueryKey('projects', id),
    queryFn: async () => {
      const projects = await fetchSanityData<Project[]>(SANITY_ENDPOINTS.projects, ProjectsSchema);
      const project = projects.find((proj) => proj._id === id);
      if (!project) {
        throw new Error(`Project with id ${id} not found`);
      }
      return project;
    },
    staleTime: SANITY_CACHE_CONFIG.staleTime,
    gcTime: SANITY_CACHE_CONFIG.gcTime,
  });
}

/**
 * Hook to fetch certifications with Effect Schema validation
 */
export function useCertifications() {
  return useQuery({
    queryKey: createSanityQueryKey('certifications'),
    queryFn: () =>
      fetchSanityData<Certification[]>(SANITY_ENDPOINTS.certifications, CertificationsSchema),
    staleTime: SANITY_CACHE_CONFIG.staleTime,
    gcTime: SANITY_CACHE_CONFIG.gcTime,
  });
}

/**
 * Hook to fetch places with Effect Schema validation
 */
export function usePlaces() {
  return useQuery({
    queryKey: createSanityQueryKey('places'),
    queryFn: () => fetchSanityData<Place[]>(SANITY_ENDPOINTS.places, PlacesSchema),
    staleTime: SANITY_CACHE_CONFIG.staleTime,
    gcTime: SANITY_CACHE_CONFIG.gcTime,
  });
}

// Re-export schemas for convenience
export { CertificationsSchema, ExperiencesSchema, ProjectsSchema };
export type { CertificationSchema, ExperienceSchema, ProjectSchema };
