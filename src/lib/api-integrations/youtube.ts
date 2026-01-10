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
 * @fileoverview YouTube Data API integration for fetching video metadata
 * @module lib/api-integrations/youtube
 */

/**
 * YouTube video snippet data from API v3
 */
interface YouTubeVideoSnippet {
  title: string;
  description: string;
  publishedAt: string;
  thumbnails: {
    default: { url: string; width: number; height: number };
    medium: { url: string; width: number; height: number };
    high: { url: string; width: number; height: number };
    standard?: { url: string; width: number; height: number };
    maxres?: { url: string; width: number; height: number };
  };
}

/**
 * YouTube video content details from API v3
 */
interface YouTubeVideoContentDetails {
  duration: string; // ISO 8601 duration format (e.g., "PT15M51S")
  dimension: string;
  definition: string;
  caption: string;
}

/**
 * YouTube video item from API v3
 */
interface YouTubeVideoItem {
  kind: string;
  etag: string;
  id: string;
  snippet: YouTubeVideoSnippet;
  contentDetails: YouTubeVideoContentDetails;
}

/**
 * YouTube API v3 response for video details
 */
interface YouTubeVideosResponse {
  kind: string;
  etag: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: YouTubeVideoItem[];
}

/**
 * Formatted video metadata
 */
export interface YouTubeVideoMetadata {
  videoId: string;
  title: string;
  description: string;
  duration: string; // Formatted as "15:51" or "1:23:45"
  durationIso: string; // Original ISO 8601 format
  publishedAt: string;
  thumbnailUrl: string;
}

/**
 * Convert ISO 8601 duration to human-readable format
 * @param {string} isoDuration - ISO 8601 duration (e.g., "PT15M51S", "PT1H23M45S")
 * @returns {string} Formatted duration (e.g., "15:51", "1:23:45")
 * @example
 * ```ts
 * formatDuration('PT15M51S') // "15:51"
 * formatDuration('PT1H23M45S') // "1:23:45"
 * formatDuration('PT45S') // "0:45"
 * ```
 */
function formatDuration(isoDuration: string): string {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  
  if (!match) return '0:00';
  
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  
  const parts: string[] = [];
  
  if (hours > 0) {
    parts.push(hours.toString());
    parts.push(minutes.toString().padStart(2, '0'));
  } else {
    parts.push(minutes.toString());
  }
  
  parts.push(seconds.toString().padStart(2, '0'));
  
  return parts.join(':');
}

/**
 * Fetch YouTube video metadata using the YouTube Data API v3
 * @param {string} videoId - YouTube video ID
 * @param {string} apiKey - YouTube Data API key (using NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
 * @returns {Promise<YouTubeVideoMetadata>} Video metadata including duration
 * @throws {Error} If the API request fails or video is not found
 * @example
 * ```ts
 * const metadata = await fetchYouTubeVideoMetadata('dQw4w9WgXcQ', apiKey);
 * console.log(metadata.duration); // "3:33"
 * ```
 */
export async function fetchYouTubeVideoMetadata(
  videoId: string,
  apiKey: string,
): Promise<YouTubeVideoMetadata> {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'snippet,contentDetails');
  url.searchParams.set('id', videoId);
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString(), {
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!response.ok) {
    throw new Error(`YouTube API request failed: ${response.status} ${response.statusText}`);
  }

  const data: YouTubeVideosResponse = await response.json();

  if (!data.items || data.items.length === 0) {
    throw new Error(`YouTube video not found: ${videoId}`);
  }

  const video = data.items[0];
  if (!video) {
    throw new Error(`YouTube video not found: ${videoId}`);
  }
  const duration = formatDuration(video.contentDetails.duration);

  return {
    videoId,
    title: video.snippet.title,
    description: video.snippet.description,
    duration,
    durationIso: video.contentDetails.duration,
    publishedAt: video.snippet.publishedAt,
    thumbnailUrl:
      video.snippet.thumbnails.maxres?.url ||
      video.snippet.thumbnails.standard?.url ||
      video.snippet.thumbnails.high.url,
  };
}

/**
 * Fetch metadata for multiple YouTube videos in a single batch request
 * @param {string[]} videoIds - Array of YouTube video IDs (max 50)
 * @param {string} apiKey - YouTube Data API key
 * @returns {Promise<Map<string, YouTubeVideoMetadata>>} Map of videoId to metadata
 * @throws {Error} If the API request fails
 * @example
 * ```ts
 * const metadata = await fetchYouTubeVideoMetadataBatch(['id1', 'id2'], apiKey);
 * console.log(metadata.get('id1')?.duration);
 * ```
 */
export async function fetchYouTubeVideoMetadataBatch(
  videoIds: string[],
  apiKey: string,
): Promise<Map<string, YouTubeVideoMetadata>> {
  if (videoIds.length === 0) {
    return new Map();
  }

  // YouTube API allows max 50 IDs per request
  if (videoIds.length > 50) {
    throw new Error('Cannot fetch more than 50 videos in a single batch');
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'snippet,contentDetails');
  url.searchParams.set('id', videoIds.join(','));
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString(), {
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!response.ok) {
    throw new Error(`YouTube API request failed: ${response.status} ${response.statusText}`);
  }

  const data: YouTubeVideosResponse = await response.json();

  const metadataMap = new Map<string, YouTubeVideoMetadata>();

  for (const video of data.items) {
    const duration = formatDuration(video.contentDetails.duration);
    metadataMap.set(video.id, {
      videoId: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      duration,
      durationIso: video.contentDetails.duration,
      publishedAt: video.snippet.publishedAt,
      thumbnailUrl:
        video.snippet.thumbnails.maxres?.url ||
        video.snippet.thumbnails.standard?.url ||
        video.snippet.thumbnails.high.url,
    });
  }

  return metadataMap;
}
