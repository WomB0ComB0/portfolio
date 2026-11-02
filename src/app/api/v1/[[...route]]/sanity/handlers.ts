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

import { env } from '@/env';
import { fetchYouTubeVideoMetadataBatch } from '@/lib/api-integrations/youtube';
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
    return [];
  }
}

/**
 * Get all talks from Sanity, enriched with dynamic duration from YouTube API where applicable
 */
export async function getTalksHandler() {
  const cached = getCached('talks');
  if (cached) {
    return cached;
  }

  try {
    const { getTalks } = await import('@/lib/sanity/api');
    const talks = await getTalks();

    // Enrich talks with dynamic duration from YouTube API if API key is available
    const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
    logger.info('YouTube API enrichment for talks:', {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length,
      talksCount: talks.length,
    });

    if (apiKey && talks.length > 0) {
      try {
        // Extract YouTube video IDs from talks
        const youtubeVideoIds = talks
          .filter((talk) => talk.videoFormat === 'youtube' && talk.videoUrl)
          .map((talk) => {
            // Extract video ID from YouTube URL
            const url = talk.videoUrl!;
            const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
            return match ? match[1] : null;
          })
          .filter((id): id is string => id !== null);

        logger.info('Extracted YouTube video IDs from talks:', {
          videoIdsCount: youtubeVideoIds.length,
          videoIds: youtubeVideoIds,
        });

        if (youtubeVideoIds.length > 0) {
          const metadataMap = await fetchYouTubeVideoMetadataBatch(youtubeVideoIds, apiKey);
          logger.info('Fetched YouTube metadata for talks:', {
            metadataCount: metadataMap.size,
            videoIds: Array.from(metadataMap.keys()),
          });

          // Enrich talks with fetched duration
          const enrichedTalks = talks.map((talk) => {
            if (talk.videoFormat === 'youtube' && talk.videoUrl) {
              const url = talk.videoUrl;
              const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
              const videoId = match ? match[1] : null;

              if (videoId) {
                const metadata = metadataMap.get(videoId);
                if (metadata?.duration) {
                  logger.info('Enriching talk with YouTube duration:', {
                    talkId: talk._id,
                    videoId,
                    duration: metadata.duration,
                  });
                  return {
                    ...talk,
                    duration: metadata.duration, // Override with dynamic duration
                  };
                }
              }
            }
            return talk;
          });

          logger.info('Enriched talks result:', {
            totalTalks: enrichedTalks.length,
            enrichedCount: enrichedTalks.filter((t) => t.duration).length,
          });

          setCache('talks', enrichedTalks);
          return enrichedTalks;
        }
      } catch (ytError: unknown) {
        logger.warn('Failed to fetch YouTube metadata for talks, using fallback durations:', {
          error: ytError instanceof Error ? ytError.message : String(ytError),
        });
        // Fall through to return talks without enrichment
      }
    }

    setCache('talks', talks);
    return talks;
  } catch (error) {
    logger.error('Error in getTalksHandler:', error);
    return [];
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
    return [];
  }
}

/**
 * Dummy data for YouTube videos (shown when no real data exists)
 * Note: duration field is intentionally undefined to allow YouTube API enrichment
 */
const DUMMY_YOUTUBE_VIDEOS = [
  {
    _id: 'dummy-video-1',
    _type: 'youtubeVideo' as const,
    _createdAt: '2025-03-10T00:00:00Z',
    _updatedAt: '2025-03-10T00:00:00Z',
    _rev: 'dummy-rev-1',
    title: 'Placeholder - Will be fetched from YouTube', // Will be replaced by YouTube API
    description: 'Placeholder description - Will be fetched from YouTube API', // Will be replaced by YouTube API
    videoId: 'dQw4w9WgXcQ', // Real YouTube video ID - all metadata will be fetched dynamically
    publishedDate: '2025-03-10T00:00:00Z',
    duration: undefined, // Will be enriched by YouTube API
    tags: ['YouTube', 'Video'],
    order: 1,
  },
  {
    _id: 'dummy-video-2',
    _type: 'youtubeVideo' as const,
    _createdAt: '2025-02-25T00:00:00Z',
    _updatedAt: '2025-02-25T00:00:00Z',
    _rev: 'dummy-rev-2',
    title: 'Placeholder - Will be fetched from YouTube', // Will be replaced by YouTube API
    description: 'Placeholder description - Will be fetched from YouTube API', // Will be replaced by YouTube API
    videoId: 'jjMbPt_H3RQ', // Real YouTube video ID - all metadata will be fetched dynamically
    publishedDate: '2025-02-25T00:00:00Z',
    duration: undefined, // Will be enriched by YouTube API
    tags: ['YouTube', 'Video'],
    order: 2,
  },
  {
    _id: 'dummy-video-3',
    _type: 'youtubeVideo' as const,
    _createdAt: '2025-01-30T00:00:00Z',
    _updatedAt: '2025-01-30T00:00:00Z',
    _rev: 'dummy-rev-3',
    title: 'Placeholder - Will be fetched from YouTube', // Will be replaced by YouTube API
    description: 'Placeholder description - Will be fetched from YouTube API', // Will be replaced by YouTube API
    videoId: 'jNQXAC9IVRw', // Real YouTube video ID - "Me at the zoo" - all metadata will be fetched dynamically
    publishedDate: '2025-01-30T00:00:00Z',
    duration: undefined, // Will be enriched by YouTube API
    tags: ['YouTube', 'Video'],
    order: 3,
  },
];

