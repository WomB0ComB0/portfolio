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
/** The most IDs one videos call takes, and the most items one playlist page answers. */
const PAGE_SIZE = 50;
/**
 * The most uploads read from a channel: four playlist pages. A channel with more says so
 * ({@link ChannelUploads.complete}), so a page never states a total for a cut list.
 */
export const CHANNEL_UPLOADS_CAP = 200;

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
        likes: Schema.optional(Schema.String),
        uploads: Schema.String,
      }),
    }),
  ),
});

/** `items` is left out when no channel matches (an unknown handle). */
const ChannelResponseSchema = Schema.Struct({
  kind: Schema.String,
  etag: Schema.String,
  pageInfo: Schema.Struct({
    totalResults: Schema.Number,
    resultsPerPage: Schema.Number,
  }),
  items: Schema.optional(Schema.Array(ChannelItemSchema)),
});

/**
 * One page of a playlist read with part=contentDetails: each item's video ID only (the videos
 * call answers the rest), and the token of the next page while there is one.
 */
const PlaylistPageSchema = Schema.Struct({
  nextPageToken: Schema.optional(Schema.String),
  items: Schema.optional(
    Schema.Array(Schema.Struct({ contentDetails: Schema.Struct({ videoId: Schema.String }) })),
  ),
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

/** A channel's uploads, newest first, and whether that is every one of them. */
export interface ChannelUploads {
  readonly videos: YouTubeVideoMetadata[];
  /**
   * False when the channel has more uploads than were read ({@link CHANNEL_UPLOADS_CAP}, or the
   * caller's `maxResults`): the list is the newest ones only, so a count of it is no total.
   */
  readonly complete: boolean;
}

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

type VideoItem = Schema.Schema.Type<typeof VideoItemSchema>;

const toMetadata = (video: VideoItem): YouTubeVideoMetadata => ({
  videoId: video.id,
  title: video.snippet.title,
  description: video.snippet.description,
  duration: formatDuration(video.contentDetails.duration),
  durationIso: video.contentDetails.duration,
  publishedAt: video.snippet.publishedAt,
  thumbnailUrl:
    video.snippet.thumbnails.maxres?.url ??
    video.snippet.thumbnails.standard?.url ??
    video.snippet.thumbnails.high.url,
});

/** The metadata of at most {@link PAGE_SIZE} videos, in one call. */
async function fetchMetadataPage(
  videoIds: readonly string[],
  apiKey: string,
): Promise<Map<string, YouTubeVideoMetadata>> {
  const data = await youtubeGet(
    'videos',
    { part: 'snippet,contentDetails', id: videoIds.join(',') },
    VideosResponseSchema,
    apiKey,
  );
  return new Map(data.items.map((video) => [video.id, toMetadata(video)]));
}

/** `items` cut into runs of `size`. */
const chunksOf = <T>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );

/**
 * `promise`, with its rejection already handled: for a call started now and awaited later, so it
 * never counts as unhandled while earlier steps run. Awaiting it still rejects.
 */
function startedEarly<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => undefined);
  return promise;
}

const byNewest = (a: YouTubeVideoMetadata, b: YouTubeVideoMetadata): number =>
  new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();

