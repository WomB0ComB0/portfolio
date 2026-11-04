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
 * Cover images for Hashnode posts.
 *
 * The RSS feed has no per-item image, so each post's cover is read from the `og:image` meta tag
 * of its page. Only the page's `<head>` is downloaded: the body is cancelled as soon as
 * `</head>` arrives, or once {@link HEAD_CHAR_LIMIT} characters have been read.
 */

import { FetchHttpClient, HttpClient } from '@effect/platform';
import { Cause, Duration, Effect, Stream } from 'effect';
import { HASHNODE_COVER_PATTERNS } from '@/config/blog-images';
import { logger } from '@/utils';
import { type Blog, HASHNODE_BLOG_URL } from './blogs';

/** Upper bound on how much of a post page is read while looking for `</head>`. */
export const HEAD_CHAR_LIMIT = 64 * 1024;
const COVER_TIMEOUT = Duration.seconds(5);
const COVER_CONCURRENCY = 5;

const HEAD_END = /<\/head\s*>/i;
const META_TAG = /<meta\b[^>]*>/gi;
/** Meta keys that name a page's share image, in order of preference. */
const COVER_KEYS = [
  'og:image',
  'og:image:url',
  'og:image:secure_url',
  'twitter:image',
  'twitter:image:src',
] as const;

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
};

/** Matches `name=value` inside a tag, with the value double-quoted, single-quoted or bare. */
const attributePattern = (name: string) =>
  new RegExp(`[\\s/]${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\`]+))`, 'i');

const PROPERTY_ATTR = attributePattern('property');
const NAME_ATTR = attributePattern('name');
const CONTENT_ATTR = attributePattern('content');

function readAttribute(tag: string, pattern: RegExp): string | undefined {
  const match = tag.match(pattern);
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith('#')) {
      const isHex = code[1] === 'x' || code[1] === 'X';
      const point = Number.parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
  });
}

/** Mirrors next/image's remote pattern check for the two pathname forms the patterns use. */
function matchesPathname(pathname: string, pattern: string): boolean {
  return pattern.endsWith('/**') ? pathname.startsWith(pattern.slice(0, -2)) : pathname === pattern;
}

/** Whether next/image is configured to load this URL as a Hashnode cover. */
export function isAllowedCoverUrl(url: URL): boolean {
  return HASHNODE_COVER_PATTERNS.some(
    (pattern) =>
      url.protocol === `${pattern.protocol}:` &&
      url.hostname === pattern.hostname &&
      (!('pathname' in pattern) || matchesPathname(url.pathname, pattern.pathname)),
  );
}

function toCoverUrl(raw: string, pageUrl: string): string | undefined {
  try {
    const url = new URL(decodeEntities(raw.trim()), pageUrl);
    return isAllowedCoverUrl(url) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Finds a page's cover image in its `<head>` meta tags.
 *
 * Reads `og:image`, then `og:image:url`, `og:image:secure_url`, `twitter:image` and
 * `twitter:image:src`, with attributes in any order and any quoting. Relative URLs resolve
 * against `pageUrl`. A candidate is used only if it is HTTPS and matches
 * {@link HASHNODE_COVER_PATTERNS}; otherwise the next one is tried.
 *
 * @param html - The page's HTML, or just its beginning. Anything after `</head>` is ignored.
 * @param pageUrl - The page's URL, used to resolve relative image URLs.
 * @returns The absolute cover URL, or `undefined` when the head names no usable image.
 * @public
 */
export function extractCoverImage(html: string, pageUrl: string): string | undefined {
  const end = html.search(HEAD_END);
  const head = end === -1 ? html : html.slice(0, end);

  const metas = Array.from(head.matchAll(META_TAG), ([tag]) => ({
    key: (readAttribute(tag, PROPERTY_ATTR) ?? readAttribute(tag, NAME_ATTR))?.toLowerCase(),
    content: readAttribute(tag, CONTENT_ATTR),
  }));

  const candidates = COVER_KEYS.flatMap((key) =>
    metas.flatMap((meta) => (meta.key === key && meta.content ? [meta.content] : [])),
  );

  for (const candidate of candidates) {
    const url = toCoverUrl(candidate, pageUrl);
    if (url) return url;
  }
  return undefined;
}

/** Reads a page up to and including `</head>`, then cancels the rest of the body. */
const readHead = (url: string) =>
  Effect.gen(function* () {
    const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient);
    const response = yield* client.get(url, { headers: { accept: 'text/html' } });
    return yield* response.stream.pipe(
      Stream.decodeText(),
      Stream.runFoldWhile(
        '',
        (html) => html.length < HEAD_CHAR_LIMIT && !HEAD_END.test(html),
        (html, chunk) => (html + chunk).slice(0, HEAD_CHAR_LIMIT),
      ),
    );
  });

const withCover = (post: Blog, timeout: Duration.DurationInput) => {
  if (post.imageUrl) return Effect.succeed(post);
  const pageUrl = `${HASHNODE_BLOG_URL}/${post.slug}`;
  return readHead(pageUrl).pipe(
    Effect.timeout(timeout),
    Effect.map((html) => extractCoverImage(html, pageUrl)),
    Effect.catchAllCause((cause) =>
      Effect.sync(() => {
        logger.warn('Could not read the cover of a Hashnode post', {
          slug: post.slug,
          error: String(Cause.squash(cause)),
        });
        return undefined;
      }),
    ),
    Effect.map((imageUrl): Blog => (imageUrl ? { ...post, imageUrl } : post)),
  );
};

/** Options for {@link addHashnodeCovers}. */
export interface HashnodeCoverOptions {
  /** How long each post page may take, from request to `</head>` (default 5 seconds). */
  readonly timeout?: Duration.DurationInput;
}

/**
 * Adds `imageUrl` to Hashnode posts from the `og:image` of each post's page.
 *
 * Fetches `${HASHNODE_BLOG_URL}/${slug}` for every post without an `imageUrl`, a few at a time,
 * and reads only the page's `<head>`. A post whose page fails, times out or names no usable
 * image is returned unchanged, so the promise never rejects because of a cover.
 *
 * @param posts - Posts from {@link getBlogs}.
 * @param options - See {@link HashnodeCoverOptions}.
 * @returns A new array in the same order. A post that gains a cover is copied; the others are
 *   returned as they were. The input is not modified.
 * @public
 * @example
 * const posts = await getBlogs().then((blogs) => addHashnodeCovers(blogs));
 */
export function addHashnodeCovers(
  posts: readonly Blog[],
  { timeout = COVER_TIMEOUT }: HashnodeCoverOptions = {},
): Promise<Blog[]> {
  return Effect.runPromise(
    Effect.forEach(posts, (post) => withCover(post, timeout), {
      concurrency: COVER_CONCURRENCY,
    }).pipe(Effect.provide(FetchHttpClient.layer)),
  );
}
