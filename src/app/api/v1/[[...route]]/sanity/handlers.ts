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

import {
  getCertifications,
  getExperiences,
  getFeaturedProjects,
  getPlaces,
  getProjects,
  getResume,
} from '@/lib/sanity/api';
import { logger } from '@/utils';

const CACHE_DURATION = 60 * 5 * 1000; // 5 minutes
const caches = new Map<string, { data: any; timestamp: number }>();

function getCached<T>(key: string): T | null {
  const cached = caches.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any): void {
  caches.set(key, { data, timestamp: Date.now() });
}

/**
 * Get all experiences from Sanity
 */
export async function getExperiencesHandler() {
  const cached = getCached('experiences');
  if (cached) {
    return cached;
  }

  try {
    const experiences = await getExperiences();
    setCache('experiences', experiences);
    return experiences;
  } catch (error) {
    logger.error('Error in getExperiencesHandler:', error);
    throw new Error('Failed to fetch experiences');
  }
}

/**
 * Get all projects from Sanity
 */
export async function getProjectsHandler() {
  const cached = getCached('projects');
  if (cached) {
    return cached;
  }

  try {
    const projects = await getProjects();
    setCache('projects', projects);
    return projects;
  } catch (error) {
    logger.error('Error in getProjectsHandler:', error);
    throw new Error('Failed to fetch projects');
  }
}

/**
 * Get featured projects from Sanity
 */
export async function getFeaturedProjectsHandler() {
  const cached = getCached('featuredProjects');
  if (cached) {
    return cached;
  }

  try {
    const projects = await getFeaturedProjects();
    setCache('featuredProjects', projects);
    return projects;
  } catch (error) {
    logger.error('Error in getFeaturedProjectsHandler:', error);
    throw new Error('Failed to fetch featured projects');
  }
}

/**
 * Get all certifications from Sanity
 */
export async function getCertificationsHandler() {
  const cached = getCached('certifications');
  if (cached) {
    return cached;
  }

  try {
    const certifications = await getCertifications();
    setCache('certifications', certifications);
    return certifications;
  } catch (error) {
    logger.error('Error in getCertificationsHandler:', error);
    throw new Error('Failed to fetch certifications');
  }
}

/**
 * Get all places from Sanity
 */
export async function getPlacesHandler() {
  const cached = getCached('places');
  if (cached) {
    return cached;
  }

  try {
    const places = await getPlaces();
    setCache('places', places);
    return places;
  } catch (error) {
    logger.error('Error in getPlacesHandler:', error);
    throw new Error('Failed to fetch places');
  }
}

/**
 * Get active resume from Sanity
 */
export async function getResumeHandler() {
  const cached = getCached('resume');
  if (cached) {
    return cached;
  }

  try {
    const resume = await getResume();
    setCache('resume', resume);
    return resume;
  } catch (error) {
    logger.error('Error in getResumeHandler:', error);
    throw new Error('Failed to fetch resume');
  }
}

/**
 * Get all presentations from Sanity
 */
export async function getPresentationsHandler() {
  const cached = getCached('presentations');
  if (cached) {
    return cached;
  }

  try {
    const { getPresentations } = await import('@/lib/sanity/api');
    const presentations = await getPresentations();
    setCache('presentations', presentations);
    return presentations;
  } catch (error) {
    logger.error('Error in getPresentationsHandler:', error);
    throw new Error('Failed to fetch presentations');
  }
}

/**
 * Get all talks from Sanity
 */
export async function getTalksHandler() {
  const cached = getCached('talks');
  if (cached) {
    return cached;
  }

  try {
    const { getTalks } = await import('@/lib/sanity/api');
    const talks = await getTalks();
    setCache('talks', talks);
    return talks;
  } catch (error) {
    logger.error('Error in getTalksHandler:', error);
    throw new Error('Failed to fetch talks');
  }
}

/**
 * Get all articles from Sanity
 */
export async function getArticlesHandler() {
  const cached = getCached('articles');
  if (cached) {
    return cached;
  }

  try {
    const { getArticles } = await import('@/lib/sanity/api');
    const articles = await getArticles();
    setCache('articles', articles);
    return articles;
  } catch (error) {
    logger.error('Error in getArticlesHandler:', error);
    throw new Error('Failed to fetch articles');
  }
}

/**
 * Get all YouTube videos from Sanity
 */
export async function getYoutubeVideosHandler() {
  const cached = getCached('youtubeVideos');
  if (cached) {
    return cached;
  }

  try {
    const { getYoutubeVideos } = await import('@/lib/sanity/api');
    const videos = await getYoutubeVideos();
    setCache('youtubeVideos', videos);
    return videos;
  } catch (error) {
    logger.error('Error in getYoutubeVideosHandler:', error);
    throw new Error('Failed to fetch YouTube videos');
  }
}
