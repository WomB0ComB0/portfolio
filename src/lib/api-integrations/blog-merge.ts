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
 * Merges the Hashnode and dev.to feeds into one list in which each cross-posted article
 * appears once. Pure: no I/O, and the inputs are never modified.
 */

import { type Blog, HASHNODE_BLOG_URL } from './blogs';
import type { DevToBlog } from './devto';

/** A post as the blog API returns it. */
export interface BlogPost {
  readonly title: string;
  readonly slug: string;
  readonly publishedAt: string;
  readonly excerpt: string;
  readonly imageUrl?: string;
  readonly source: 'hashnode' | 'devto';
  readonly url: string;
}

const HASHNODE_HOST = new URL(HASHNODE_BLOG_URL).hostname;

/** Forem ends every article slug with `-` plus rand(100_000).to_s(26): 1-4 characters of [0-9a-p]. */
const FOREM_SLUG_SUFFIX = /-[0-9a-p]{1,4}$/;

/**
 * Normalizes a title for comparison: accents removed, lowercased, `&` read as "and", and every
 * run of characters other than letters and digits collapsed to one space.
 *
 * @example normalizeTitle('Beyond Static: Next.js & Café!') // 'beyond static next js and cafe'
 * @public
 */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * The Hashnode slug a dev.to `canonical_url` points at, or `undefined` when it points anywhere
 * other than a post on the Hashnode blog (dev.to sets it to the article itself by default).
 */
function canonicalHashnodeSlug(canonicalUrl: string | undefined): string | undefined {
  if (!canonicalUrl) return undefined;
  try {
    const url = new URL(canonicalUrl);
    if (url.hostname !== HASHNODE_HOST) return undefined;
    return url.pathname.replace(/^\/+|\/+$/g, '') || undefined;
  } catch {
    return undefined;
  }
}

/** Whether a dev.to slug is the Hashnode slug, optionally followed by Forem's random suffix. */
function slugsMatch(hashnodeSlug: string, devtoSlug: string): boolean {
  return devtoSlug === hashnodeSlug || devtoSlug.replace(FOREM_SLUG_SUFFIX, '') === hashnodeSlug;
}

/**
 * Finds the Hashnode post a dev.to post is a copy of.
 *
 * Keys, strongest first: (1) a `canonical_url` on the Hashnode blog, (2) the normalized title,
 * (3) the slug without Forem's suffix. A match on any key counts. Each key is tried against every
 * Hashnode post before the next key, so a canonical URL naming one post wins over a title or slug
 * match on another. When the canonical URL names a post that isn't in the list (an older post, or
 * one whose slug has since changed), the title and slug keys are still tried.
 */
function findOriginal(post: DevToBlog, hashnode: readonly Blog[]): Blog | undefined {
  const canonicalSlug = canonicalHashnodeSlug(post.canonicalUrl);
  const byCanonical =
    canonicalSlug === undefined ? undefined : hashnode.find((h) => h.slug === canonicalSlug);
  if (byCanonical) return byCanonical;

  const title = normalizeTitle(post.title);
  const byTitle = title ? hashnode.find((h) => normalizeTitle(h.title) === title) : undefined;
  return byTitle ?? hashnode.find((h) => slugsMatch(h.slug, post.slug));
}

const nonEmpty = (value: string | null | undefined): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

const timeOf = (iso: string): number => {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? 0 : time;
};

function toPost(
  post: Blog,
  source: BlogPost['source'],
  url: string,
  imageUrl: string | undefined,
): BlogPost {
  return {
    title: post.title,
    slug: post.slug,
    publishedAt: post.publishedAt,
    excerpt: post.excerpt,
    ...(imageUrl ? { imageUrl } : {}),
    source,
    url,
  };
}

/**
 * Combines Hashnode and dev.to posts, newest first, with one entry per article.
 *
 * A dev.to post that is a copy of a Hashnode post (see the keys on `findOriginal`) is dropped,
 * and the Hashnode entry is kept with its own title, excerpt, date and URL. When the Hashnode
 * post has no `imageUrl`, it takes the first matching dev.to copy's image. dev.to posts with
 * no Hashnode original are kept as they are.
 *
 * @param hashnode - Posts from the Hashnode feed, with or without covers.
 * @param devto - Posts from the dev.to API.
 * @returns New post objects sorted by `publishedAt`, newest first.
 * @public
 */
export function mergeBlogSources(
  hashnode: readonly Blog[],
  devto: readonly DevToBlog[],
): BlogPost[] {
  const pairs = devto.map((post) => ({ post, original: findOriginal(post, hashnode) }));

  const fromHashnode = hashnode.map((post) => {
    const copyImage = pairs
      .filter((pair) => pair.original === post)
      .map((pair) => nonEmpty(pair.post.imageUrl))
      .find((image) => image !== undefined);
    return toPost(
      post,
      'hashnode',
      `${HASHNODE_BLOG_URL}/${post.slug}`,
      nonEmpty(post.imageUrl) ?? copyImage,
    );
  });

  const devtoOnly = pairs
    .filter((pair) => pair.original === undefined)
    .map(({ post }) => toPost(post, 'devto', post.url, nonEmpty(post.imageUrl)));

  return [...fromHashnode, ...devtoOnly].sort(
    (a, b) => timeOf(b.publishedAt) - timeOf(a.publishedAt),
  );
}
