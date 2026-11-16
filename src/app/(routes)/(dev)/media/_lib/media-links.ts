/**
 * Copyright 2026 Mike Odnis
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
 * @file Addresses as keys, for everything /media works out from links: which post and video are
 * one piece (media-pairing.ts), which project an item is about (media-projects.ts) and which
 * item a hand-written map names (media-pairs.ts, media-project-links.ts, media-topics.ts).
 * A YouTube video is keyed by its id ('yt:<id>'), anything else by its host and path
 * ('url:<host><path>'). Pure and server-safe.
 */

import { CLOSING_PUNCTUATION, SLASH, trimEnd } from '@/lib/text/trim';
import { youtubeVideoIdOf } from '@/lib/youtube/video-id';

/** The most links read from one description. */
export const DESCRIPTION_LINK_MAX = 50;
/**
 * The most characters of one text read for links: a video description's cap (the schema's), so
 * an excerpt or any other text is read no further than a description is.
 */
export const LINK_TEXT_MAX = 5_000;
/** A link in a description: from its scheme up to white space, a quote or an angle bracket. */
const LINK = /https?:\/\/[^\s<>"'`]+/gi;
/** A bare YouTube id, as a map may name a video. */
const BARE_VIDEO_ID = /^[\w-]{11}$/;

/**
 * An address as a key: 'url:' and its host in lower case without a leading www., then its path
 * without trailing slashes. The scheme, query and fragment are not part of it. Null when it is
 * not an http(s) URL.
 */
export function urlKey(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  return `url:${host}${trimEnd(url.pathname, SLASH)}`;
}

/** A link as a key: a YouTube video link by its id, any other by its address. */
export const linkKey = (link: string): string | null => {
  const videoId = youtubeVideoIdOf(link);
  return videoId === null ? urlKey(link) : `yt:${videoId}`;
};

/** A YouTube link or a bare 11-character id as a video's key; null for anything else. */
export function videoKey(named: string): string | null {
  const trimmed = named.trim();
  const videoId = youtubeVideoIdOf(trimmed) ?? (BARE_VIDEO_ID.test(trimmed) ? trimmed : null);
  return videoId === null ? null : `yt:${videoId}`;
}

/**
 * An item as a hand-written map names it, as a key: a video by its YouTube link or bare id, a
 * post or an article by its address. Null when it is neither.
 */
export const itemKey = (named: string): string | null => videoKey(named) ?? urlKey(named);

/** An entry's key: its YouTube id when it has one, else its address; null with neither. */
export const entryKey = (entry: {
  readonly videoId: string | null;
  readonly href: string | null;
}): string | null =>
  entry.videoId !== null ? `yt:${entry.videoId}` : entry.href === null ? null : urlKey(entry.href);

/**
 * Every link in a text's first {@link LINK_TEXT_MAX} characters, in text order, closing
 * punctuation trimmed (by a loop: a '[…]+$' pattern cost tens of milliseconds for a description
 * written as one link with a long run of closers), the first 50.
 */
export function linksIn(text: string | null | undefined): string[] {
  return [...(text ?? '').slice(0, LINK_TEXT_MAX).matchAll(LINK)]
    .slice(0, DESCRIPTION_LINK_MAX)
    .map(([link]) => trimEnd(link, CLOSING_PUNCTUATION));
}
