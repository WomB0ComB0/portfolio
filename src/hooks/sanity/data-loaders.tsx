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
 * @fileoverview Declarative DataLoader components for Sanity data
 *
 * Provides render-props based components for loading Sanity data
 * with automatic Suspense boundaries and error handling.
 *
 * @example
 * ```tsx
 * <SanityDataLoader.Experiences>
 *   {(experiences, { refetch, invalidate }) => (
 *     <>
 *       <button onClick={invalidate}>Refresh</button>
 *       {experiences.map(exp => <Card key={exp._id} {...exp} />)}
 *     </>
 *   )}
 * </SanityDataLoader.Experiences>
 * ```
 */

import type { Certification, Experience, Project } from '@/lib/sanity/types';
import { DataLoader } from '@/providers/server/effect-data-loader';
import { createDataLoaderOptions, SANITY_ENDPOINTS } from './config';
import { CertificationsSchema, ExperiencesSchema, ProjectsSchema } from './schemas';

/**
 * Generic factory for creating DataLoader components
 */
function createDataLoaderComponent<T>(url: string, schema: any) {
  return ({ children, LoadingComponent, ErrorComponent }: DataLoaderProps<T>) => (
    <DataLoader
      url={url}
      {...createDataLoaderOptions(schema)}
      LoadingComponent={LoadingComponent}
      ErrorComponent={ErrorComponent}
    >
      {children as any}
    </DataLoader>
  );
}

/**
 * Declarative DataLoader components for Sanity data
 */
export const SanityDataLoader = {
  /**
   * DataLoader component for experiences
   */
  Experiences: createDataLoaderComponent<Experience[]>(
    SANITY_ENDPOINTS.experiences,
    ExperiencesSchema,
  ),

  /**
   * DataLoader component for projects
   */
  Projects: createDataLoaderComponent<Project[]>(SANITY_ENDPOINTS.projects, ProjectsSchema),

  /**
   * DataLoader component for featured projects
   */
  FeaturedProjects: createDataLoaderComponent<Project[]>(
    SANITY_ENDPOINTS.featuredProjects,
    ProjectsSchema,
  ),

  /**
   * DataLoader component for certifications
   */
  Certifications: createDataLoaderComponent<Certification[]>(
    SANITY_ENDPOINTS.certifications,
    CertificationsSchema,
  ),
};

/**
 * Utility types for DataLoader components
 */
export type DataLoaderUtils = {
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
  isRefetching: boolean;
};
export type DataLoaderProps<T> = {
  children: (data: T, utils?: DataLoaderUtils) => React.ReactNode;
  LoadingComponent?: React.ReactNode;
  ErrorComponent?: React.ComponentType<{ error: Error; retry: () => void }>;
};
