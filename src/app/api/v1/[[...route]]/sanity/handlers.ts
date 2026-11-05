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
import { getTalks, getYoutubeVideos } from '@/lib/sanity/api';
import { logger } from '@/utils';

/** The channel whose uploads are listed next to the videos stored in Sanity. */
const YOUTUBE_CHANNEL_HANDLE = '@mikeodnis';
/** The most uploads one YouTube API page answers. */
const CHANNEL_VIDEO_LIMIT = 50;
/** Channel videos sort after Sanity's own in `order`. */
const CHANNEL_ORDER_OFFSET = 100;
const YOUTUBE_VIDEO_ID = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/;

/** A video in the /videos answer, tagged with where it came from. */
export type ListedVideo = YoutubeVideo & { readonly source: 'sanity' | 'youtube-api' };

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const youtubeIdOfTalk = (talk: Talk): string | null =>
  talk.videoFormat === 'youtube' ? (talk.videoUrl?.match(YOUTUBE_VIDEO_ID)?.[1] ?? null) : null;

/**
 * Replaces stored durations with YouTube's. Durations are optional, so a YouTube failure keeps
 * the stored ones instead of failing the route.
 */
async function withYoutubeDurations(talks: Talk[], apiKey: string): Promise<Talk[]> {
  const videoIds = talks.map(youtubeIdOfTalk).filter((id): id is string => id !== null);
  if (videoIds.length === 0) return talks;

  try {
    const metadata = await fetchYouTubeVideoMetadataBatch(videoIds, apiKey);
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

/** All talks, with YouTube durations where a key is set. Throws when Sanity fails. */
export async function loadTalks(): Promise<Talk[]> {
  const talks = await getTalks();
  const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
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
 * The channel's uploads. They are most of the list, so a failure fails the route (which then
 * serves its last good list) rather than answering a list that silently lost them.
 */
async function loadChannelVideos(apiKey: string): Promise<ListedVideo[]> {
  try {
    const videos = await fetchChannelVideos(YOUTUBE_CHANNEL_HANDLE, apiKey, {
      maxResults: CHANNEL_VIDEO_LIMIT,
    });
    return videos.map(toChannelVideo);
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
    const metadata = await fetchYouTubeVideoMetadataBatch(
      videos.map((video) => video.videoId),
      apiKey,
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
 * The videos stored in Sanity plus the channel's uploads. With no Sanity videos that is the
 * channel alone, and with no YouTube key it is Sanity's list alone (possibly empty). Throws when
 * Sanity or the channel listing fails.
 */
export async function loadYoutubeVideos(): Promise<YoutubeVideo[]> {
  const sanityVideos = await getYoutubeVideos();
  const apiKey = env.YOUTUBE_SERVER_API_KEY;
  if (!apiKey) return sanityVideos;

  const [channelVideos, enrichedVideos] = await Promise.all([
    loadChannelVideos(apiKey),
    withYoutubeMetadata(sanityVideos, apiKey),
  ]);
  return mergeVideos(enrichedVideos, channelVideos);
}
