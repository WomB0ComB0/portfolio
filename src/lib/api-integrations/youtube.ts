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
 *
 * The API key rides in the X-Goog-Api-Key request header, never in a URL: a failed request's
 * error names its URL (and the dev server logs every fetched URL), so a key in the query string
 * would reach error text, the error tracker and logs. Every query value is percent-encoded.
 */

import { FetchHttpClient } from '@effect/platform';
import { Effect, pipe, Schema } from 'effect';
import { get } from '@/lib/http-clients/effect-fetcher';

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';

// ============================================================================
// Effect Schemas for YouTube API v3 Responses
// ============================================================================

const ThumbnailSchema = Schema.Struct({
  url: Schema.String,
  width: Schema.Number,
  height: Schema.Number,
});

const ThumbnailsSchema = Schema.Struct({
  default: ThumbnailSchema,
  medium: ThumbnailSchema,
  high: ThumbnailSchema,
  standard: Schema.optional(ThumbnailSchema),
  maxres: Schema.optional(ThumbnailSchema),
});

const VideoSnippetSchema = Schema.Struct({
  title: Schema.String,
  description: Schema.String,
  publishedAt: Schema.String,
  thumbnails: ThumbnailsSchema,
});

const VideoContentDetailsSchema = Schema.Struct({
  duration: Schema.String,
  dimension: Schema.String,
  definition: Schema.String,
  caption: Schema.String,
});

const VideoItemSchema = Schema.Struct({
  kind: Schema.String,
  etag: Schema.String,
  id: Schema.String,
  snippet: VideoSnippetSchema,
  contentDetails: VideoContentDetailsSchema,
});

const VideosResponseSchema = Schema.Struct({
  kind: Schema.String,
  etag: Schema.String,
  pageInfo: Schema.Struct({
    totalResults: Schema.Number,
    resultsPerPage: Schema.Number,
  }),
  items: Schema.Array(VideoItemSchema),
});

const ChannelItemSchema = Schema.Struct({
  kind: Schema.String,
  etag: Schema.String,
  id: Schema.String,
  contentDetails: Schema.optional(
    Schema.Struct({
      relatedPlaylists: Schema.Struct({
        likes: Schema.String,
        uploads: Schema.String,
      }),
    }),
  ),
});

const ChannelResponseSchema = Schema.Struct({
  kind: Schema.String,
  etag: Schema.String,
  pageInfo: Schema.Struct({
    totalResults: Schema.Number,
    resultsPerPage: Schema.Number,
  }),
  items: Schema.Array(ChannelItemSchema),
});

const ChannelIdResponseSchema = Schema.Struct({
  items: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.String,
      }),
    ),
  ),
});

const PlaylistItemSnippetSchema = Schema.Struct({
  publishedAt: Schema.String,
  channelId: Schema.String,
  title: Schema.String,
  description: Schema.String,
  thumbnails: ThumbnailsSchema,
  channelTitle: Schema.String,
  playlistId: Schema.String,
  position: Schema.Number,
  resourceId: Schema.Struct({
    kind: Schema.String,
    videoId: Schema.String,
  }),
});

const PlaylistItemSchema = Schema.Struct({
  kind: Schema.String,
  etag: Schema.String,
  id: Schema.String,
  snippet: PlaylistItemSnippetSchema,
});

const PlaylistItemsResponseSchema = Schema.Struct({
  kind: Schema.String,
  etag: Schema.String,
  nextPageToken: Schema.optional(Schema.String),
  pageInfo: Schema.Struct({
    totalResults: Schema.Number,
    resultsPerPage: Schema.Number,
  }),
  items: Schema.Array(PlaylistItemSchema),
});

// ============================================================================
// Exported Schema for Video Metadata
// ============================================================================

export const YouTubeVideoMetadataSchema = Schema.Struct({
  videoId: Schema.String,
  title: Schema.String,
  description: Schema.String,
  duration: Schema.String,
  durationIso: Schema.String,
  publishedAt: Schema.String,
  thumbnailUrl: Schema.String,
});

export type YouTubeVideoMetadata = Schema.Schema.Type<typeof YouTubeVideoMetadataSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert ISO 8601 duration to human-readable format
 * @param {string} isoDuration - ISO 8601 duration (e.g., "PT15M51S", "PT1H23M45S")
 * @returns {string} Formatted duration (e.g., "15:51", "1:23:45")
 */
function formatDuration(isoDuration: string): string {
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const match = regex.exec(isoDuration);

  if (!match) return '0:00';

  const hours = Number.parseInt(match[1] ?? '0', 10);
  const minutes = Number.parseInt(match[2] ?? '0', 10);
  const seconds = Number.parseInt(match[3] ?? '0', 10);

  const parts: string[] =
    hours > 0 ? [hours.toString(), minutes.toString().padStart(2, '0')] : [minutes.toString()];

  parts.push(seconds.toString().padStart(2, '0'));

  return parts.join(':');
}

/**
 * One GET to the API's `endpoint`, its answer checked against `schema`. The query is
 * percent-encoded (URLSearchParams), and the key goes in the X-Goog-Api-Key header, so neither a
 * failure's message nor a logged URL ever carries it.
 */
