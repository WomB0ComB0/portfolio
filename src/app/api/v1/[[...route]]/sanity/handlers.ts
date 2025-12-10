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
 * Dummy data for presentations (shown when no real data exists)
 */
const DUMMY_PRESENTATIONS = [
  {
    _id: 'dummy-presentation-1',
    _type: 'presentation' as const,
    _createdAt: '2025-03-15T18:00:00Z',
    _updatedAt: '2025-03-15T18:00:00Z',
    _rev: 'dummy-rev-1',
    title: 'Building Scalable Web Applications with Next.js',
    description:
      'An in-depth look at best practices for building scalable, performant web applications using Next.js App Router, server components, and modern React patterns.',
    eventName: 'React NYC Meetup',
    eventUrl: 'https://www.meetup.com/ReactNYC/',
    date: '2025-03-15T18:00:00Z',
    slidesFormat: 'google_slides' as const,
    slidesUrl: 'https://docs.google.com/presentation/d/example',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    location: 'New York, NY',
    tags: ['Next.js', 'React', 'Performance', 'Web Development'],
    order: 1,
  },
  {
    _id: 'dummy-presentation-2',
    _type: 'presentation' as const,
    _createdAt: '2025-02-20T09:00:00Z',
    _updatedAt: '2025-02-20T09:00:00Z',
    _rev: 'dummy-rev-2',
    title: 'TypeScript Best Practices for Enterprise Applications',
    description:
      'Learn how to leverage TypeScript effectively in large-scale applications, including advanced type patterns, generics, and integration with modern tooling.',
    eventName: 'TypeScript Conference 2025',
    eventUrl: 'https://typescriptconf.com',
    date: '2025-02-20T09:00:00Z',
    slidesFormat: 'pdf' as const,
    slidesPdfUrl: 'https://example.com/slides.pdf',
    location: 'San Francisco, CA',
    tags: ['TypeScript', 'Enterprise', 'Best Practices'],
    order: 2,
  },
  {
    _id: 'dummy-presentation-3',
    _type: 'presentation' as const,
    _createdAt: '2025-01-10T14:00:00Z',
    _updatedAt: '2025-01-10T14:00:00Z',
    _rev: 'dummy-rev-3',
    title: 'From Zero to Production: CI/CD with GitHub Actions',
    description:
      'A comprehensive guide to setting up continuous integration and deployment pipelines using GitHub Actions, including testing, building, and deploying to various cloud platforms.',
    eventName: 'DevOps Days NYC',
    date: '2025-01-10T14:00:00Z',
    slidesFormat: 'speakerdeck' as const,
    slidesUrl: 'https://speakerdeck.com/example',
    location: 'Brooklyn, NY',
    tags: ['DevOps', 'CI/CD', 'GitHub Actions', 'Automation'],
    order: 3,
  },
];

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
    // Return dummy data if no real data exists
    const result = presentations.length > 0 ? presentations : DUMMY_PRESENTATIONS;
    setCache('presentations', result);
    return result;
  } catch (error) {
    logger.error('Error in getPresentationsHandler:', error);
    // Return dummy data on error for preview purposes
    return DUMMY_PRESENTATIONS;
  }
}

/**
 * Dummy data for talks (shown when no real data exists)
 */
const DUMMY_TALKS = [
  {
    _id: 'dummy-talk-1',
    _type: 'talk' as const,
    _createdAt: '2025-04-05T10:00:00Z',
    _updatedAt: '2025-04-05T10:00:00Z',
    _rev: 'dummy-rev-1',
    title: 'The Future of AI in Web Development',
    description:
      'Exploring how artificial intelligence is transforming the way we build and deploy web applications, from code generation to automated testing and deployment.',
    venue: 'AI Summit 2025',
    date: '2025-04-05T10:00:00Z',
    videoFormat: 'youtube' as const,
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    slidesFormat: 'pdf' as const,
    slidesPdfUrl: 'https://example.com/ai-talk-slides.pdf',
    duration: '45 min',
    tags: ['AI', 'Machine Learning', 'Web Development', 'Future Tech'],
    order: 1,
  },
  {
    _id: 'dummy-talk-2',
    _type: 'talk' as const,
    _createdAt: '2025-03-01T15:00:00Z',
    _updatedAt: '2025-03-01T15:00:00Z',
    _rev: 'dummy-rev-2',
    title: 'Mastering React Server Components',
    description:
      'Deep dive into React Server Components, understanding when to use them, performance implications, and how they change the way we think about React applications.',
    venue: 'React Summit Remote',
    date: '2025-03-01T15:00:00Z',
    videoFormat: 'vimeo' as const,
    videoUrl: 'https://vimeo.com/example',
    slidesFormat: 'url' as const,
    slidesUrl: 'https://slides.com/example',
    duration: '30 min',
    tags: ['React', 'Server Components', 'Performance'],
    order: 2,
  },
  {
    _id: 'dummy-talk-3',
    _type: 'talk' as const,
    _createdAt: '2025-02-15T11:00:00Z',
    _updatedAt: '2025-02-15T11:00:00Z',
    _rev: 'dummy-rev-3',
    title: 'Building Accessible Web Applications',
    description:
      'A practical guide to making your web applications accessible to everyone, covering WCAG guidelines, testing tools, and common accessibility patterns.',
    venue: 'Accessibility Conference 2025',
    date: '2025-02-15T11:00:00Z',
    videoFormat: 'youtube' as const,
    videoUrl: 'https://www.youtube.com/watch?v=example',
    duration: '40 min',
    tags: ['Accessibility', 'A11y', 'UX', 'Web Standards'],
    order: 3,
  },
];

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
    // Return dummy data if no real data exists
    const result = talks.length > 0 ? talks : DUMMY_TALKS;
    setCache('talks', result);
    return result;
  } catch (error) {
    logger.error('Error in getTalksHandler:', error);
    // Return dummy data on error for preview purposes
    return DUMMY_TALKS;
  }
}