/** The pages' metadata as one list, newest first, each video once (its first page's copy). */
function joinPages(pages: readonly Map<string, YouTubeVideoMetadata>[]): YouTubeVideoMetadata[] {
  const byId = new Map<string, YouTubeVideoMetadata>();
  for (const page of pages) {
    for (const [videoId, video] of page) {
      if (!byId.has(videoId)) byId.set(videoId, video);
    }
  }
  return [...byId.values()].sort(byNewest);
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch metadata for any number of YouTube videos, {@link PAGE_SIZE} per call (the API's most),
 * the calls at once. A video YouTube does not answer for (private, deleted) is left out. One
 * failed call fails the whole lookup.
 * @param {string[]} videoIds - YouTube video IDs
 * @param {string} apiKey - YouTube Data API key
 * @returns {Promise<Map<string, YouTubeVideoMetadata>>} Map of videoId to metadata
 */
export async function fetchYouTubeVideoMetadataBatch(
  videoIds: readonly string[],
  apiKey: string,
): Promise<Map<string, YouTubeVideoMetadata>> {
  const pages = await Promise.all(
    chunksOf(videoIds, PAGE_SIZE).map((ids) => fetchMetadataPage(ids, apiKey)),
  );
  return new Map(pages.flatMap((page) => [...page]));
}

/** `@name` for a handle given with or without its @. */
const handleOf = (handle: string): string => (handle.startsWith('@') ? handle : `@${handle}`);

/** True for a channel given by handle rather than by its UC… ID. */
const isHandle = (channel: string): boolean => channel.startsWith('@') || !channel.startsWith('UC');

/**
 * The uploads playlist of a channel given by handle (@name) or ID, in one call: channels.list
 * answers it for a handle as well as for an ID.
 */
async function uploadsPlaylistOf(channel: string, apiKey: string): Promise<string> {
  const query: Readonly<Record<string, string>> = isHandle(channel)
    ? { part: 'contentDetails', forHandle: handleOf(channel) }
    : { part: 'contentDetails', id: channel };
  const data = await youtubeGet('channels', query, ChannelResponseSchema, apiKey);

  const item = data.items?.[0];
  if (!item) {
    throw new Error(`YouTube channel not found: ${channel}`);
  }
  const uploadsPlaylistId = item.contentDetails?.relatedPlaylists.uploads;
  if (!uploadsPlaylistId) {
    throw new Error(`Uploads playlist not found for channel: ${channel}`);
  }
  return uploadsPlaylistId;
}

/** One page of a playlist: up to `size` video IDs, and the next page's token if there is one. */
async function readPlaylistPage(
  playlistId: string,
  apiKey: string,
  size: number,
  pageToken: string | undefined,
): Promise<{ readonly ids: readonly string[]; readonly next: string | undefined }> {
  const page = await youtubeGet(
    'playlistItems',
    {
      part: 'contentDetails',
      playlistId,
      maxResults: String(size),
      ...(pageToken === undefined ? {} : { pageToken }),
    },
    PlaylistPageSchema,
    apiKey,
  );
  const ids = (page.items ?? []).map((item) => item.contentDetails.videoId).filter(Boolean);
  return { ids, next: page.nextPageToken };
}

/**
 * Fetch a YouTube channel's uploads, newest first: its uploads playlist page by page
 * ({@link PAGE_SIZE} a page), each page's metadata asked for while the next page is read, up to
 * `maxResults` ({@link CHANNEL_UPLOADS_CAP} at most, the default). One refresh of 50 uploads is
 * three calls (channel, one page, one batch); 200 or more, nine. Any failed call fails the whole
 * listing, so a part of the list is never answered as all of it.
 *
 * Page tokens are positions, so an upload made public between two page reads shifts the list and
 * the next page repeats the last one's end: each video is listed (and asked for) once. A page
 * token already read stops the reading, and the list is then not called complete.
 * @param {string} channelHandleOrId - YouTube channel handle (@username) or channel ID
 * @param {string} apiKey - YouTube Data API key
 * @param {object} options - Fetch options
 * @param {number} options.maxResults - Most uploads to read (default and cap: CHANNEL_UPLOADS_CAP)
 * @returns {Promise<ChannelUploads>} The uploads, and whether they are all of them
 */
export async function fetchChannelVideos(
  channelHandleOrId: string,
  apiKey: string,
  options: { maxResults?: number } = {},
): Promise<ChannelUploads> {
  const limit = Math.max(
    1,
    Math.min(options.maxResults ?? CHANNEL_UPLOADS_CAP, CHANNEL_UPLOADS_CAP),
  );
  const playlistId = await uploadsPlaylistOf(channelHandleOrId, apiKey);

  const batches: Promise<Map<string, YouTubeVideoMetadata>>[] = [];
  const listed = new Set<string>();
  const tokensRead = new Set<string>();
  let read = 0;
  let next: string | undefined;
  let cut = false;
  for (let page = 0; page < Math.ceil(limit / PAGE_SIZE); page += 1) {
    const size = Math.min(PAGE_SIZE, limit - read);
    const { ids, next: token } = await readPlaylistPage(playlistId, apiKey, size, next);
    const taken = ids.slice(0, size);
    cut = taken.length < ids.length;
    read += taken.length;
    const fresh = [...new Set(taken)].filter((id) => !listed.has(id));
    for (const id of fresh) listed.add(id);
    if (fresh.length > 0) batches.push(startedEarly(fetchMetadataPage(fresh, apiKey)));
    if (next !== undefined) tokensRead.add(next);
    next = token;
    if (next === undefined || read >= limit || tokensRead.has(next)) break;
  }

  return { videos: joinPages(await Promise.all(batches)), complete: next === undefined && !cut };
}
