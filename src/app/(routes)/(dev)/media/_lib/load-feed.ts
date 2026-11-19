import 'server-only';
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
 * @file /media's data. The page starts it and waits for it a moment at most (settledWithin): in by
 * then, every item is rendered in place in the server HTML; still loading, the header goes out
 * and the strip and the list stream in (each in its own Suspense boundary) once it resolves, so
 * the first byte never waits for the slowest source.
 *
 * All five sources load at once, each behind its own stale-on-error cache:
 * - videos and talks: the shared Sanity cache (5 min), whose YouTube step rejects after 8 s
 *   (YOUTUBE_LOAD_DEADLINE_MS);
 * - presentations and articles: the shared Sanity cache (5 min);
 * - posts: the blog cache (30 min), whose sources get 6 s (BLOG_LOAD_DEADLINE_MS).
 * Once a source's list was loaded, it answers at once, however old: past its TTL the loaders
 * answer the cached list and refresh it in the background. Only a server that never loaded a
 * source waits for it, and for FEED_SOURCE_DEADLINE_MS at most; a load past that is dropped from
 * this answer but kept alive past the response (after()), so it fills its cache for the next
 * visitor. A source that fails or runs out with nothing cached costs only its own items: it is
 * reported as a warning and named in `missing`, and the page says so. When every source fails
 * the load rejects, and the (routes) error view shows inside the shell.
 *
 * This is also the one place a row's "see also" is worked out, from what the sources already
 * hold plus the hand-written maps: a written piece and the video of it (media-pairing.ts,
 * media-pairs.ts), the project an item is about (media-projects.ts, media-project-links.ts) and
 * its topics (media-topic-index.ts, media-topics.ts). The projects come from the shared Sanity
 * cache as a sixth, optional source: when they cannot load, no row names a project and nothing
 * else changes.
 */

import { cache } from 'react';
import { ensureBaseError } from '@/classes/error';
import { DeadlineError, withDeadline } from '@/lib/async/deadline';
import { keepAlive } from '@/lib/cache/keep-alive';
import { reportApiFailure } from '@/lib/observability/report';
import { urlFor } from '@/lib/sanity/client';
import {
  loadArticles,
  loadPresentations,
  loadProjects,
  loadTalks,
  loadVideoList,
} from '@/lib/sanity/loaders';
import { loadFeedPosts } from './load-media';
import {
  buildFeed,
  type FeedEntry,
  type FeedKind,
  type FeedSources,
  type SanityImage,
} from './media-feed';
import { pairEntries, pairSignals } from './media-pairing';
import { MEDIA_NOT_PAIRS, MEDIA_PAIRS } from './media-pairs';
import { MEDIA_PROJECT_RULES } from './media-project-links';
import {
  type ProjectProposal,
  projectRefs,
  projectSignals,
  proposedProjects,
  relateProjects,
} from './media-projects';
import { withTopics } from './media-topic-index';
import { MEDIA_ITEM_TOPICS, MEDIA_TOPICS } from './media-topics';

/**
 * The longest the page waits on any one source. Past the YouTube step's 8 s, so a source that
 * has a stale list to fall back on always answers first; a source that never settles is dropped.
 */
export const FEED_SOURCE_DEADLINE_MS = 9_000;

/** A Sanity still at twice the row's 80 x 45 thumbnail, cropped to 16:9. */
const STILL_WIDTH = 160;
const STILL_HEIGHT = 90;

/** What the page renders: the entries, and the kinds whose source could not answer. */
export interface FeedLoad {
  readonly entries: readonly FeedEntry[];
  readonly missing: readonly FeedKind[];
  /**
   * Project relations the map only proposes (media-project-links.ts). They are on no entry:
   * /media never shows them, and the routes lab applies them when asked.
   */
  readonly proposals: readonly ProjectProposal[];
  /**
   * False when the channel has more uploads than were read: counts and places are of the newest
   * ones only. True when the videos could not load (they are then in `missing`, not counted).
   */
  readonly videosComplete: boolean;
}

/** A Sanity image as its small 16:9 still, or null when the builder gives no URL. */
const stillUrl = (image: SanityImage): string | null =>
  urlFor(image).width(STILL_WIDTH).height(STILL_HEIGHT).fit('crop').auto('format').url() || null;

/**
 * `load` for `source`, rejecting once {@link FEED_SOURCE_DEADLINE_MS} passes. A load still
 * running then carries on, kept alive past the response, and fills its cache.
 */
async function within<T>(source: string, load: Promise<T>): Promise<T> {
  try {
    return await withDeadline(load, FEED_SOURCE_DEADLINE_MS, `media ${source}`);
  } catch (error: unknown) {
    if (error instanceof DeadlineError) keepAlive(load);
    throw error;
  }
}

/** What a settled source gave: its items, or none when it failed (reported as a warning). */
function itemsOf<T>(source: string, result: PromiseSettledResult<readonly T[]>): readonly T[] {
  if (result.status === 'fulfilled') return result.value;
  reportApiFailure(ensureBaseError(result.reason, `media:${source}`), {
    context: 'load media feed',
    level: 'warning',
  });
  return [];
}

/** The settled video listing as its list alone, for {@link itemsOf}. */
const listOf = <T>(
  result: PromiseSettledResult<{ readonly videos: readonly T[] }>,
): PromiseSettledResult<readonly T[]> =>
  result.status === 'fulfilled' ? { status: 'fulfilled', value: result.value.videos } : result;

/**
 * Every source, each within {@link FEED_SOURCE_DEADLINE_MS}, as one feed. Rejects with the first
 * source's error only when every source failed. React-cached per request.
 */
export const loadMediaFeed = cache(async (): Promise<FeedLoad> => {
  const [videos, posts, talks, presentations, articles, projects] = await Promise.allSettled([
    within('video', loadVideoList()),
    within('post', loadFeedPosts()),
    within('talk', loadTalks()),
    within('presentation', loadPresentations()),
    within('article', loadArticles()),
    within('projects', loadProjects()),
  ]);
  const byKind = [
    ['video', videos],
    ['post', posts],
    ['talk', talks],
    ['presentation', presentations],
    ['article', articles],
  ] as const;
  const missing = byKind.filter(([, result]) => result.status === 'rejected').map(([kind]) => kind);
  if (videos.status === 'rejected' && missing.length === byKind.length) {
    throw ensureBaseError(videos.reason, 'media:feed');
  }
  const sources: FeedSources = {
    videos: itemsOf('video', listOf(videos)),
    posts: itemsOf('post', posts),
    talks: itemsOf('talk', talks),
    presentations: itemsOf('presentation', presentations),
    articles: itemsOf('article', articles),
  };
  const paired = pairEntries(buildFeed(sources, stillUrl), pairSignals(sources), {
    pairs: MEDIA_PAIRS,
    notPairs: MEDIA_NOT_PAIRS,
  });
  const known = projectRefs(itemsOf('projects', projects));
  const related = relateProjects(paired, projectSignals(sources), known, MEDIA_PROJECT_RULES);
  const entries = withTopics(related, { topics: MEDIA_TOPICS, items: MEDIA_ITEM_TOPICS });
  return {
    entries,
    missing,
    proposals: proposedProjects(entries, known, MEDIA_PROJECT_RULES),
    videosComplete: videos.status === 'fulfilled' ? videos.value.complete : true,
  };
});