/**
 * Dummy data for articles (shown when no real data exists)
 */
const DUMMY_ARTICLES = [
  {
    _id: 'dummy-article-1',
    _type: 'article' as const,
    _createdAt: '2025-03-20T00:00:00Z',
    _updatedAt: '2025-03-20T00:00:00Z',
    _rev: 'dummy-rev-1',
    title: 'The Complete Guide to Modern State Management in React',
    excerpt:
      'An exploration of state management solutions in 2025, comparing Redux Toolkit, Zustand, Jotai, and the built-in React Context API for different use cases.',
    publication: 'Smashing Magazine',
    publicationUrl: 'https://www.smashingmagazine.com/article/example',
    publishedDate: '2025-03-20T00:00:00Z',
    tags: ['React', 'State Management', 'JavaScript', 'Frontend'],
    coAuthors: ['Jane Developer'],
    order: 1,
  },
  {
    _id: 'dummy-article-2',
    _type: 'article' as const,
    _createdAt: '2025-02-28T00:00:00Z',
    _updatedAt: '2025-02-28T00:00:00Z',
    _rev: 'dummy-rev-2',
    title: 'Optimizing Node.js Applications for Production',
    excerpt:
      'Best practices for deploying Node.js applications to production, including performance monitoring, memory management, and scaling strategies.',
    publication: 'LogRocket Blog',
    publicationUrl: 'https://blog.logrocket.com/article/example',
    publishedDate: '2025-02-28T00:00:00Z',
    tags: ['Node.js', 'Performance', 'Backend', 'DevOps'],
    order: 2,
  },
  {
    _id: 'dummy-article-3',
    _type: 'article' as const,
    _createdAt: '2025-01-15T00:00:00Z',
    _updatedAt: '2025-01-15T00:00:00Z',
    _rev: 'dummy-rev-3',
    title: 'Introduction to Edge Computing for Web Developers',
    excerpt:
      'Understanding edge computing and how to leverage edge functions for faster, more responsive web applications using Vercel Edge Functions and Cloudflare Workers.',
    publication: 'CSS-Tricks',
    publicationUrl: 'https://css-tricks.com/article/example',
    publishedDate: '2025-01-15T00:00:00Z',
    tags: ['Edge Computing', 'Vercel', 'Cloudflare', 'Performance'],
    order: 3,
  },
];

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
    // Return dummy data if no real data exists
    const result = articles.length > 0 ? articles : DUMMY_ARTICLES;
    setCache('articles', result);
    return result;
  } catch (error) {
    logger.error('Error in getArticlesHandler:', error);
    // Return dummy data on error for preview purposes
    return DUMMY_ARTICLES;
  }
}

/**
 * Dummy data for YouTube videos (shown when no real data exists)
 */
const DUMMY_YOUTUBE_VIDEOS = [
  {
    _id: 'dummy-video-1',
    _type: 'youtubeVideo' as const,
    _createdAt: '2025-03-10T00:00:00Z',
    _updatedAt: '2025-03-10T00:00:00Z',
    _rev: 'dummy-rev-1',
    title: 'Building a Full-Stack App with Next.js 14 - Complete Tutorial',
    description:
      'In this comprehensive tutorial, we build a complete full-stack application using Next.js 14, covering everything from project setup to deployment.',
    videoId: 'dQw4w9WgXcQ',
    publishedDate: '2025-03-10T00:00:00Z',
    duration: '2:15:30',
    tags: ['Next.js', 'Tutorial', 'Full Stack', 'React'],
    order: 1,
  },
  {
    _id: 'dummy-video-2',
    _type: 'youtubeVideo' as const,
    _createdAt: '2025-02-25T00:00:00Z',
    _updatedAt: '2025-02-25T00:00:00Z',
    _rev: 'dummy-rev-2',
    title: 'TypeScript Tips and Tricks Every Developer Should Know',
    description:
      'A collection of advanced TypeScript techniques that will make your code more type-safe, maintainable, and easier to understand.',
    videoId: 'example123',
    publishedDate: '2025-02-25T00:00:00Z',
    duration: '45:20',
    tags: ['TypeScript', 'Tips', 'Programming'],
    order: 2,
  },
  {
    _id: 'dummy-video-3',
    _type: 'youtubeVideo' as const,
    _createdAt: '2025-01-30T00:00:00Z',
    _updatedAt: '2025-01-30T00:00:00Z',
    _rev: 'dummy-rev-3',
    title: 'Live Coding: Building a Real-Time Chat Application',
    description:
      'Watch as we build a real-time chat application from scratch using WebSockets, React, and Node.js in this live coding session.',
    videoId: 'example456',
    publishedDate: '2025-01-30T00:00:00Z',
    duration: '1:30:00',
    tags: ['Live Coding', 'WebSockets', 'React', 'Node.js'],
    order: 3,
  },
];

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
    // Return dummy data if no real data exists
    const result = videos.length > 0 ? videos : DUMMY_YOUTUBE_VIDEOS;
    setCache('youtubeVideos', result);
    return result;
  } catch (error) {
    logger.error('Error in getYoutubeVideosHandler:', error);
    // Return dummy data on error for preview purposes
    return DUMMY_YOUTUBE_VIDEOS;
  }
}
