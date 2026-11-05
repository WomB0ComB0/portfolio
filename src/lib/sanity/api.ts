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
 * @file Server-side Sanity getters.
 *
 * A failed query throws a BaseError (command `sanity:<name>`, the client's error as its `cause`)
 * instead of answering an empty value, so callers can tell an outage from real content:
 * - a list getter's [] means Sanity has no such documents;
 * - a single-document getter's null means that document does not exist.
 * Callers decide what an outage looks like: the API routes serve their last good answer or a
 * 503, and page metadata falls back to its defaults.
 */

import { ensureBaseError } from '@/classes/error';
import type {
  Article,
  Certification,
  Experience,
  Place,
  Presentation,
  Project,
  Resume,
  Talk,
  YoutubeVideo,
} from '@/hooks/sanity/schemas';
import { sanityFetchWithToken } from './client';
import {
  articlesQuery,
  certificationsQuery,
  experiencesQuery,
  featuredProjectsQuery,
  placesQuery,
  presentationsQuery,
  projectBySlugQuery,
  projectsQuery,
  talksQuery,
  youtubeVideosQuery,
} from './queries';

/**
 * Cache duration for Sanity data (in seconds)
 */
const CACHE_DURATION = 60 * 5; // 5 minutes

/**
 * The active resume. It returns the asset reference (`asset`) rather than dereferencing it
 * (`asset->`), so the API shape matches the client schema's `{ asset: { _ref, _type } }`.
 */
const activeResumeQuery = `*[_type == "resume" && isActive == true] | order(_updatedAt desc) [0] {
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

type QueryParams = Readonly<Record<string, string>>;

/** Runs a query; a failure becomes a BaseError named after the getter. */
async function runQuery(command: string, query: string, params?: QueryParams): Promise<unknown> {
  try {
    return await sanityFetchWithToken<unknown>(query, params);
  } catch (error) {
    throw ensureBaseError(error, command, params ? { params } : undefined);
  }
}

/**
 * Fetches a list. A list query always answers an array, so anything else is a failure rather
 * than an empty list.
 */
async function fetchList<T>(name: string, query: string): Promise<T[]> {
  const command = `sanity:${name}`;
  const result = await runQuery(command, query);
  if (!Array.isArray(result)) {
    throw ensureBaseError(new Error(`expected a list, got ${typeof result}`), command);
  }
  return result as T[];
}

/** Fetches one document: null when it does not exist, a thrown BaseError when the query fails. */
async function fetchDocument<T>(
  name: string,
  query: string,
  params?: QueryParams,
): Promise<T | null> {
  const result = await runQuery(`sanity:${name}`, query, params);
  return (result ?? null) as T | null;
}

/** All experiences. Throws when Sanity fails. */
export function getExperiences(): Promise<Experience[]> {
  return fetchList<Experience>('experiences', experiencesQuery);
}

/** All projects. Throws when Sanity fails. */
export function getProjects(): Promise<Project[]> {
  return fetchList<Project>('projects', projectsQuery);
}

/** Featured projects only. Throws when Sanity fails. */
export function getFeaturedProjects(): Promise<Project[]> {
  return fetchList<Project>('featured-projects', featuredProjectsQuery);
}

/** One project by slug: null when no project has that slug. Throws when Sanity fails. */
export function getProjectBySlug(slug: string): Promise<Project | null> {
  return fetchDocument<Project>('project-by-slug', projectBySlugQuery, { slug });
}

/** All certifications. Throws when Sanity fails. */
export function getCertifications(): Promise<Certification[]> {
  return fetchList<Certification>('certifications', certificationsQuery);
}

/** All places. Throws when Sanity fails. */
export function getPlaces(): Promise<Place[]> {
  return fetchList<Place>('places', placesQuery);
}

/** The active resume: null when none is active. Throws when Sanity fails. */
export function getResume(): Promise<Resume | null> {
  return fetchDocument<Resume>('resume', activeResumeQuery);
}

/** All presentations. Throws when Sanity fails. */
export function getPresentations(): Promise<Presentation[]> {
  return fetchList<Presentation>('presentations', presentationsQuery);
}

/** All talks. Throws when Sanity fails. */
export function getTalks(): Promise<Talk[]> {
  return fetchList<Talk>('talks', talksQuery);
}

/** All articles. Throws when Sanity fails. */
export function getArticles(): Promise<Article[]> {
  return fetchList<Article>('articles', articlesQuery);
}

/** All YouTube videos stored in Sanity. Throws when Sanity fails. */
export function getYoutubeVideos(): Promise<YoutubeVideo[]> {
  return fetchList<YoutubeVideo>('youtube-videos', youtubeVideosQuery);
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
  presentations: 'presentations',
  talks: 'talks',
  articles: 'articles',
  youtubeVideos: 'youtubeVideos',
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
