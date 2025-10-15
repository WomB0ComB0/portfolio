import {
  getCertifications,
  getExperiences,
  getFeaturedProjects,
  getPlaces,
  getProjects,
  getResume,
} from '@/lib/sanity/api';

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
    console.error('Error in getExperiencesHandler:', error);
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
    console.error('Error in getProjectsHandler:', error);
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
    console.error('Error in getFeaturedProjectsHandler:', error);
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
    console.error('Error in getCertificationsHandler:', error);
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
    console.error('Error in getPlacesHandler:', error);
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
    console.error('Error in getResumeHandler:', error);
    throw new Error('Failed to fetch resume');
  }
}

