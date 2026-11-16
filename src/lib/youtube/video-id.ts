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
 * @file YouTube video ids, read out of a link or out of a text. Pure, and its one import is the
 * dependency-free trim helper, so a feed parser can use it without loading anything else.
 *
 * `youtubeVideoIdOf` is the site's one reader of a video link: the talks loader
 * (src/lib/sanity/enrich.ts) and /media both use it. `youtubeIdsIn` reads every id a post body
 * links or embeds.
 */

import { CLOSING_PUNCTUATION, trimEnd } from '@/lib/text/trim';

/** A YouTube video ID: 11 characters of letters, digits, '-' and '_'. */
const YOUTUBE_VIDEO_ID = /^[\w-]{11}$/;
/** youtube.com paths whose next segment is the video ID, e.g. /embed/ID or /shorts/ID. */
const YOUTUBE_ID_PATHS = new Set(['embed', 'shorts', 'live', 'v']);
const HAS_SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;
/** A link in text or HTML: with its scheme, or protocol-relative as an embed's src often is. */
const LINK = /(?:https?:)?\/\/[^\s<>"'`\\]+/gi;
/** The most ids read from one text. */
const DEFAULT_MAX_IDS = 20;

/** Parses `value` as a URL, taking a link pasted without its scheme as https. */
function parseUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  try {
    return new URL(HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/\//, '')}`);
  } catch {
    return null;
  }
}

const isYoutubeHost = (host: string): boolean =>
  host === 'youtube.com' ||
  host.endsWith('.youtube.com') ||
  host === 'youtube-nocookie.com' ||
  host.endsWith('.youtube-nocookie.com');

/** The ID candidate in a youtu.be or youtube.com URL, before it is checked. */
function videoIdCandidate(url: URL): string | null | undefined {
  const host = url.hostname.toLowerCase();
  const [first, second] = url.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be') return first;
  if (!isYoutubeHost(host)) return null;
  if (first === 'watch') return url.searchParams.get('v');
  return first !== undefined && YOUTUBE_ID_PATHS.has(first) ? second : null;
}

/**
 * The video ID in a YouTube link: youtube.com/watch?v=ID, youtu.be/ID, and youtube.com's
 * /embed/, /shorts/, /live/ and /v/ paths. Query strings (?si=, ?t=, &list=) and fragments are
 * not part of the ID. Answers null for any other link, or one whose ID is not a YouTube ID.
 */
export function youtubeVideoIdOf(link: string): string | null {
  const url = parseUrl(link);
  const candidate = url ? videoIdCandidate(url) : null;
  return candidate && YOUTUBE_VIDEO_ID.test(candidate) ? candidate : null;
}

/**
 * Every YouTube video id a text or an HTML string links or embeds, in order, each once, `max`
 * at most. `&amp;` is decoded before a link is read, as HTML writes a query string, and closing
 * punctuation is trimmed by a loop: a post body is not capped, and with a '[…]+$' pattern one link
 * with a long run of closers took seconds per feed build.
 */
export function youtubeIdsIn(text: string, max = DEFAULT_MAX_IDS): string[] {
  const ids: string[] = [];
  for (const [link] of text.matchAll(LINK)) {
    if (ids.length >= max) break;
    const id = youtubeVideoIdOf(trimEnd(link.replaceAll('&amp;', '&'), CLOSING_PUNCTUATION));
    if (id !== null && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
