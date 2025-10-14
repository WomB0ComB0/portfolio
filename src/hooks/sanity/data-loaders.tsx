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

import { DataLoader } from '@/providers/server/effect-data-loader';
import type { Certification, Experience, Project } from '@/lib/sanity/types';
import { SANITY_ENDPOINTS, createDataLoaderOptions } from './config';
import { CertificationsSchema, ExperiencesSchema, ProjectsSchema } from './schemas';

/**
 * Utility types for DataLoader components
 */
type DataLoaderUtils = {
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
  isRefetching: boolean;
};

type DataLoaderProps<T> = {
  children: (data: T, utils?: DataLoaderUtils) => React.ReactNode;
  LoadingComponent?: React.ReactNode;
  ErrorComponent?: React.ComponentType<{ error: Error; retry: () => void }>;
};

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