function youtubeGet<T, I>(
  endpoint: string,
  query: Readonly<Record<string, string>>,
  schema: Schema.Schema<T, I, never>,
  apiKey: string,
): Promise<T> {
  const url = `${YOUTUBE_API}/${endpoint}?${new URLSearchParams(query).toString()}`;
  return Effect.runPromise(
    pipe(
      get<T>(url, {
        schema,
        retries: 2,
        timeout: 10_000,
        headers: { 'X-Goog-Api-Key': apiKey },
      }),
      Effect.provide(FetchHttpClient.layer),
    ),
  );
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch YouTube video metadata using the YouTube Data API v3
 * @param {string} videoId - YouTube video ID
 * @param {string} apiKey - YouTube Data API key
 * @returns {Promise<YouTubeVideoMetadata>} Video metadata including duration
 */
export async function fetchYouTubeVideoMetadata(
  videoId: string,
  apiKey: string,
): Promise<YouTubeVideoMetadata> {
  const data = await youtubeGet(
    'videos',
    { part: 'snippet,contentDetails', id: videoId },
    VideosResponseSchema,
    apiKey,
  );

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
      video.snippet.thumbnails.maxres?.url ??
      video.snippet.thumbnails.standard?.url ??
      video.snippet.thumbnails.high.url,
  };
}

/**
 * Fetch metadata for multiple YouTube videos in a single batch request
 * @param {string[]} videoIds - Array of YouTube video IDs (max 50)
 * @param {string} apiKey - YouTube Data API key
 * @returns {Promise<Map<string, YouTubeVideoMetadata>>} Map of videoId to metadata
 */
export async function fetchYouTubeVideoMetadataBatch(
  videoIds: string[],
  apiKey: string,
): Promise<Map<string, YouTubeVideoMetadata>> {
  if (videoIds.length === 0) {
    return new Map();
  }

  if (videoIds.length > 50) {
    throw new Error('Cannot fetch more than 50 videos in a single batch');
  }

  const data = await youtubeGet(
    'videos',
    { part: 'snippet,contentDetails', id: videoIds.join(',') },
    VideosResponseSchema,
    apiKey,
  );

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
        video.snippet.thumbnails.maxres?.url ??
        video.snippet.thumbnails.standard?.url ??
        video.snippet.thumbnails.high.url,
    });
  }

  return metadataMap;
}

/**
 * Resolve a YouTube channel handle (e.g., @mikeodnis) to a channel ID
 * @param {string} handle - YouTube channel handle (with or without @)
 * @param {string} apiKey - YouTube Data API key
 * @returns {Promise<string>} Channel ID
 */
export async function resolveChannelHandle(handle: string, apiKey: string): Promise<string> {
  const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;

  const data = await youtubeGet(
    'channels',
    { part: 'id', forHandle: cleanHandle },
    ChannelIdResponseSchema,
    apiKey,
  );

  if (!data.items || data.items.length === 0) {
    throw new Error(`YouTube channel not found: ${cleanHandle}`);
  }

  const channelId = data.items[0]?.id;
  if (!channelId) {
    throw new Error(`YouTube channel not found: ${cleanHandle}`);
  }

  return channelId;
}

/**
 * Get the uploads playlist ID for a YouTube channel
 * @param {string} channelId - YouTube channel ID
 * @param {string} apiKey - YouTube Data API key
 * @returns {Promise<string>} Uploads playlist ID
 */
async function getUploadsPlaylistId(channelId: string, apiKey: string): Promise<string> {
  const data = await youtubeGet(
    'channels',
    { part: 'contentDetails', id: channelId },
    ChannelResponseSchema,
    apiKey,
  );

  if (!data.items || data.items.length === 0) {
    throw new Error(`YouTube channel not found: ${channelId}`);
  }

  const uploadsPlaylistId = data.items[0]?.contentDetails?.relatedPlaylists.uploads;
  if (!uploadsPlaylistId) {
    throw new Error(`Uploads playlist not found for channel: ${channelId}`);
  }

  return uploadsPlaylistId;
}

/**
 * Fetch all videos from a YouTube channel
 * @param {string} channelHandleOrId - YouTube channel handle (@username) or channel ID
 * @param {string} apiKey - YouTube Data API key
 * @param {object} options - Fetch options
 * @param {number} options.maxResults - Maximum number of videos to fetch (default: 50)
 * @returns {Promise<YouTubeVideoMetadata[]>} Array of video metadata
 */
export async function fetchChannelVideos(
  channelHandleOrId: string,
  apiKey: string,
  options: { maxResults?: number } = {},
): Promise<YouTubeVideoMetadata[]> {
  const { maxResults = 50 } = options;

  // Resolve handle to channel ID if needed
  let channelId = channelHandleOrId;
  if (channelHandleOrId.startsWith('@') || !channelHandleOrId.startsWith('UC')) {
    channelId = await resolveChannelHandle(channelHandleOrId, apiKey);
  }

  // Get the uploads playlist ID
  const uploadsPlaylistId = await getUploadsPlaylistId(channelId, apiKey);

  // Fetch playlist items (video IDs and basic info)
  const playlistData = await youtubeGet(
    'playlistItems',
    {
      part: 'snippet',
      playlistId: uploadsPlaylistId,
      maxResults: String(Math.min(maxResults, 50)),
    },
    PlaylistItemsResponseSchema,
    apiKey,
  );

  if (!playlistData.items || playlistData.items.length === 0) {
    return [];
  }

  // Extract video IDs
  const videoIds = playlistData.items
    .map((item) => item.snippet.resourceId.videoId)
    .filter(Boolean);

  // Fetch full video metadata (including duration)
  const metadataMap = await fetchYouTubeVideoMetadataBatch(videoIds, apiKey);

  // Convert to array and sort by publish date (newest first)
  const videos = Array.from(metadataMap.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return videos;
}
