import 'server-only';
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
 * @file Loaders for the Sanity routes that add YouTube data to what Sanity stores. Caching, and
 * what a failure answers, is up to the route (see serve.ts). A Sanity failure always throws.
 */

import { ensureBaseError } from '@/classes/error';
import { env } from '@/env';
import type { Talk, YoutubeVideo } from '@/hooks/sanity/schemas';
import {
  fetchChannelVideos,
  fetchYouTubeVideoMetadataBatch,
  type YouTubeVideoMetadata,
} from '@/lib/api-integrations/youtube';
import { withDeadline } from '@/lib/async/deadline';
import { getTalks, getYoutubeVideos } from '@/lib/sanity/api';
import { YOUTUBE_CHANNEL_HANDLE } from '@/lib/youtube/channel';
import { youtubeVideoIdOf } from '@/lib/youtube/video-id';
import { logger } from '@/utils';

/**
 * How long the optional enrichment (talk durations, stored videos' titles) may wait on YouTube
 * before the stored values are used. Well under the routes' overall YouTube deadline, so a slow
 * YouTube costs the extra details, not the whole list.
 */
export const YOUTUBE_ENRICHMENT_DEADLINE_MS = 4_000;

/** Channel videos sort after Sanity's own in `order`. */
const CHANNEL_ORDER_OFFSET = 100;

/** A video in the /videos answer, tagged with where it came from. */
export type ListedVideo = YoutubeVideo & { readonly source: 'sanity' | 'youtube-api' };

/** The videos list, and whether it holds every upload its sources have. */
export interface VideoListing {
  /** Sanity's videos plus the channel's uploads, newest first. */
  readonly videos: YoutubeVideo[];
  /**
   * False when the channel has more uploads than were read (CHANNEL_UPLOADS_CAP in youtube.ts):
   * the list then holds the newest uploads only, so a page must not state its count as a total.
   * True when every upload was read, and without a YouTube key (Sanity's list is all there is).
   */
  readonly complete: boolean;
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * The talk's YouTube video ID, read by the site's one link parser (src/lib/youtube/video-id.ts).
 * Documents are not decoded yet, so a `videoUrl` that is not a string answers null here and the
 * talk is left for the decoder to drop, alone.
 */
const youtubeIdOfTalk = (talk: Talk): string | null =>
  talk.videoFormat === 'youtube' && typeof talk.videoUrl === 'string'
    ? youtubeVideoIdOf(talk.videoUrl)
    : null;

/**
 * Replaces stored durations with YouTube's. Durations are optional, so a YouTube failure keeps
 * the stored ones instead of failing the route.
 */
async function withYoutubeDurations(talks: Talk[], apiKey: string): Promise<Talk[]> {
  const videoIds = talks.map(youtubeIdOfTalk).filter((id): id is string => id !== null);
  if (videoIds.length === 0) return talks;

  try {
    const metadata = await withDeadline(
      fetchYouTubeVideoMetadataBatch(videoIds, apiKey),
      YOUTUBE_ENRICHMENT_DEADLINE_MS,
      'youtube talk durations',
    );
    return talks.map((talk) => {
      const duration = metadata.get(youtubeIdOfTalk(talk) ?? '')?.duration;
      return duration ? { ...talk, duration } : talk;
    });
  } catch (error) {
    logger.warn('Failed to fetch YouTube durations for talks, keeping the stored ones', {
      error: messageOf(error),
    });
    return talks;
  }
}

/**
 * All talks, with YouTube durations where the server key is set. Throws when Sanity fails. The
 * public Firebase browser key is never used here: it is in every visitor's bundle, so it is not
 * a key to spend server-side YouTube quota on.
 */
export async function loadTalks(): Promise<Talk[]> {
  const talks = await getTalks();
  const apiKey = env.YOUTUBE_SERVER_API_KEY;
  return apiKey ? withYoutubeDurations(talks, apiKey) : talks;
}

const toChannelVideo = (video: YouTubeVideoMetadata, index: number): ListedVideo => ({
  _id: `yt-channel-${video.videoId}`,
  _type: 'youtubeVideo',
  _createdAt: video.publishedAt,
  _updatedAt: video.publishedAt,
  _rev: `yt-${video.videoId}`,
  videoId: video.videoId,
  title: video.title,
  description: video.description,
  publishedDate: video.publishedAt,
  duration: video.duration,
  tags: ['YouTube'],
  order: index + CHANNEL_ORDER_OFFSET,
  source: 'youtube-api',
});

/**
 * The channel's uploads (up to CHANNEL_UPLOADS_CAP, page by page), and whether that was all of
 * them. They are most of the list, so a failure fails the route (which then serves its last good
 * list) rather than answering a list that silently lost them.
 */
async function loadChannelVideos(
  apiKey: string,
): Promise<{ readonly videos: ListedVideo[]; readonly complete: boolean }> {
  try {
    const { videos, complete } = await fetchChannelVideos(YOUTUBE_CHANNEL_HANDLE, apiKey);
    return { videos: videos.map(toChannelVideo), complete };
  } catch (error) {
    throw ensureBaseError(error, 'youtube:channel-videos', { channel: YOUTUBE_CHANNEL_HANDLE });
  }
}

/**
 * Replaces stored titles, descriptions and durations with YouTube's. The stored ones are real
 * too, so a YouTube failure keeps them instead of failing the route.
 */
async function withYoutubeMetadata(
  videos: YoutubeVideo[],
  apiKey: string,
): Promise<YoutubeVideo[]> {
  if (videos.length === 0) return videos;

  try {
    const metadata = await withDeadline(
      fetchYouTubeVideoMetadataBatch(
        videos.map((video) => video.videoId),
        apiKey,
      ),
      YOUTUBE_ENRICHMENT_DEADLINE_MS,
      'youtube video metadata',
    );
    return videos.map((video) => {
      const live = metadata.get(video.videoId);
      return live
        ? { ...video, title: live.title, description: live.description, duration: live.duration }
        : video;
    });
  } catch (error) {
    logger.warn('Failed to fetch YouTube metadata for Sanity videos, keeping the stored ones', {
      error: messageOf(error),
    });
    return videos;
  }
}

const byNewest = (a: ListedVideo, b: ListedVideo): number =>
  new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();

/** Sanity's videos win over the same video from the channel; newest first. */
function mergeVideos(sanityVideos: YoutubeVideo[], channelVideos: ListedVideo[]): ListedVideo[] {
  const sanityIds = new Set(sanityVideos.map((video) => video.videoId));
  return [
    ...sanityVideos.map((video): ListedVideo => ({ ...video, source: 'sanity' })),
    ...channelVideos.filter((video) => !sanityIds.has(video.videoId)),
  ].sort(byNewest);
}

/**
 * The videos stored in Sanity plus the channel's uploads, and whether that is every upload. With
 * no Sanity videos that is the channel alone, and with no YouTube key it is Sanity's list alone
 * (possibly empty). Throws when Sanity or the channel listing fails.
 */
export async function loadVideoListing(): Promise<VideoListing> {
  const sanityVideos = await getYoutubeVideos();
  const apiKey = env.YOUTUBE_SERVER_API_KEY;
  if (!apiKey) return { videos: sanityVideos, complete: true };

  const [channel, enrichedVideos] = await Promise.all([
    loadChannelVideos(apiKey),
    withYoutubeMetadata(sanityVideos, apiKey),
  ]);
  return { videos: mergeVideos(enrichedVideos, channel.videos), complete: channel.complete };
}
