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

import { type Cause, Duration, Effect, Result, Schedule, Schema } from 'effect';
import { FetchHttpClient, HttpClient, type HttpClientError } from 'effect/http';
import { XMLParser } from 'fast-xml-parser';
import { SLASH, trimEdges } from '@/lib/text/trim';
import { youtubeIdsIn } from '@/lib/youtube/video-id';
import { logger } from '@/utils';

/**
 * The Hashnode publication that hosts the blog.
 *
 * Posts are read from the publication's public RSS feed. Hashnode retired free GraphQL API
 * access: every query now needs a paid Pro plan, and `gql.hashnode.com` 301-redirects other
 * callers to an HTML announcement page, which is what broke the old GraphQL integration.
 * @see https://hashnode.com/announcements/graphql-api
 */
export const HASHNODE_BLOG_URL = 'https://blog.mikeodnis.dev';

const HASHNODE_FEED_URL = `${HASHNODE_BLOG_URL}/rss.xml`;
const FEED_TIMEOUT = Duration.seconds(10);
const FEED_RETRIES = 2;
const FEED_RETRY_BASE_DELAY = Duration.millis(500);
const DEFAULT_LIMIT = 10;
/**
 * The longest excerpt kept. Hashnode's are a few sentences; a longer one is cut here, before
 * /media reads its links and summary, so one oversized feed item cannot slow every feed build.
 */
const EXCERPT_MAX = 5_000;

/**
 * @readonly
 * @description
 * Schema definition for a blog post from the Hashnode publication.
 * @public
 */
export const BlogSchema = Schema.Struct({
  title: Schema.String,
  slug: Schema.String,
  publishedAt: Schema.String,
  excerpt: Schema.String,
  imageUrl: Schema.optional(Schema.String),
  /** The YouTube videos the post's body embeds or links, in order; absent when there are none. */
  videoIds: Schema.optional(Schema.Array(Schema.String)),
});

/**
 * TypeScript type representing a blog post from the Hashnode publication.
 * @see BlogSchema
 * @public
 */
export type Blog = Schema.Schema.Type<typeof BlogSchema>;

/** The fields read from each RSS `<item>`; everything else in the feed is ignored. */
const FeedItemSchema = Schema.Struct({
  title: Schema.String,
  link: Schema.String,
  pubDate: Schema.String,
  description: Schema.optional(Schema.String),
  // The post's body. Read only for the YouTube ids in it; anything but a string is ignored.
  'content:encoded': Schema.optional(Schema.Unknown),
});

type FeedItem = Schema.Schema.Type<typeof FeedItemSchema>;

const decodeFeedItem = Schema.decodeUnknownResult(FeedItemSchema);

const feedParser = new XMLParser({
  ignoreAttributes: true,
  // Keep every value a string: a title such as "2024" must not become a number.
  parseTagValue: false,
  trimValues: true,
  // `<item>` only occurs at rss.channel.item; force an array even when the feed has one post.
  isArray: (tagName) => tagName === 'item',
});

/**
 * Maps a feed item to a blog entry, or `null` when it has no title, usable link or valid date. The
 * slug is the link's path without its edge slashes, trimmed by a loop: with '/^\/+|\/+$/', a slash
 * run inside the path took time that grew with the run's square.
 */
function toBlog(item: FeedItem): Blog | null {
  const title = item.title.trim();
  const published = new Date(item.pubDate);
  let slug: string;
  try {
    slug = trimEdges(new URL(item.link).pathname, SLASH);
  } catch {
    return null;
  }
  if (!title || !slug || Number.isNaN(published.getTime())) return null;
  const body = item['content:encoded'];
  const videoIds = typeof body === 'string' ? youtubeIdsIn(body) : [];
  return {
    title,
    slug,
    publishedAt: published.toISOString(),
    excerpt: item.description?.trim().slice(0, EXCERPT_MAX) ?? '',
    ...(videoIds.length > 0 ? { videoIds } : {}),
  };
}

/**
 * Parses a Hashnode RSS feed into blog entries, newest first.
 *
 * Items without a title, a valid link or a parseable `pubDate` are skipped, and the number
 * skipped is logged as a warning.
 *
 * @param xml - The RSS document.
 * @param limit - Maximum number of entries to return.
 * @returns Blog entries sorted by `publishedAt`, newest first. `imageUrl` is never set: the feed
 *   carries no cover images (`addHashnodeCovers` reads them from each post page). `videoIds` is
 *   set only for a post whose body (`content:encoded`) embeds or links a YouTube video.
 * @throws {Error} If the document is not an RSS feed, for example an HTML error or redirect page.
 * @public
 */
export function parseHashnodeRss(xml: string, limit = DEFAULT_LIMIT): Blog[] {
  const doc: unknown = feedParser.parse(xml);
  const channel = (doc as { rss?: { channel?: unknown } } | null | undefined)?.rss?.channel;
  if (!channel || typeof channel !== 'object') {
    throw new Error(`Hashnode feed is not RSS (starts with ${JSON.stringify(xml.slice(0, 80))})`);
  }

  const rawItems = (channel as { item?: unknown }).item;
  const items: unknown[] = Array.isArray(rawItems) ? rawItems : [];
  const blogs = items.flatMap((raw) => {
    const decoded = decodeFeedItem(raw);
    const blog = Result.isSuccess(decoded) ? toBlog(decoded.success) : null;
    return blog ? [blog] : [];
  });

  const skipped = items.length - blogs.length;
  if (skipped > 0) {
    logger.warn(`Skipped ${skipped} malformed Hashnode feed item(s)`);
  }

  // ISO-8601 UTC strings sort chronologically as plain strings.
  return [...blogs].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, limit);
}

/** Retry timeouts, transport errors, unreadable bodies, 429 and 5xx; other 4xx won't fix themselves. */
function isRetryable(error: HttpClientError.HttpClientError | Cause.TimeoutError): boolean {
  if (error._tag === 'HttpClientError' && error.reason._tag === 'StatusCodeError') {
    const { status } = error.reason.response;
    return status === 429 || status >= 500;
  }
  return true;
}

const fetchFeedXml = Effect.gen(function* () {
  const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient);
  const response = yield* client.get(HASHNODE_FEED_URL, {
    headers: { accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.1' },
  });
  return yield* response.text;
}).pipe(
  Effect.timeout(FEED_TIMEOUT),
  Effect.retry({
    times: FEED_RETRIES,
    schedule: Schedule.exponential(FEED_RETRY_BASE_DELAY),
    while: isRetryable,
  }),
  Effect.provide(FetchHttpClient.layer),
);

/**
 * Fetches the newest posts from the Hashnode blog's public RSS feed.
 *
 * @param limit - Maximum number of posts to return (default 10).
 * @returns Posts newest first, without `imageUrl` (the feed has no cover images; pass them to
 *   `addHashnodeCovers` to read each post's cover from its page).
 * @throws If the feed can't be fetched or isn't RSS. The blog route logs the failure and still
 *   serves the other sources.
 * @public
 * @example
 * const posts = await getBlogs(5);
 * posts.forEach((post) => console.log(post.title, post.slug));
 */
export async function getBlogs(limit = DEFAULT_LIMIT): Promise<Blog[]> {
  const xml = await Effect.runPromise(fetchFeedXml);
  return parseHashnodeRss(xml, limit);
}