/**
 * Get all YouTube videos from Sanity, enriched with dynamic duration from YouTube API,
 * plus videos fetched directly from the @mikeodnis YouTube channel
 */
export async function getYoutubeVideosHandler() {
  const cached = getCached('youtubeVideos');
  if (cached) {
    return cached;
  }

  try {
    const { getYoutubeVideos } = await import('@/lib/sanity/api');
    const { fetchChannelVideos } = await import('@/lib/api-integrations/youtube');

    let sanityVideos = await getYoutubeVideos();

    // Use dummy data if no real data exists in Sanity
    if (sanityVideos.length === 0) {
      sanityVideos = DUMMY_YOUTUBE_VIDEOS;
    }

    const apiKey = env.YOUTUBE_SERVER_API_KEY;

    logger.info('YouTube video fetching:', {
      hasApiKey: !!apiKey,
      sanityVideosCount: sanityVideos.length,
    });

    if (!apiKey) {
      // No API key - return Sanity videos without enrichment
      setCache('youtubeVideos', sanityVideos);
      return sanityVideos;
    }

    // Fetch videos from the @mikeodnis YouTube channel
    let channelVideos: Array<{
      _id: string;
      _type: 'youtubeVideo';
      _createdAt: string;
      _updatedAt: string;
      _rev: string;
      videoId: string;
      title: string;
      description: string;
      publishedDate: string;
      duration: string;
      tags: string[];
      order: number;
      source: 'youtube-api';
    }> = [];

    try {
      const rawChannelVideos = await fetchChannelVideos('@mikeodnis', apiKey, { maxResults: 50 });

      logger.info('Fetched channel videos:', {
        count: rawChannelVideos.length,
      });

      // Transform YouTube API response to match Sanity schema
      channelVideos = rawChannelVideos.map((video, index) => ({
        _id: `yt-channel-${video.videoId}`,
        _type: 'youtubeVideo' as const,
        _createdAt: video.publishedAt,
        _updatedAt: video.publishedAt,
        _rev: `yt-${video.videoId}`,
        videoId: video.videoId,
        title: video.title,
        description: video.description,
        publishedDate: video.publishedAt,
        duration: video.duration,
        tags: ['YouTube'] as string[],
        order: index + 100, // Lower priority than Sanity videos
        source: 'youtube-api' as const,
      }));
    } catch (channelError) {
      logger.warn('Failed to fetch YouTube channel videos:', {
        error: channelError instanceof Error ? channelError.message : String(channelError),
      });
      // Continue with just Sanity videos
    }

    // Enrich Sanity videos with metadata from YouTube API
    let enrichedSanityVideos = sanityVideos;

    try {
      const videoIds = sanityVideos.map((v) => v.videoId);
      const metadataMap = await fetchYouTubeVideoMetadataBatch(videoIds, apiKey);

      logger.info('YouTube API metadata response:', {
        fetchedCount: metadataMap.size,
      });

      // Enrich videos with fetched metadata (title, description, duration)
      enrichedSanityVideos = sanityVideos.map((video) => {
        const metadata = metadataMap.get(video.videoId);
        if (metadata) {
          return {
            ...video,
            title: metadata.title,
            description: metadata.description,
            duration: metadata.duration,
          };
        }
        return video;
      });
    } catch (ytError) {
      logger.warn('Failed to enrich Sanity videos with YouTube metadata:', {
        error: ytError instanceof Error ? ytError.message : String(ytError),
      });
    }

    // Create a Set of Sanity video IDs the user has explicitly added
    const sanityVideoIds = new Set(sanityVideos.map((v) => v.videoId));

    // Filter out channel videos that already exist in Sanity (Sanity data takes precedence)
    const uniqueChannelVideos = channelVideos.filter((video) => !sanityVideoIds.has(video.videoId));

    // Merge: Sanity videos first (higher priority), then channel videos
    const allVideos = [
      ...enrichedSanityVideos.map((v) => ({ ...v, source: 'sanity' as const })),
      ...uniqueChannelVideos,
    ];

    // Sort by publish date (newest first)
    allVideos.sort(
      (a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime(),
    );

    logger.info('Final video list:', {
      sanityCount: enrichedSanityVideos.length,
      channelCount: uniqueChannelVideos.length,
      totalCount: allVideos.length,
    });

    setCache('youtubeVideos', allVideos);
    return allVideos;
  } catch (error) {
    logger.error('Error in getYoutubeVideosHandler:', error);
    // Return dummy data on error for preview purposes
    return DUMMY_YOUTUBE_VIDEOS;
  }
}
