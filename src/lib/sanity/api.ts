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

import type { Certification, Experience, Place, Project } from '@/hooks/sanity/schemas';
import { logger } from '@/utils';
import { sanityFetch } from './client';
import {
  certificationsQuery,
  experiencesQuery,
  featuredProjectsQuery,
  placesQuery,
  projectBySlugQuery,
  projectsQuery,
} from './queries';

/**
 * Cache duration for Sanity data (in seconds)
 */
const CACHE_DURATION = 60 * 5; // 5 minutes

/**
 * Fetch all experiences from Sanity
 * @returns Promise with array of experiences
 */
export async function getExperiences(): Promise<Experience[]> {
  try {
    const experiences = await sanityFetch<Experience[]>(experiencesQuery);
    return experiences;
  } catch (error) {
    logger.error('Error fetching experiences from Sanity:', error);
    return [];
  }
}

/**
 * Fetch all projects from Sanity
 * @returns Promise with array of projects
 */
export async function getProjects(): Promise<Project[]> {
  try {
    const projects = await sanityFetch<Project[]>(projectsQuery);
    return projects;
  } catch (error) {
    logger.error('Error fetching projects from Sanity:', error);
    return [];
  }
}

/**
 * Fetch featured projects only
 * @returns Promise with array of featured projects
 */
export async function getFeaturedProjects(): Promise<Project[]> {
  try {
    const projects = await sanityFetch<Project[]>(featuredProjectsQuery);
    return projects;
  } catch (error) {
    logger.error('Error fetching featured projects from Sanity:', error);
    return [];
  }
}

/**
 * Fetch a single project by slug
 * @param slug - Project slug
 * @returns Promise with project or null
 */
export async function getProjectBySlug(slug: string): Promise<Project | null> {
  try {
    const project = await sanityFetch<Project | null>(projectBySlugQuery, { slug });
    return project;
  } catch (error) {
    logger.error(`Error fetching project with slug "${slug}":`, error);
    return null;
  }
}

/**
 * Fetch all certifications from Sanity
 * @returns Promise with array of certifications
 */
export async function getCertifications(): Promise<Certification[]> {
  try {
    const certifications = await sanityFetch<Certification[]>(certificationsQuery);
    return certifications;
  } catch (error) {
    logger.error('Error fetching certifications from Sanity:', error);
    return [];
  }
}

/**
 * Fetch all places from Sanity
 * @returns Promise with array of places
 */
export async function getPlaces(): Promise<Place[]> {
  try {
    const places = await sanityFetch<Place[]>(placesQuery);
    return places;
  } catch (error) {
    logger.error('Error fetching places from Sanity:', error);
    return [];
  }
}

/**
 * Fetch active resume from Sanity
 * @returns Promise with resume data or null
 */
export async function getResume() {
  try {
    // Return the asset reference (asset) rather than dereferencing it (asset->)
    // so the API shape matches the client schema which expects { asset: { _ref: string, _type: 'reference' } }
    const resumeQuery = `*[_type == "resume" && isActive == true] | order(_updatedAt desc) [0] {
      _id,
      _type,
      _createdAt,
      _updatedAt,
      _rev,
      title,
      pdfFile {
        _type,
        asset
      },
      lastUpdated,
      isActive
    }`;

    const resume = await sanityFetch(resumeQuery);
    return resume;
  } catch (error) {
    logger.error('Error fetching resume from Sanity:', error);
    return null;
  }
}

/**
 * Revalidation tags for Next.js ISR
 */
export const revalidateTags = {
  experiences: 'experiences',
  projects: 'projects',
  certifications: 'certifications',
  skills: 'skills',
  places: 'places',
  resume: 'resume',
} as const;

/**
 * Helper to get cache options for Next.js fetch
 */
export function getCacheOptions(tag: string) {
  return {
    next: {
      revalidate: CACHE_DURATION,
      tags: [tag],
    },
  };
}
